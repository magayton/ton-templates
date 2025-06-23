import "./messages.tact";

const MIN_TON_FOR_STORAGE: Int = ton("0.05");
const GAS_MINT: Int = ton("0.02");

contract NftCollection(
    nextItemIndex: Int as uint64,
    ownerAddress: Address,
    royaltyParams: RoyaltyParams?,
    collectionContent: Cell,
) {
    receive() {
        let value = context().value;
        message(MessageParameters {
            to: sender(),
            value: value - MIN_TON_FOR_STORAGE,
            mode: SendIgnoreErrors,
            bounce: false,
        });
    }

    receive(msg: Mint) {
        throwUnless(ERROR_INVALID_INDEX, self.nextItemIndex >= 0);

        let msgValue: Int = calculateStorageFee(context().value, myBalance());
        let sender = sender();

        deploy(DeployParameters {
            init: initOf NftItem(
                myAddress(),
                self.nextItemIndex,
            ),
            mode: SendIgnoreErrors,
            value: msgValue,
            body: Transfer {
                queryId: msg.queryId,
                newOwner: sender,
                responseDestination: self.ownerAddress,
                customPayload: msg.itemContent,
                forwardAmount: 0,
                forwardPayload: emptySlice(),
            }.toCell(),
        });

        emit(MintExecuted {
            minter: sender,
            itemId: self.nextItemIndex,
        }.toCell());

        self.nextItemIndex += 1;
    }

    receive(msg: Burn) {
        throwUnless(ERROR_NOT_OWNER, sender() == self.ownerAddress);
        throwUnless(ERROR_INVALID_INDEX, msg.itemIndex < self.nextItemIndex);

        let nftAddress: Address = self.get_nft_address_by_index(msg.itemIndex);

        message(MessageParameters {
            to: nftAddress,
            value: ton("0.05"),
            mode: SendPayFwdFeesSeparately,
            bounce: true,
            body: Burn {
                queryId: msg.queryId,
                itemIndex: msg.itemIndex,
                owner: msg.owner,
            }.toCell(),
        });

        emit(BurnExecuted {
            burner: sender(),
            itemId: msg.itemIndex,
        }.toCell());
    }

    receive(msg: GetRoyaltyParams) {
        if (self.royaltyParams == null) {
            message(MessageParameters {
                to: sender(),
                value: 0,
                mode: SendRemainingValue,
                bounce: false,
                body: ReportRoyaltyParams {
                    queryId: msg.queryId,
                    numerator: 0,
                    denominator: 1000,
                    destination: self.ownerAddress,
                }.toCell(),
            });
        } else {
            let royalty: RoyaltyParams = self.royaltyParams!!;
            message(MessageParameters {
                to: sender(),
                value: 0,
                mode: SendRemainingValue,
                bounce: false,
                body: ReportRoyaltyParams {
                    queryId: msg.queryId,
                    numerator: royalty.numerator,
                    denominator: royalty.denominator,
                    destination: royalty.destination,
                }.toCell(),
            });
        }
    }

    get fun get_collection_data(): CollectionData {
        let b: StringBuilder = beginString();
        let collectionData: String = self.collectionContent.asSlice().asString();
        b.append(collectionData);
        return CollectionData {
            nextItemIndex: self.nextItemIndex,
            collectionContent: b.toCell(),
            ownerAddress: self.ownerAddress,
        };
    }

    get fun get_nft_content(index: Int, individualContent: Cell): Cell {
        let b: StringBuilder = beginString();
        let collectionContentStr: String = self.collectionContent.asSlice().asString();
        let individualContentStr: String = individualContent.asSlice().asString();

        b.append(collectionContentStr);
        b.append(individualContentStr);

        return b.toCell();
    }

    get fun get_nft_address_by_index(itemIndex: Int): Address {
        let initCode: StateInit = self.getNftItemInit(itemIndex);
        return contractAddress(initCode);
    }

    get fun getNftItemInit(itemIndex: Int): StateInit {
        return initOf NftItem(myAddress(), itemIndex);
    }

    get fun royalty_params(): RoyaltyParams? {
        return self.royaltyParams;
    }
}

contract NftItem {
    isInitialized: Bool = false;
    collectionAddress: Address;
    itemIndex: Int;
    owner: Address?;
    individualContent: Cell?;

    init(collection_address: Address, item_index: Int) {
        throwUnless(ERROR_NOT_COLLECTION, sender() == collection_address);
        self.collectionAddress = collection_address;
        self.itemIndex = item_index;
    }

    receive(msg: Transfer) {
        let ctx: Context = context();
        let msgValue: Int = calculateStorageFee(ctx.value, myBalance());

        if (!self.isInitialized) {
            throwUnless(ERROR_NOT_COLLECTION, sender() == self.collectionAddress);
            self.isInitialized = true;
            self.owner = msg.newOwner;
            self.individualContent = msg.customPayload;
            message(MessageParameters {
                to: msg.responseDestination!!,
                value: msgValue,
                mode: SendPayFwdFeesSeparately,
                bounce: false,
                body: Excesses { queryId: msg.queryId }.toCell(),
            });
        } else {
            throwUnless(ERROR_NOT_OWNER, sender() == self.owner);
            self.owner = msg.newOwner;
            if (msg.forwardAmount > 0) {
                message(MessageParameters {
                    to: msg.newOwner,
                    value: msg.forwardAmount,
                    mode: SendPayFwdFeesSeparately,
                    bounce: true,
                    body: OwnershipAssigned {
                        queryId: msg.queryId,
                        prevOwner: sender(),
                        forwardPayload: msg.forwardPayload,
                    }.toCell(),
                });
            }

            msgValue -= ctx.readForwardFee();
            if (msg.responseDestination != null) {
                message(MessageParameters {
                    to: msg.responseDestination!!,
                    value: msgValue,
                    mode: SendPayFwdFeesSeparately,
                    bounce: false,
                    body: Excesses { queryId: msg.queryId }.toCell(),
                });
            }
        }
    }

    receive(msg: Burn) {
        throwUnless(ERROR_NOT_COLLECTION, sender() == self.collectionAddress);

        message(MessageParameters {
            to: msg.owner,
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero,
            bounce: false,
            body: emptyCell(),
        });
    }

    receive(msg: GetStaticData) {
        message(MessageParameters {
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: ReportStaticData {
                queryId: msg.queryId,
                index: self.itemIndex,
                collection: self.collectionAddress,
            }.toCell(),
        });
    }

    get fun get_nft_data(): GetNftData {
        return GetNftData {
            init: self.isInitialized,
            index: self.itemIndex,
            collectionAddress: self.collectionAddress,
            ownerAddress: self.owner,
            individualContent: self.individualContent,
        };
    }
}

fun calculateStorageFee(value: Int, currentBalance: Int): Int {
    let storageFee: Int = MIN_TON_FOR_STORAGE - min(currentBalance, MIN_TON_FOR_STORAGE);
    return value - (storageFee + GAS_MINT);
}
