// TON Payment Smart Contract Template
// Purpose: Template for handling native TON cryptocurrency payments

import "@stdlib/ownable";
import "@stdlib/stoppable";

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

const MIN_TON_FOR_STORAGE: Int = ton("0.05");

struct ConfigData {
    owner: Address;
    isStopped: Bool;
    totalDeposited: Int as coins;
    totalWithdrawn: Int as coins;
    depositCount: Int as uint32;
}

// ============================================================================
// MESSAGE STRUCTURES
// ============================================================================

message Withdraw {
    amount: Int as coins;
    destination: Address;
}

message TransferOwnership {
    newOwner: Address;
}

// ============================================================================
// EVENTS
// ============================================================================

message DepositReceived {
    sender: Address;
    amount: Int as coins;
    timestamp: Int as uint32;
}

message WithdrawalExecuted {
    destination: Address;
    amount: Int as coins;
    timestamp: Int as uint32;
}

// ============================================================================
// MAIN CONTRACT
// ============================================================================

contract Payment with Ownable, Resumable {
    owner: Address;

    // Required by Resumable trait
    stopped: Bool = false;

    init() {
        // Initialize ownership
        self.owner = sender();
    }

    // ========================================================================
    // CORE PAYMENT HANDLERS
    // ========================================================================

    receive() {
        self.requireNotStopped();

        // Get the TON amount sent with this message
        let depositAmount: Int = context().value;

        require(depositAmount > 0, "Deposit amount must be positive");

        emit(DepositReceived {
            sender: sender(),
            amount: depositAmount,
            timestamp: now(),
        }.toCell());
    }

    // ========================================================================
    // ADMINISTRATIVE FUNCTIONS (Owner Only)
    // ========================================================================

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
            mode: SendRemainingValue | SendIgnoreErrors,
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

    // ========================================================================
    // GETTER FUNCTIONS (READ-ONLY QUERIES)
    // ========================================================================

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
