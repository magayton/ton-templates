import "./messages.tact";
import "@stdlib/ownable";

// JettonWallet is a contract deployed for every user (address)
// It tracks the current balance for the owner address
// Contract init can be obtained with initOf JettonWallet(0, self.jettonMasterAddress, msg.from)
// Since contract are always deployed with 0 balance
contract JettonWallet(
    balance: Int as coins,
    jettonMasterAddress: Address,
    owner: Address,
) with Ownable {
    // INTERNAL TRANSFER (FROM MASTER CONTRACT OR OTHER WALLET)
    receive(msg: InternalTransfer) {
        let ctx: Context = context();
        let msgValue: Int = ctx.value;
        let sender: Address = sender();
        let tonBalanceBeforeMsg = myBalance() - msgValue;

        self.balance += msg.amount;

        // Validate sender is either jetton master OR another jetton wallet
        let expectedWalletInit: StateInit = initOf JettonWallet(0, self.jettonMasterAddress, msg.from);

        // https://docs.tact-lang.org/ref/core-addresses/#stateinithassamebasechainaddress
        throwUnless(
            ERROR_INVALID_SENDER,
            sender == self.jettonMasterAddress ||
            expectedWalletInit.hasSameBasechainAddress(sender),
        );

        // Send notification if forward amount > 0
        // These TON pays for notifying the recipient about incoming jettons
        // forward payload : https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md#forward_payload-format
        if (msg.forwardTonAmount > 0) {
            let fwdFee: Int = ctx.readForwardFee();
            msgValue -= msg.forwardTonAmount + fwdFee;
            message(MessageParameters {
                to: self.owner,
                value: msg.forwardTonAmount,
                mode: SendPayGasSeparately,
                bounce: false,
                body: TransferNotification {
                    queryId: msg.queryId,
                    amount: msg.amount,
                    sender: msg.from,
                    forwardPayload: msg.forwardPayload,
                }.toCell(),
            });
        }

        // Reserve storage fees
        // Why does it work here ? Because the message is using SendRemainingBalance and not SendRemainingValue
        nativeReserve(max(tonBalanceBeforeMsg, minTonsForStorage), ReserveAtMost);

        // Send excess back to response address (same workchain only)
        if (msg.responseAddress != null && parseStdAddress(msg.responseAddress!!.asSlice()).workchain == parseStdAddress(myAddress().asSlice()).workchain && msgValue > 0) {
            message(MessageParameters {
                to: msg.responseAddress!!,
                value: 0,
                mode: SendRemainingBalance | SendIgnoreErrors,
                bounce: false,
                body: Excesses { queryId: msg.queryId }.toCell(),
            });
        }
    }

    // TRANSFER (FROM OWNER)
    receive(msg: Transfer) {
        self.requireOwner();

        // Validate same workchain (prevent cross-workchain transfers)
        // https://docs.tact-lang.org/ref/core-addresses/#forcebasechain
        forceBasechain(msg.destination);

        let ctx: Context = context();
        throwUnless(ERROR_INSUFFICIENT_BALANCE, self.balance > msg.amount);

        // Calculate if we need more fees to do an other msg with forwardAmount
        let fwdCount = 1 + sign(msg.forwardTonAmount); // 0 or positive, so 0 or 1 

        // TEP-74 gas validation: must guarantee sending at least
        // in_msg_value - forward_ton_amount - 2 * max_tx_gas_price - 2 * fwd_fee to response_destination
        // minTonsForStorage added here to be super safe
        throwUnless(
            ERROR_INSUFFICIENT_GAS,
            ctx.value >
            msg.forwardTonAmount +
            fwdCount * ctx.readForwardFee() +
            (2 * getComputeFee(gasForTransfer, false)) + minTonsForStorage,
        );

        // Reserve storage fees
        nativeReserve(minTonsForStorage, ReserveExact);

        // Calculate destination wallet address
        let destinationWalletInit: StateInit = initOf JettonWallet(0, self.jettonMasterAddress, msg.destination);

        // Update balance
        self.balance -= msg.amount;

        // Call internal transfer to destination wallet with guaranteed excesses amount
        // If wallet does not exist for this address, it will automatically be deployed
        // Else it will just call InternalTransfer on it
        deploy(DeployParameters {
            init: destinationWalletInit,
            value: 0,
            mode: SendRemainingValue,
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
    // No Basechain check here because Mint and Transfer already do it, so it enforces a good behavior here
    receive(msg: Burn) {
        self.requireOwner();
        let ctx: Context = context();

        // Validate sufficient balance and gas
        throwUnless(ERROR_INSUFFICIENT_BALANCE, self.balance >= msg.amount);
        throwUnless(ERROR_INSUFFICIENT_GAS, ctx.value > (ctx.readForwardFee() + 2 * getComputeFee(gasForBurn, false)));

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
        // Handle bounced transfers restoring balance
        self.balance += msg.amount;
    }

    bounced(msg: bounced<Burn>) {
        // Handle bounced burns restoring balance
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
