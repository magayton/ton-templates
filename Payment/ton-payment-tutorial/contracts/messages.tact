// Error codes
const ERROR_DEPOSIT_AMOUNT_INVALID: Int = 400;
const ERROR_WITHDRAWAL_AMOUNT_INVALID: Int = 401;
const ERROR_INSUFFICIENT_BALANCE: Int = 402;
const ERROR_CANNOT_TRANSFER_TO_SELF: Int = 403;

struct ConfigData {
    owner: Address;
    isStopped: Bool;
    totalDeposited: Int as coins;
    totalWithdrawn: Int as coins;
    depositCount: Int as uint32;
}

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
