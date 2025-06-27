// messages.tact - Message and struct definitions for Jetton contracts (TEP-74)

const ERROR_NOT_ADMIN: Int = 300;
const ERROR_INVALID_SENDER: Int = 301;
const ERROR_INSUFFICIENT_GAS: Int = 302;
const ERROR_INSUFFICIENT_BALANCE: Int = 303;
const ERROR_INVALID_AMOUNT: Int = 304;
const ERROR_NOT_JETTON_MASTER: Int = 305;
const ERROR_NOT_SAME_WORKCHAIN: Int = 306;
const ERROR_MINT_CLOSED: Int = 307;

// These 2 gas prices come from experiments
const gasForTransfer: Int = 12000;
const gasForBurn: Int = 7000;

const minTonsForStorage: Int = ton("0.05");
const minTonForWalletDeploy: Int = ton("0.05");

// ===== TEP74 STANDARD =====

// Jetton Master Messages
message(0x642b7d07) Mint {
    queryId: Int as uint64;
    amount: Int as coins;
    to: Address;
    responseDestination: Address?;
    customPayload: Cell?;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message(0x7bdd97de) BurnNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    responseDestination: Address?;
}

// Jetton Wallet Messages
message(0x178d4519) InternalTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    from: Address;
    responseAddress: Address?;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message(0xf8a7ea5) Transfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    responseDestination: Address?;
    customPayload: Cell?;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message(0x7362d09c) TransferNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    forwardPayload: Slice as remaining;
}

message(0x595f07bc) Burn {
    queryId: Int as uint64;
    amount: Int as coins;
    responseDestination: Address?;
    customPayload: Cell?;
}

// Shared Messages
message(0xd53276db) Excesses {
    queryId: Int as uint64;
}

// ===== TEP89 STANDARD =====

message(0x2c76b973) ProvideWalletAddress {
    queryId: Int as uint64;
    ownerAddress: Address;
    includeAddress: Bool;
}

message(0xd1735400) TakeWalletAddress {
    queryId: Int as uint64;
    walletAddress: Address;
    ownerAddress: Cell?;
}

// ===== ADMIN MANAGEMENT MESSAGES =====

message ChangeAdmin {
    queryId: Int as uint64;
    newAdmin: Address;
}

message ClaimAdmin {
    queryId: Int as uint64;
}

message DropAdmin {
    queryId: Int as uint64;
}

message ChangeMetadataUri {
    queryId: Int as uint64;
    metadataUri: String;
}

message Upgrade {
    queryId: Int as uint64;
    newData: Cell;
    newCode: Cell;
}

message ChangeMintState {
    queryId: Int as uint64;
}

// ===== DATA STRUCTURES =====

struct JettonData {
    totalSupply: Int;
    mintable: Bool;
    adminAddress: Address;
    jettonContent: Cell;
    jettonWalletCode: Cell;
}

struct WalletData {
    balance: Int;
    ownerAddress: Address;
    jettonMasterAddress: Address;
    jettonWalletCode: Cell;
}
