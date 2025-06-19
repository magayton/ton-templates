import "@stdlib/ownable";
import "@stdlib/stoppable";
import "./messages";

const MIN_TON_FOR_STORAGE: Int = ton("0.05");

contract Payment(owner: Address, stopped: Bool) with Ownable, Resumable {
    receive() {
        self.requireNotStopped();

        let depositAmount: Int = context().value;

        require(depositAmount > 0, "Deposit amount must be positive");

        emit(DepositReceived {
            sender: sender(),
            amount: depositAmount,
            timestamp: now(),
        }.toCell());
    }

    receive(msg: Withdraw) {
        self.requireOwner();

        require(msg.amount > 0, "Withdrawal amount must be positive");

        require(
            msg.amount < myBalance() - context().value - MIN_TON_FOR_STORAGE,
            "Insufficient balance for withdrawal",
        );

        message(MessageParameters {
            to: msg.destination,
            value: msg.amount,
            mode: SendIgnoreErrors | SendPayFwdFeesSeparately,
            bounce: false,
            body: null,
        });

        emit(WithdrawalExecuted {
            destination: msg.destination,
            amount: msg.amount,
            timestamp: now(),
        }.toCell());
    }

    receive(msg: TransferOwnership) {
        self.requireOwner();

        require(msg.newOwner != myAddress(), "Cannot transfer to self");

        self.owner = msg.newOwner;
    }

    get fun balance(): Int {
        return myBalance();
    }

    get fun availableBalance(): Int {
        let current: Int = myBalance();
        if (current <= MIN_TON_FOR_STORAGE) {
            return 0;
        }
        return current - MIN_TON_FOR_STORAGE;
    }
}
