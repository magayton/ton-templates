import "./messages.tact";

const MIN_TON_FOR_STORAGE: Int = ton("0.05"); 

// Soulbound Collection contract
// https://github.com/ton-blockchain/TEPs/blob/master/text/0085-sbt-standard.md
// It follows the NFT standard interface with some modifications
// Transfer can't be called on it
// It has other endpoints : ProveOwnership, Revoke, OwnershipProof and Destroy
// For NFT standard see : https://github.com/magayton/ton-templates/tree/master/NFT


// Use contract parameters to init
// https://docs.tact-lang.org/book/gas-best-practices/#prefer-contract-parameters-to-init-and-contract-fields
contract SoulboundCollection(
    nextItemIndex: Int as uint32,
    ownerAddress: Address,
    collectionContent: Cell,
) {

    // Simple deployment receiver
    // Could use cashback(sender()) but that would not leave much tokens for the contract
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
        // Only ownerAddress can mint SBTs (As a certificate authority)
        throwUnless(ERROR_NOT_COLLECTION_OWNER, sender() == self.ownerAddress);

        // deploy SBTItem contract and Initialize it (Transfer can't be used for initialization)
        // https://docs.tact-lang.org/book/gas-best-practices/#use-deploy-function-for-on-chain-deployments
        deploy(DeployParameters{
            init: initOf SBTItem(
                myAddress(), 
                self.nextItemIndex,
            ),
            mode: SendIgnoreErrors,
            value: context().value,
            // Use ItemInit instead of Transfer for classic NFT
            body: ItemInit {
                    newOwner: msg.to,
                    content: msg.collectionContent,
                    authorityAddress: self.ownerAddress,
            }.toCell(),
        });

        self.nextItemIndex += 1;
    }

    // NFT Standard - TEP62 required get methods
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

// SBT Item Contract 
// Can't be deployed with contract parameters because of TEP-62 requirement :  get_nft_address_by_index(int index)
// If we use contract parameters, we can't use initOf SBTItem(collectionAddress, itemIndex, owner, individualContent)
// Because we probably don't know all the parameters when we want to use the get_nft_address_by_index(int index) method.
// So here we use contract state variables and init() function
contract SBTItem {

    // Contract state variables
    isInitialized: Bool = false;     // Flag to check if the contract is initialized
    collectionAddress: Address; // Address of the NFT collection
    itemIndex: Int;             // Index of the NFT item in the collection
    owner: Address?;            // Owner of the NFT item (Address? because we do not want it to be mandatory for initialization)
    individualContent: Cell?;   // Individual content of the NFT item (Cell? because we do not want it to be mandatory for initialization)
    authorityAddress: Address?; // Address of the authority that can revoke 
    revokedAt: Int as uint64 = 0; // Time when the SBT was revoked (0 means not revoked)

   init(collection_address: Address, item_index: Int){
        throwUnless(ERROR_NOT_COLLECTION, sender() == collection_address);
        self.collectionAddress = collection_address;
        self.itemIndex = item_index;
        self.isInitialized = true;
    }

    // Message called to init the other state variables (to keep the get_nft_address_by_index(int index) method working)
    receive(msg: ItemInit) {
        throwUnless(ERROR_ALREADY_INITIALIZED, !self.isInitialized);
        throwUnless(ERROR_NOT_COLLECTION, sender() == self.collectionAddress);
        
        self.owner = msg.newOwner;
        self.individualContent = msg.content;
        self.authorityAddress = msg.authorityAddress;
    }

    // Always throw for soulbound behavior
    receive(msg: Transfer) {
        throwUnless(ERROR_SOULBOUND_CANNOT_TRANSFER, false);
    }

    // Allows SBT holder to prove ownership to other contracts
    receive(msg: ProveOwnership) {
        throwUnless(ERROR_NOT_SBT_OWNER, sender() == self.owner);
        throwUnless(ERROR_SBT_REVOKED, self.revokedAt > 0);

        // Send ownership proof to destination
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

    // Equivalent to "Burn" in the NFT implementation but SBT standard use "Destroy"
    // https://github.com/magayton/ton-templates/tree/master/NFT
    receive(msg: Destroy) {
        throwUnless(ERROR_NOT_INITIALIZED, self.isInitialized);
        throwUnless(ERROR_NOT_SBT_OWNER, sender() == self.owner);
        
        // Send remaining balance to owner
        message(MessageParameters{
            to: sender(),
            value: 0,
            // Destroy the contract by sending remaining balance
            mode: SendRemainingBalance | SendDestroyIfZero,
            bounce: false,
            body: Excesses{
                queryId: msg.queryId
            }.toCell()
        });
    }

    // Handle direct revoke message (only collection owner can revoke acting like a certificate authority)
    receive(msg: Revoke) {
        throwUnless(ERROR_NOT_COLLECTION_OWNER, sender() == self.authorityAddress);
        throwUnless(ERROR_ALREADY_REVOKED, self.revokedAt > 0);
        
        // Set revoked_at to current time
        self.revokedAt = now();
    }

    // Allows third parties to request ownership info
    receive(msg: RequestOwner) {
        throwUnless(ERROR_SBT_REVOKED, self.revokedAt > 0);
        
        // Send owner info to destination
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

    // Handle get static data requests
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

    // Handle bounced ownership proof messages
    bounced(msg: bounced<OwnershipProof>) {
        throwUnless(ERROR_NOT_INITIALIZED, self.isInitialized);
        
        // Forward bounced message to owner
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

    // NFT required get method
    get fun get_nft_data(): NftData {
        return NftData {
            isInitialized: self.isInitialized,
            index: self.itemIndex,
            collectionAddress: self.collectionAddress,
            ownerAddress: self.owner,
            content: self.individualContent,
        };
    }

    // SBT-specific get methods
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
