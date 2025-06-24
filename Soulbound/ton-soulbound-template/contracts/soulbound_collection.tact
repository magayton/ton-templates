import "./messages.tact";

const MIN_TON_FOR_STORAGE: Int = ton("0.05"); 

contract SoulboundCollection(
    nextItemIndex: Int as uint32,
    ownerAddress: Address,
    collectionContent: Cell,
) {

    receive() { 
        let value = context().value;
        message(MessageParameters{
            to: sender(),
            value: value - MIN_TON_FOR_STORAGE,
            mode: SendIgnoreErrors,
            bounce: false,
        });
    }

    receive(msg: Mint) {
        throwUnless(ERROR_NOT_COLLECTION_OWNER, sender() == self.ownerAddress);

        deploy(DeployParameters{
            init: initOf SBTItem(
                myAddress(), 
                self.nextItemIndex,
            ),
            mode: SendIgnoreErrors,
            value: context().value,
            body: ItemInit {
                    newOwner: msg.to,
                    content: msg.itemContent,
                    authorityAddress: self.ownerAddress,
            }.toCell(),
        });

        self.nextItemIndex += 1;
    }

    get fun get_nft_address_by_index(itemIndex: Int): Address {
        let initCode: StateInit = self.getSbtItemInit(itemIndex);
        return contractAddress(initCode);
    }

    get fun getSbtItemInit(itemIndex: Int): StateInit {
        return initOf SBTItem(myAddress(), itemIndex);
    }

    get fun get_collection_data(): CollectionData {     
        let b: StringBuilder = beginString();
        let collectionData: String = self.collectionContent.asSlice().asString();
        b.append(collectionData);
        return CollectionData{
            nextItemIndex: self.nextItemIndex, 
            collectionContent: b.toCell(), 
            ownerAddress: self.ownerAddress
        };
    }

    get fun get_nft_content(index: Int, individual_content: Cell): Cell {
        let b: StringBuilder = beginString();
        let collectionContentStr: String = self.collectionContent.asSlice().asString();
        let individualContentStr: String = individual_content.asSlice().asString();
        
        b.append(collectionContentStr);
        b.append(individualContentStr);
        
        return b.toCell();
    }
}

contract SBTItem {

    isInitialized: Bool = false;
    collectionAddress: Address;
    itemIndex: Int;
    owner: Address?;
    individualContent: Cell?;
    authorityAddress: Address?;
    revokedAt: Int as uint64 = 0;

   init(collection_address: Address, item_index: Int){
        throwUnless(ERROR_NOT_COLLECTION, sender() == collection_address);
        self.collectionAddress = collection_address;
        self.itemIndex = item_index;
        self.isInitialized = true;
    }

    receive(msg: ItemInit) {
        throwUnless(ERROR_ALREADY_INITIALIZED, self.isInitialized);
        throwUnless(ERROR_NOT_COLLECTION, sender() == self.collectionAddress);
        
        self.owner = msg.newOwner;
        self.individualContent = msg.content;
        self.authorityAddress = msg.authorityAddress;
    }

    receive(msg: Transfer) {
        throwUnless(ERROR_SOULBOUND_CANNOT_TRANSFER, false);
    }

    receive(msg: ProveOwnership) {
        throwUnless(ERROR_NOT_SBT_OWNER, sender() == self.owner);
        throwUnless(ERROR_SBT_REVOKED, self.revokedAt == 0);

        message(MessageParameters {
            to: msg.dest,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: OwnershipProof {
                queryId: msg.queryId,
                itemId: self.itemIndex,
                owner: self.owner,
                data: msg.forwardPayload,
                revokedAt: self.revokedAt,
                content: msg.withContent ? self.individualContent : null,
            }.toCell(),
        });
    }

    receive(msg: Destroy) {
        throwUnless(ERROR_NOT_INITIALIZED, self.isInitialized);
        throwUnless(ERROR_NOT_SBT_OWNER, sender() == self.owner);
        
        message(MessageParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero,
            bounce: false,
            body: Excesses{
                queryId: msg.queryId
            }.toCell()
        });
    }

    receive(msg: Revoke) {
        throwUnless(ERROR_NOT_COLLECTION_OWNER, sender() == self.authorityAddress);
        throwUnless(ERROR_ALREADY_REVOKED, self.revokedAt == 0);
        
        self.revokedAt = now();
    }

    receive(msg: RequestOwner) {
        throwUnless(ERROR_SBT_REVOKED, self.revokedAt == 0);
        
        message(MessageParameters {
            to: msg.dest,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: OwnerInfo {
                queryId: msg.queryId,
                itemId: self.itemIndex,
                initiator: sender(),
                owner: self.owner!!,
                data: msg.forwardPayload,
                revokedAt: self.revokedAt,
                content: msg.withContent ? self.individualContent : null,
            }.toCell(),
        });
    }

    receive(msg: GetStaticData) {
        message(MessageParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            bounce: false,
            body: ReportStaticData{
                queryId: msg.queryId,
                index: self.itemIndex,
                collection: self.collectionAddress
            }.toCell()
        });
    }

    bounced(msg: bounced<OwnershipProof>) {
        throwUnless(ERROR_NOT_INITIALIZED, self.isInitialized);
        
        message(MessageParameters{
            to: self.owner!!,
            value: 0,
            mode: SendRemainingValue | SendIgnoreErrors,
            bounce: false,
            body: OwnershipProofBounced{
                queryId: msg.queryId
            }.toCell()
        });
    }

    get fun get_nft_data(): NftData {
        return NftData {
            isInitialized: self.isInitialized,
            index: self.itemIndex,
            collectionAddress: self.collectionAddress,
            ownerAddress: self.owner,
            content: self.individualContent,
        };
    }

    get fun get_revoked_time(): Int {
        return self.revokedAt;
    }

    get fun is_revoked(): Bool {
        return self.revokedAt > 0;
    }

    get fun get_authority(): Address {
        return self.authorityAddress!!;
    }
}
