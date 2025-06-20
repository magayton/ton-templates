// Error constants
const ERROR_NOT_COLLECTION_OWNER: Int = 400;
const ERROR_NOT_SBT_OWNER: Int = 401;
const ERROR_NOT_COLLECTION: Int = 402;
const ERROR_SOULBOUND_CANNOT_TRANSFER: Int = 403;
const ERROR_SBT_REVOKED: Int = 404;
const ERROR_NOT_INITIALIZED: Int = 405;
const ERROR_ALREADY_REVOKED: Int = 406;
const ERROR_ALREADY_INITIALIZED: Int = 407;

// Standard TEP62 messages
message Transfer {
    queryId: Int as uint64;
    newOwner: Address;
    responseDestination: Address;
    customPayload: Cell?;
    forwardAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message OwnershipAssigned {
    queryId: Int as uint64;
    prevOwner: Address;
    forwardPayload: Slice as remaining;
}

// SBT-specific messages
message Mint {
    queryId: Int as uint64;
    to: Address;
    collectionContent: Cell;
}

// Initialization message (sent by collection during deployment)
message ItemInit {
    newOwner: Address;
    content: Cell;
    authorityAddress: Address;
}

message(0x6f89f5e3) Revoke {
    queryId: Int as uint64;
}

message ProveOwnership {
    queryId: Int as uint64;
    dest: Address;
    forwardPayload: Cell;
    withContent: Bool;
}

message OwnershipProof {
    queryId: Int as uint64;
    itemId: Int as uint256;
    owner: Address?;
    data: Cell;
    revokedAt: Int as uint64;
    content: Cell?;
}

message OwnershipProofBounced {
    queryId: Int as uint64;
}

message Destroy {
    queryId: Int as uint64;
}

message(0xd0c3bfea) RequestOwner {
    queryId: Int as uint64;
    dest: Address;
    forwardPayload: Cell;
    withContent: Bool;
}

message(0x0dd607e3) OwnerInfo {
    queryId: Int as uint64;
    itemId: Int as uint256;
    initiator: Address;
    owner: Address;
    data: Cell;
    revokedAt: Int as uint64;
    content: Cell?;
}

message(0x2fcb26a2) GetStaticData {
    queryId: Int as uint64;
}

message(0x8b771735) ReportStaticData {
    queryId: Int as uint64;
    index: Int as uint256;
    collection: Address;
}

message(0xd53276db) Excesses {
    queryId: Int as uint64;
}

// Get method return structures
struct CollectionData {
    nextItemIndex: Int;
    collectionContent: Cell;
    ownerAddress: Address;
}

struct NftData {
    isInitialized: Bool;
    index: Int;
    collectionAddress: Address;
    ownerAddress: Address?;
    content: Cell?;
}
