const ERROR_NOT_OWNER: Int = 400;
const ERROR_NOT_COLLECTION: Int = 401;
const ERROR_NOT_INITIALIZED: Int = 402;
const ERROR_INSUFFICIENT_FUNDS: Int = 403;
const ERROR_INVALID_INDEX: Int = 404;
const ERROR_INSUFFICIENT_GAS: Int = 405;

struct RoyaltyParams {
    numerator: Int as uint16;
    denominator: Int as uint16;
    destination: Address;
}

struct CollectionData {
    nextItemIndex: Int as uint64;
    collectionContent: Cell;
    ownerAddress: Address;
}

struct GetNftData {
    init: Bool?;
    index: Int as uint64;
    collectionAddress: Address;
    ownerAddress: Address?;
    individualContent: Cell?;
}

message(0x6d560697) Mint {
    queryId: Int as uint64;
    itemContent: Cell;
}

message(0x1f0f3ca5) Burn {
    queryId: Int as uint64;
    itemIndex: Int as uint64;
    owner: Address;
}

message(0x5fcc3d14) Transfer {
    queryId: Int as uint64;
    newOwner: Address;
    responseDestination: Address?;
    customPayload: Cell?;
    forwardAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message(0x2fcb26a2) GetStaticData {
    queryId: Int as uint64;
}

message(0x8b771735) ReportStaticData {
    queryId: Int as uint64;
    index: Int as uint256;
    collection: Address;
}

message(0x05138d91) OwnershipAssigned {
    queryId: Int as uint64;
    prevOwner: Address;
    forwardPayload: Slice as remaining;
}

message(0xd53276db) Excesses {
    queryId: Int as uint64;
}

message(0x693d3950) GetRoyaltyParams {
    queryId: Int as uint64;
}

message(0xa8cb00ad) ReportRoyaltyParams {
    queryId: Int as uint64;
    numerator: Int as uint16;
    denominator: Int as uint16;
    destination: Address;
}
message MintExecuted {
    minter: Address;
    itemId: Int as uint64;
}

message BurnExecuted {
    burner: Address;
    itemId: Int as uint64;
}
