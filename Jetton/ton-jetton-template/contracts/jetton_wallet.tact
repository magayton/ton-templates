import "./messages.tact";
import "@stdlib/ownable";

contract JettonWallet(
    balance: Int as coins,
    jettonMasterAddress: Address,
    owner: Address,
) with Ownable {
    receive(msg: InternalTransfer) {
        let ctx: Context = context();
        let msgValue: Int = ctx.value;
        let sender: Address = sender();
        let tonBalanceBeforeMsg = myBalance() - msgValue;

        self.balance += msg.amount;

        let expectedWalletInit: StateInit = initOf JettonWallet(0, self.jettonMasterAddress, msg.from);

        throwUnless(
            ERROR_INVALID_SENDER,
            sender == self.jettonMasterAddress ||
            expectedWalletInit.hasSameBasechainAddress(sender),
        );

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

        nativeReserve(max(tonBalanceBeforeMsg, minTonsForStorage), ReserveAtMost);

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

    receive(msg: Transfer) {
        self.requireOwner();

        forceBasechain(msg.destination);

        let ctx: Context = context();
        throwUnless(ERROR_INSUFFICIENT_BALANCE, self.balance > msg.amount);

        let fwdCount = 1 + sign(msg.forwardTonAmount);

        throwUnless(
            ERROR_INSUFFICIENT_GAS,
            ctx.value >
            msg.forwardTonAmount +
            fwdCount * ctx.readForwardFee() +
            (2 * getComputeFee(gasForTransfer, false)) + minTonsForStorage,
        );

        nativeReserve(minTonsForStorage, ReserveExact);

        let destinationWalletInit: StateInit = initOf JettonWallet(0, self.jettonMasterAddress, msg.destination);

        self.balance -= msg.amount;

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

    receive(msg: Burn) {
        self.requireOwner();
        let ctx: Context = context();

        throwUnless(ERROR_INSUFFICIENT_BALANCE, self.balance >= msg.amount);
        throwUnless(ERROR_INSUFFICIENT_GAS, ctx.value > (ctx.readForwardFee() + 2 * getComputeFee(gasForBurn, false)));

        self.balance -= msg.amount;

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

    bounced(msg: bounced<InternalTransfer>) {
        self.balance += msg.amount;
    }

    bounced(msg: bounced<Burn>) {
        self.balance += msg.amount;
    }

    get fun get_wallet_data(): WalletData {
        return WalletData {
            balance: self.balance,
            ownerAddress: self.owner,
            jettonMasterAddress: self.jettonMasterAddress,
            jettonWalletCode: myCode(),
        };
    }
}
