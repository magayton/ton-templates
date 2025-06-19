// TON Payment Handler Smart Contract Template
// Purpose: Template for handling native TON cryptocurrency payments

import "@stdlib/ownable";
import "@stdlib/stoppable";
import "./messages";

// Minimum TON to keep contract alive for storage rent
const MIN_TON_FOR_STORAGE: Int = ton("0.05");

// Contract inherits Ownable for access control and Resumable for stop/resume functionality
// It uses contract parameters to init the contract 
// https://docs.tact-lang.org/book/contracts/#parameters
// https://docs.tact-lang.org/book/gas-best-practices/#prefer-contract-parameters-to-init-and-contract-fields
contract TONPaymentHandler(
    owner: Address,
    stopped: Bool,
    totalDeposited: Int as coins,
    totalWithdrawn: Int as coins,
    depositCount: Int as uint32,
    depositsByAddress: map<Address, Int as coins>,
) with Ownable, Resumable {
    // Handle explicit deposits with purpose
    // Could have been done with "receive(msg: String)" but we use a message for clarity
    receive(msg: Deposit) {
        // Security check: ensure contract is not stopped
        self.requireNotStopped();

        // Get the TON amount sent with this message
        let depositAmount: Int = context().value;

        throwUnless(ERROR_DEPOSIT_AMOUNT_INVALID, depositAmount > 0);

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

        throwUnless(ERROR_DEPOSIT_AMOUNT_INVALID, depositAmount > 0);

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

    // Withdraw funds from contract
    receive(msg: Withdraw) {
        // Security: Only owner can withdraw
        self.requireOwner();

        // Validate withdrawal amount
        throwUnless(ERROR_WITHDRAWAL_AMOUNT_INVALID, msg.amount > 0);

        // Safe withdrawal check to keep enough TON for storage rent
        throwUnless(
            ERROR_INSUFFICIENT_BALANCE,
            msg.amount < myBalance() - context().value - MIN_TON_FOR_STORAGE,
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
            mode: SendIgnoreErrors | SendPayFwdFeesSeparately, // To send the exact amount
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
        throwUnless(ERROR_CANNOT_TRANSFER_TO_SELF, msg.newOwner != myAddress());

        // Transfer ownership
        self.owner = msg.newOwner;
    }

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
