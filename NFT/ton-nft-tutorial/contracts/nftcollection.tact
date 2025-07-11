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
    collectionContent: Cell,
) {
    // Simple deployment receiver
    // Could use cashback(sender()) but that would not leave much tokens for the contract
    receive() {
        let value = context().value;
        message(MessageParameters {
            to: sender(),
            value: value - MIN_TON_FOR_STORAGE, // Keep minimum for storage
            mode: SendIgnoreErrors,
            bounce: false,
        });
    }

    // Public mint function (the user mints for himself)
    // Each NFT item is a separate contract, so we deploy it with its own init code.
    // It is a separate contract to avoid infinite growth of the collection contract with a Map<User->NFT>
    // The more storage you have, the more rent you pay
    // Using deploy message : https://docs.tact-lang.org/ref/core-send/#deploy
    // https://docs.tact-lang.org/book/gas-best-practices/#use-deploy-function-for-on-chain-deployments

    receive(msg: Mint) {
        throwUnless(ERROR_INVALID_INDEX, self.nextItemIndex >= 0);
        // Take storage fees from the message value
        let msgValue: Int = calculateStorageFee(context().value, myBalance());
        let sender = sender();

        deploy(DeployParameters {
            init: initOf NftItem(
                myAddress(), // collectionAddress
                self.nextItemIndex,
            ), // itemIndex
            mode: SendIgnoreErrors,
            value: msgValue,
            body: Transfer {
                queryId: msg.queryId,
                newOwner: sender,
                responseDestination: self.ownerAddress,
                customPayload: msg.itemContent,
                forwardAmount: 0,
                forwardPayload: emptySlice(), // https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md#forward_payload-format
            }.toCell(),
        });

        emit(MintExecuted {
            minter: sender,
            itemId: self.nextItemIndex,
        }.toCell());

        self.nextItemIndex += 1;
    }

    // Burn NFT
    // Here it is the collection owner that can burn NFT
    // If you want to allow the NFT owner to burn it, you can add a "caller" parameter to the Burn message
    // And remove the check for the owner address to be the collection owner
    receive(msg: Burn) {
        throwUnless(ERROR_NOT_OWNER, sender() == self.ownerAddress);
        throwUnless(ERROR_INVALID_INDEX, msg.itemIndex < self.nextItemIndex);

        // Calculate NFT item address
        let nftAddress: Address = self.get_nft_address_by_index(msg.itemIndex);

        // Send burn message to NFT item
        message(MessageParameters {
            to: nftAddress,
            value: ton("0.05"), // Gas for burn operation
            mode: SendPayFwdFeesSeparately,
            bounce: true, // Bounce true to see the failed transaction and get back TONs sent
            body: Burn {
                queryId: msg.queryId,
                itemIndex: msg.itemIndex,
                owner: msg.owner, // The NFT owner address
            }.toCell(),
        });

        emit(BurnExecuted {
            burner: sender(),
            itemId: msg.itemIndex,
        }.toCell());
    }

    // Handle royalty parameter requests
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

    // TEP-62 required get methods
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

    // TEP-66 royalty support
    get fun royalty_params(): RoyaltyParams? {
        return self.royaltyParams;
    }
}

// NFT Item Contract
// Can't be deployed with contract parameters because of TEP-62 requirement :  get_nft_address_by_index(int index)
// If we use contract parameters, we can't use initOf NftItem(collectionAddress, itemIndex, owner, individualContent)
// Because we probably don't know all the parameters when we want to use the get_nft_address_by_index(int index) method.
// So here we use contract state variables and init() function
contract NftItem {
    // Contract state variables
    isInitialized: Bool = false; // Flag to check if the contract is initialized
    collectionAddress: Address; // Address of the NFT collection
    itemIndex: Int; // Index of the NFT item in the collection
    owner: Address?; // Owner of the NFT item (Address? because we do not want it to be mandatory for initialization)
    individualContent: Cell?; // Individual content of the NFT item (Cell? because we do not want it to be mandatory for initialization)

    init(collection_address: Address, item_index: Int) {
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
        }
        // 2. Transfer when the owner wants to transfer the NFT item to another address
        else {
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
                        forwardPayload: msg.forwardPayload, // https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md#forward_payload-format
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

    // Handle burn requests
    receive(msg: Burn) {
        throwUnless(ERROR_NOT_COLLECTION, sender() == self.collectionAddress);

        // Destroy the contract by sending remaining balance to the NFT owner
        // and destroying contract if balance is zero (which will be the case after sending the balance)
        message(MessageParameters {
            to: msg.owner,
            value: 0,
            mode: SendRemainingBalance | SendDestroyIfZero,
            bounce: false,
            body: emptyCell(),
        });
    }

    // Handle get static data requests
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

    // TEP-62 required get method
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

// Standalone function - extracted outside contracts for better performance
fun calculateStorageFee(value: Int, currentBalance: Int): Int {
    let storageFee: Int = MIN_TON_FOR_STORAGE - min(currentBalance, MIN_TON_FOR_STORAGE);
    return value - (storageFee + GAS_MINT);
}
