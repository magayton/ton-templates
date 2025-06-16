// TON Payment Handler Smart Contract Template
// Purpose: Template for handling native TON cryptocurrency payments

import "@stdlib/ownable";
import "@stdlib/stoppable";

// ============================================================================
// CONSTANTS AND CONFIGURATION
// ============================================================================

// Minimum TON to keep contract alive for storage rent
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

// Deposit TON to the contract with a purpose
message Deposit {
    // Purpose of the deposit
    purpose: String;
}

// Withdraw TON from the contract (owner only)
message Withdraw {
    // Amount to withdraw in nanoTON (1 TON = 10^9 nanoTON)
    // Using 'coins' serialization ensures proper handling of TON amounts
    amount: Int as coins;

    destination: Address;

    // Comment for the withdrawal (optional)
    comment: String?;
}

// Transfer ownership (owner only)
message TransferOwnership {
    newOwner: Address;
}

// ============================================================================
// EVENTS
// ============================================================================

message DepositReceived {
    // Address that made the deposit
    sender: Address;

    // Amount deposited in nanoTON
    amount: Int as coins;

    // Block timestamp when deposit was received
    timestamp: Int as uint32;

    // Associated purpose/metadata (optional)
    purpose: String?;
}

message WithdrawalExecuted {
    // Destination of withdrawal
    destination: Address;

    // Amount withdrawn in nanoTON
    amount: Int as coins;

    // Block timestamp of withdrawal
    timestamp: Int as uint32;

    // Comment for the withdrawal (optional)
    comment: String?;
}

// ============================================================================
// MAIN CONTRACT
// ============================================================================

// Contract inherits Ownable for access control and Resumable for stop/resume functionality
contract TONPaymentHandler with Ownable, Resumable {
    // ========================================================================
    // STATE VARIABLES
    // ========================================================================
    // Contract owner (inherited from Ownable)
    owner: Address;

    // Contract stopped state (required by Resumable trait)
    stopped: Bool = false;

    // Total amount deposited to the contract (excluding gas reserves)
    totalDeposited: Int as coins = 0;

    // Total amount withdrawn from the contract (for tracking)
    totalWithdrawn: Int as coins = 0;

    // Total number of deposits received
    depositCount: Int as uint32 = 0;

    // Mapping to track deposits per address
    depositsByAddress: map<Address, Int as coins>;

    // ========================================================================
    // CONSTRUCTOR
    // Could have been done with contract parameters
    // but for simplicity and automatisation we initialize with init() and sender()
    // https://docs.tact-lang.org/book/gas-best-practices/#prefer-contract-parameters-to-init-and-contract-fields
    //
    // Important to note : deployment update the totalDeposited and the depositCount
    // Because it triggers the receive() method
    // ========================================================================

    // Initialize contract with owner
    init() {
        // Initialize ownership
        self.owner = sender();
    }

    // ========================================================================
    // CORE PAYMENT HANDLERS
    // ========================================================================

    // Handle explicit deposits with purpose
    // Could have been done with "receive(msg: String)" but we use a message for clarity
    receive(msg: Deposit) {
        // Security check: ensure contract is not stopped
        self.requireNotStopped();

        // Get the TON amount sent with this message
        let depositAmount: Int = context().value;

        require(depositAmount > 0, "Deposit amount must be positive");

        self.totalDeposited += depositAmount;
        self.depositCount += 1;

        // Update per-address tracking
        let existingBalance: Int? = self.depositsByAddress.get(sender());
        let currentBalance: Int = 0;
        if (existingBalance != null) {
            currentBalance = existingBalance!!;
        }
        self.depositsByAddress.set(sender(), currentBalance + depositAmount);

        // Emit deposit event for off-chain tracking
        emit(DepositReceived {
            sender: sender(),
            amount: depositAmount,
            timestamp: now(),
            purpose: msg.purpose,
        }.toCell());
    }

    // Handle plain TON transfers (when a user sends TON without specific message)
    receive() {
        // Security check: ensure contract is not stopped
        self.requireNotStopped();

        // Get the TON amount sent with this message
        let depositAmount: Int = context().value;

        require(depositAmount > 0, "Deposit amount must be positive");

        self.totalDeposited += depositAmount;
        self.depositCount += 1;

        // Update per-address tracking
        let existingBalance: Int? = self.depositsByAddress.get(sender());
        let currentBalance: Int = 0;
        if (existingBalance != null) {
            currentBalance = existingBalance!!;
        }
        self.depositsByAddress.set(sender(), currentBalance + depositAmount);

        // Emit event
        emit(DepositReceived {
            sender: sender(),
            amount: depositAmount,
            timestamp: now(),
            purpose: null,
        }.toCell());
    }

    // ========================================================================
    // ADMINISTRATIVE FUNCTIONS (Owner Only)
    // ========================================================================

    // Withdraw funds from contract
    receive(msg: Withdraw) {
        // Security: Only owner can withdraw
        self.requireOwner();

        // Validate withdrawal amount
        require(msg.amount > 0, "Withdrawal amount must be positive");


        // Safe withdrawal check to keep enough TON for storage rent
        require(
            msg.amount < myBalance() - context().value - MIN_TON_FOR_STORAGE,
            "Insufficient balance for withdrawal",
        );

        self.totalWithdrawn += msg.amount;

        // Execute withdrawal
        let messageBody: Cell? = null;
        if (msg.comment != null) {
            messageBody = msg.comment!!.asComment();
        }

        // Send funds (https://docs.tact-lang.org/book/gas-best-practices/#use-message-function-for-non-deployment-messages)
        // https://docs.tact-lang.org/cookbook/single-communication/#how-to-send-a-message-with-the-remaining-value
        message(MessageParameters {
            to: msg.destination,
            value: msg.amount,
            mode: SendRemainingValue | SendIgnoreErrors,
            bounce: true, // Use bounced messages for error handling
            body: messageBody,
        });

        // Emit withdrawal event
        emit(WithdrawalExecuted {
            destination: msg.destination,
            amount: msg.amount,
            timestamp: now(),
            comment: msg.comment,
        }.toCell());
    }

    // Transfer ownership
    receive(msg: TransferOwnership) {
        self.requireOwner();

        // Validate new owner address
        require(msg.newOwner != myAddress(), "Cannot transfer to self");

        // Transfer ownership
        self.owner = msg.newOwner;
    }

    // ========================================================================
    // BOUNCED MESSAGE HANDLING
    // ========================================================================

    // Handle bounced messages (when sends fail)
    // Critical for proper error handling on TON
    bounced(src: bounced<Withdraw>) {
        // If withdrawal bounced, we need to restore state
        // This is a simplified example - in production you might want
        // more sophisticated error handling

        // The bounced message contains limited data (first 256 bits)
        // We can restore the amount from the bounced data
        self.totalWithdrawn -= src.amount;

        // Notify of failed withdrawal
        // You might want to use "send() / message()" for a better UX
        // but you need to keep the original sender
        emit("Withdrawal failed".asComment());
    }

    // ========================================================================
    // GETTER FUNCTIONS (READ-ONLY QUERIES)
    // ========================================================================

    // Get current contract balance
    get fun balance(): Int {
        return myBalance();
    }

    // Get available balance (excluding storage reserve)
    get fun availableBalance(): Int {
        let current: Int = myBalance();
        if (current <= MIN_TON_FOR_STORAGE) {
            return 0;
        }
        return current - MIN_TON_FOR_STORAGE;
    }

    // Get total deposited amount
    get fun totalDeposited(): Int {
        return self.totalDeposited;
    }

    // Get number of deposits
    get fun depositCount(): Int {
        return self.depositCount;
    }

    // Get number of deposits
    get fun totalWithdrawn(): Int {
        return self.totalWithdrawn;
    }

    // Get deposits for specific address
    get fun depositsForAddress(address: Address): Int {
        let balance: Int? = self.depositsByAddress.get(address);
        if (balance == null) {
            return 0;
        }
        return balance!!;
    }

    // Get contract configuration
    get fun config(): ConfigData {
        return ConfigData {
            owner: self.owner,
            isStopped: self.stopped(),
            totalDeposited: self.totalDeposited,
            totalWithdrawn: self.totalWithdrawn,
            depositCount: self.depositCount,
        };
    }
}
