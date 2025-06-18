// NFT Collection Contract
// Implements TEP-62, TEP-64 and TEP-66
// https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md
// https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md
// https://github.com/ton-blockchain/TEPs/blob/master/text/0066-nft-royalty-standard.md

import "./messages.tact";

// Gas and storage constants
const MIN_TON_FOR_STORAGE: Int = ton("0.05"); 
const GAS_MINT: Int = ton("0.02"); // Gas consumption for minting operation

// Deployment using contract parameters (no init() or state variables)
// https://docs.tact-lang.org/book/gas-best-practices/#do-not-deploy-contracts-with-deployable-trait
// https://docs.tact-lang.org/book/gas-best-practices/#prefer-contract-parameters-to-init-and-contract-fields

// Multiple traits could be added here, like:
// - Ownable 
// - Resumable
// - (See https://github.com/magayton/ton-templates/blob/master/Payment/ton-payment-tutorial/contracts/payment.tact)

contract NftCollection(
    nextItemIndex: Int as uint64,
    ownerAddress: Address,
    royaltyParams: RoyaltyParams?,
    collectionContent: Cell
) {

    // Simple deployment receiver
    receive() { cashback(sender()) }

    // Public mint function (the user mints for himself)
    receive(msg: Mint) {
        // Take storage fees from the message value
        let msgValue: Int = calculateStorageFee(context().value, myBalance());
        let sender = sender();
        
        self.mint(sender, msgValue);
        
        emit(MintExecuted{
            minter: sender,
            itemId: self.nextItemIndex,
        }.toCell());
    }

    inline fun mint(senderAddr: Address, msgValue: Int) {
        throwUnless(ERROR_INVALID_INDEX, self.nextItemIndex >= 0);

        // Each NFT item is a separate contract, so we deploy it with its own init code.
        // It is a separate contract to avoid infinite growth of the collection contract with a Map<User->NFT>
        // The more storage you have, the more rent you pay
        // Using deploy message : https://docs.tact-lang.org/ref/core-send/#deploy
        // https://docs.tact-lang.org/book/gas-best-practices/#use-deploy-function-for-on-chain-deployments
        deploy(DeployParameters{
            init: initOf NftItem(
                myAddress(), // collectionAddress
                self.nextItemIndex, // itemIndex  
            ),
            mode: SendIgnoreErrors,
            value: msgValue,
            body: Transfer {
                    queryId: 0,
                    newOwner: senderAddr,
                    responseDestination: self.ownerAddress,
                    customPayload: self.collectionContent, // Collection content by default, you can pass a Cell? in argument and change here
                    forwardAmount: 0,
                    forwardPayload: emptySlice()
            }.toCell(),
        });
        
        self.nextItemIndex += 1;
    }

    // Handle royalty parameter requests
    receive(msg: GetRoyaltyParams) {
        if (self.royaltyParams == null) {
            message(MessageParameters{
                to: sender(),
                value: 0,
                mode: SendRemainingValue,
                bounce: false,
                body: ReportRoyaltyParams{
                    queryId: msg.queryId,
                    numerator: 0,
                    denominator: 1000,
                    destination: self.ownerAddress
                }.toCell()
            });
        } else {
            let royalty: RoyaltyParams = self.royaltyParams!!;
            message(MessageParameters{
                to: sender(),
                value: 0,
                mode: SendRemainingValue,
                bounce: false,
                body: ReportRoyaltyParams{
                    queryId: msg.queryId,
                    numerator: royalty.numerator,
                    denominator: royalty.denominator,
                    destination: royalty.destination
                }.toCell()
            });
        }
    }

    // TEP-62 required get methods
    get fun get_collection_data(): CollectionData {
        return CollectionData{
            nextItemIndex: self.nextItemIndex,
            collectionContent: self.collectionContent,
            ownerAddress: self.ownerAddress
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

    get fun get_nft_address_by_index(itemIndex: Int): Address? {
        let initCode: StateInit = self.getNftItemInit(itemIndex);
        return contractAddress(initCode);
    }

    get fun getNftItemInit(itemIndex: Int): StateInit {
        return initOf NftItem(myAddress(), itemIndex);
    }

    // TEP-66 royalty support
    get fun royalty_params(): RoyaltyParams? {
        return self.royaltyParams;
    }
}

// NFT Item Contract 
// Can't be deployed with contract parameters because of TRE-62 requirement :  get_nft_address_by_index(int index)
// If we use contract parameters, we can't use initOf NftItem(collectionAddress, itemIndex, owner, individualContent)
// Because we probably don't know all the parameters when we want to use the get_nft_address_by_index(int index) method.
// So here we use contract state variables and init() function
contract NftItem
{
    // Contract state variables
    isInitialized: Bool = false;     // Flag to check if the contract is initialized
    collectionAddress: Address; // Address of the NFT collection
    itemIndex: Int;             // Index of the NFT item in the collection
    owner: Address?;            // Owner of the NFT item (Address? because we do not want it to be mandatory for initialization)
    individualContent: Cell?;   // Individual content of the NFT item (Cell? because we do not want it to be mandatory for initialization)

    init(collection_address: Address, item_index: Int){
        throwUnless(ERROR_NOT_COLLECTION, sender() == collection_address);
        self.collectionAddress = collection_address;
        self.itemIndex = item_index;
    }

    // Transfer ownership of the NFT item
    // It has 2 cases: 
    // 1. Initial Transfer when minting 
    // 2. Transfer when the owner wants to transfer the NFT item to another address
    receive(msg: Transfer) {
        let ctx: Context = context();
        let msgValue: Int = calculateStorageFee(ctx.value, myBalance());

        // 1. Initial Transfer when minting
        if (!self.isInitialized) {
            throwUnless(ERROR_NOT_OWNER, sender() == self.collectionAddress);
            self.isInitialized = true;
            self.owner = msg.newOwner;
            self.individualContent = msg.customPayload;
            message(MessageParameters{
                to: msg.responseDestination!!,
                value: msgValue,
                mode: SendPayFwdFeesSeparately,
                bounce: false,
                body: Excesses{queryId: msg.queryId}.toCell()
            });
        }
        // 2. Transfer when the owner wants to transfer the NFT item to another address
        else {
            throwUnless(ERROR_NOT_OWNER, sender() == self.owner);
            self.owner = msg.newOwner; 
            if (msg.forwardAmount > 0) {
                message(MessageParameters {
                    to: msg.newOwner,
                    value: msg.forwardAmount,
                    mode:  SendPayFwdFeesSeparately, 
                    bounce: true,
                    body: OwnershipAssigned{
                        queryId: msg.queryId,
                        prevOwner: sender(),
                        forwardPayload: msg.forwardPayload
                    }.toCell()
                }); 
            }

            msgValue -= ctx.readForwardFee(); 
            if (msg.responseDestination != null) { 
                message(MessageParameters{
                    to: msg.responseDestination!!,
                    value: msgValue,
                    mode: SendPayFwdFeesSeparately,
                    bounce: false,
                    body: Excesses{queryId: msg.queryId}.toCell()
                });
            } 
        }
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

    // TEP-62 required get method
    get fun get_nft_data(): GetNftData {
        return GetNftData{
            init: self.isInitialized,  
            index: self.itemIndex,
            collectionAddress: self.collectionAddress,
            ownerAddress: self.owner,
            individualContent: self.individualContent
        };
    }
}

// Standalone function - extracted outside contracts for better performance
fun calculateStorageFee(value: Int, currentBalance: Int): Int {
    let tonBalanceBeforeMsg: Int = currentBalance - value;
    let storageFee: Int = MIN_TON_FOR_STORAGE - min(tonBalanceBeforeMsg, MIN_TON_FOR_STORAGE);
    return value - (storageFee + GAS_MINT);
}