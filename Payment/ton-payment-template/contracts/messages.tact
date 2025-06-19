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

message Deposit {
    purpose: String;
}

message Withdraw {
    amount: Int as coins;
    destination: Address;
}

message TransferOwnership {
    newOwner: Address;
}

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
