import "./messages.tact";
import "@stdlib/ownable";

// JettonWallet is a contract deployed for every user (address)
// It tracks the current balance for the owner address
// It uses "init()" and not contract parameters because of
// getJettonWalletInit(ownerAddress: Address): StateInit in JettonMaster
contract JettonWallet with Ownable {
    // STORAGE STATE
    balance: Int as coins;
    owner: Address;
    jettonMasterAddress: Address;

    // GAS CONSTANTS
    const minTonForStorage: Int = ton("0.05");
    const gasConsumption: Int = ton("0.01");

    // CONTRACT DEPLOYMENT INIT
    init(jettonMasterAddress: Address, ownerAddress: Address) {
        self.balance = 0;
        self.owner = ownerAddress; // Ownable trait field
        self.jettonMasterAddress = jettonMasterAddress;
    }

    // INTERNAL TRANSFER (FROM MASTER CONTRACT OR OTHER WALLET)
    receive(msg: InternalTransfer) {
        let ctx: Context = context();

        // Validate sender is either jetton master OR another jetton wallet
        let expectedWalletInit: StateInit = initOf JettonWallet(self.jettonMasterAddress, msg.from);
        let expectedWalletAddress: Address = contractAddress(expectedWalletInit);

        throwUnless(
            ERROR_INVALID_SENDER,
            ctx.sender == self.jettonMasterAddress ||
            ctx.sender == expectedWalletAddress,
        );

        // Reserve storage fees (https://docs.tact-lang.org/ref/core-contextstate/#nativereserve)
        nativeReserve(self.minTonForStorage, ReserveExact);

        self.balance += msg.amount;

        // Send notification if forward amount > 0
        // This TON pays for notifying the recipient about incoming jettons
        // forward payload : https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md#forward_payload-format
        if (msg.forwardTonAmount > 0) {
            message(MessageParameters {
                to: self.owner,
                value: msg.forwardTonAmount,
                mode: SendPayGasSeparately + SendIgnoreErrors,
                bounce: false,
                body: TransferNotification {
                    queryId: msg.queryId,
                    amount: msg.amount,
                    sender: msg.from,
                    forwardPayload: msg.forwardPayload,
                }.toCell(),
            });
        }

        // Send excess back to response address (same workchain only)
        if (msg.responseAddress != null && parseStdAddress(msg.responseAddress!!.asSlice()).workchain == parseStdAddress(myAddress().asSlice()).workchain) {
            message(MessageParameters {
                to: msg.responseAddress!!,
                value: 0,
                mode: SendRemainingValue + SendIgnoreErrors,
                bounce: false,
                body: Excesses { queryId: msg.queryId }.toCell(),
            });
        }
    }

    // TRANSFER (FROM OWNER)
    receive(msg: Transfer) {
        self.requireOwner();

        let ctx: Context = context();
        throwUnless(ERROR_INSUFFICIENT_BALANCE, self.balance > msg.amount);

        // Validate same workchain (prevent cross-workchain transfers)
        throwUnless(ERROR_NOT_SAME_WORKCHAIN, parseStdAddress(msg.destination.asSlice()).workchain == parseStdAddress(myAddress().asSlice()).workchain);

        // TEP-74 gas validation: must guarantee sending at least
        // in_msg_value - forward_ton_amount - 2 * max_tx_gas_price - 2 * fwd_fee to response_destination
        let fwdFee: Int = ctx.readForwardFee();
        let guaranteedAmount: Int = ctx.value - msg.forwardTonAmount - 2 * self.gasConsumption - 2 * fwdFee;
        throwUnless(ERROR_INSUFFICIENT_GAS, guaranteedAmount > 0);

        // Reserve storage fees
        nativeReserve(self.minTonForStorage, ReserveExact);

        // Calculate destination wallet address
        let destinationWalletInit: StateInit = initOf JettonWallet(self.jettonMasterAddress, msg.destination);
        let destinationWalletAddress: Address = contractAddress(destinationWalletInit);

        // Update balance
        self.balance -= msg.amount;

        // Call internal transfer to destination wallet with guaranteed excesses amount
        // If wallet does not exist for this address, it will automatically be deployed
        message(MessageParameters {
            to: destinationWalletAddress,
            value: guaranteedAmount + msg.forwardTonAmount,
            mode: SendPayGasSeparately,
            bounce: true,
            body: InternalTransfer {
                queryId: msg.queryId,
                amount: msg.amount,
                from: self.owner,
                responseAddress: msg.responseDestination,
                forwardTonAmount: msg.forwardTonAmount,
                forwardPayload: msg.forwardPayload,
            }.toCell(),
        });
    }

    // BURN TOKENS
    // It substracts the amount to the balance
    receive(msg: Burn) {
        self.requireOwner();
        let ctx: Context = context();

        // Validate sufficient balance
        throwUnless(ERROR_INSUFFICIENT_BALANCE, self.balance >= msg.amount);

        // TEP-74 burn gas validation: must send at least in_msg_value - max_tx_gas_price to response_destination
        throwUnless(ERROR_INSUFFICIENT_GAS, ctx.value >= self.gasConsumption);

        // Reserve storage fees
        nativeReserve(self.minTonForStorage, ReserveExact);

        // Update balance
        self.balance -= msg.amount;

        // Notify jetton master about burn
        send(SendParameters {
            to: self.jettonMasterAddress,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: BurnNotification {
                queryId: msg.queryId,
                amount: msg.amount,
                sender: self.owner,
                responseDestination: msg.responseDestination,
            }.toCell(),
        });
    }

    // BOUNCED MESSAGE HANDLER
    bounced(msg: bounced<InternalTransfer>) {
        // Handle bounced transfers - restore balance
        self.balance += msg.amount;
    }

    //  TEP74 MANDATORY GET METHODS
    get fun get_wallet_data(): WalletData {
        return WalletData {
            balance: self.balance,
            ownerAddress: self.owner,
            jettonMasterAddress: self.jettonMasterAddress,
            jettonWalletCode: myCode(),
        };
    }
}
