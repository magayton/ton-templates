import "./messages.tact";

// 
contract JettonWallet {
    
    // STORAGE STATE
    balance: Int as coins;
    ownerAddress: Address;
    jettonMasterAddress: Address;
    
    // GAS CONSTANTS
    const MinTonForStorage: Int = ton("0.01");
    const GasConsumption: Int = ton("0.01");
    
    //  CONTRACT INITIALIZATION
    init(jettonMasterAddress: Address, ownerAddress: Address) {
        self.balance = 0;
        self.ownerAddress = ownerAddress;
        self.jettonMasterAddress = jettonMasterAddress;
    }
    
    //  INTERNAL TRANSFER (FROM MASTER) 
    receive(msg: InternalTransfer) {
        let ctx: Context = context();
        
        // Validate sender is jetton master
        throwUnless(ERROR_NOT_JETTON_MASTER, ctx.sender == self.jettonMasterAddress);
        
        // Reserve storage fees
        nativeReserve(self.MinTonForStorage, ReserveExact);
        
        // Update balance
        self.balance += msg.amount;
        
        // Send notification if forward amount > 0
        // TEP-74: forward_payload format handling (text comments start with 0x00000000)
        if (msg.forwardTonAmount > 0) {
            message(MessageParameters{
                to: self.ownerAddress,
                value: msg.forwardTonAmount,
                mode: SendPayGasSeparately + SendIgnoreErrors,
                bounce: false,
                body: TransferNotification{
                    queryId: msg.queryId,
                    amount: msg.amount,  
                    sender: msg.from,
                    forwardPayload: msg.forwardPayload
                }.toCell()
            });
        }
        
        // Send excess back to response address
        if (msg.responseAddress != null) {
            message(MessageParameters{
                to: msg.responseAddress!!,
                value: 0,
                mode: SendRemainingValue + SendIgnoreErrors,
                bounce: false,
                body: Excesses{queryId: msg.queryId}.toCell()
            });
        }
    }
    
    //  TRANSFER (FROM OWNER) 
    receive(msg: Transfer) {
        let ctx: Context = context();
        
        // Validate sender is owner
        throwUnless(ERROR_NOT_OWNER, ctx.sender == self.ownerAddress);
        
        // Validate sufficient balance
        throwUnless(ERROR_INSUFFICIENT_BALANCE, self.balance >= msg.amount);
        
        // TEP-74 gas validation: must guarantee sending at least
        // in_msg_value - forward_ton_amount - 2 * max_tx_gas_price - 2 * fwd_fee to response_destination
        let fwdFee: Int = ctx.readForwardFee();
        let maxTxGas: Int = ton("0.01"); // Approximate max transaction gas for basechain
        let guaranteedAmount: Int = ctx.value - msg.forwardTonAmount - 2 * maxTxGas - 2 * fwdFee;
        throwUnless(ERROR_INSUFFICIENT_GAS, guaranteedAmount > 0);
        
        // Reserve storage fees  
        nativeReserve(self.MinTonForStorage, ReserveExact);
        
        // Update balance
        self.balance -= msg.amount;
        
        // Calculate destination wallet init
        let destinationWalletInit: StateInit = initOf JettonWallet(self.jettonMasterAddress, msg.destination);
        let destinationWalletAddress: Address = contractAddress(destinationWalletInit);
        
        // Send internal transfer to destination wallet with guaranteed excesses amount
        message(MessageParameters{
            to: destinationWalletAddress,
            value: guaranteedAmount + msg.forwardTonAmount,
            mode: SendPayGasSeparately,
            bounce: true,
            body: InternalTransfer{
                queryId: msg.queryId,
                amount: msg.amount,
                from: self.ownerAddress,
                responseAddress: msg.responseDestination,
                forwardTonAmount: msg.forwardTonAmount,
                forwardPayload: msg.forwardPayload
            }.toCell()
        });
    }
    
    //  BURN TOKENS 
    receive(msg: Burn) {
        let ctx: Context = context();
        
        // Validate sender is owner
        throwUnless(ERROR_NOT_OWNER, ctx.sender == self.ownerAddress);
        
        // Validate sufficient balance
        throwUnless(ERROR_INSUFFICIENT_BALANCE, self.balance >= msg.amount);
        
        // TEP-74 burn gas validation: must send at least in_msg_value - max_tx_gas_price to response_destination
        let maxTxGas: Int = ton("0.01");
        throwUnless(ERROR_INSUFFICIENT_GAS, ctx.value >= maxTxGas);
        
        // Reserve storage fees
        nativeReserve(self.MinTonForStorage, ReserveExact);
        
        // Update balance
        self.balance -= msg.amount;
        
        // Notify jetton master about burn
        send(SendParameters{
            to: self.jettonMasterAddress,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: BurnNotification{
                queryId: msg.queryId,
                amount: msg.amount,
                sender: self.ownerAddress,
                responseDestination: msg.responseDestination
            }.toCell()
        });
    }
    
    //  BOUNCED MESSAGE HANDLER 
    bounced(msg: bounced<InternalTransfer>) {
        // Handle bounced transfers - restore balance
        self.balance += msg.amount;
    }
    
    //  TEP74 MANDATORY GET METHODS 
    get fun get_wallet_data(): WalletData {
        return WalletData{
            balance: self.balance,
            ownerAddress: self.ownerAddress,
            jettonMasterAddress: self.jettonMasterAddress,
            jettonWalletCode: myCode()
        };
    }
}

