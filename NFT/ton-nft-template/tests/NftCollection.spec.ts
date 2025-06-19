import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, beginCell, Address } from '@ton/core';
import { NftCollection, loadMintExecuted, loadBurnExecuted } from '../build/NftCollection/NftCollection_NftCollection';
import { NftItem } from '../build/NftCollection/NftCollection_NftItem';
import '@ton/test-utils';

describe('NFTCollection', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;
    let nFTCollection: SandboxContract<NftCollection>;
    
    // Collection parameters
    const nextItemIndex = 0n;
    const royaltyParams = {
        $$type: 'RoyaltyParams' as const,
        numerator: 50n, // 50 = 5% (bigint required by TypeScript interface)
        denominator: 1000n, 
        destination: Address.parse('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c')
    };

    const COLLECTION_NAME = 'My NFT Collection';
    const COLLECTION_DESCRIPTION = 'A collection of unique NFTs';
    const COLLECTION_URI = 'https://example.com/collection.png';
    const collectionContent = beginCell().storeStringTail(COLLECTION_NAME).storeStringRefTail(COLLECTION_DESCRIPTION).storeStringRefTail(COLLECTION_URI).endCell();

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        
        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');
        user2 = await blockchain.treasury('user2');

        nFTCollection = blockchain.openContract(
            await NftCollection.fromInit(
                nextItemIndex,
                deployer.address,
                royaltyParams,
                collectionContent
            )
        );

        const deployResult = await nFTCollection.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            null,
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: nFTCollection.address,
            deploy: true,
            success: true,
        });
    });

    describe('Deployment', () => {
        it('should deploy successfully', async () => {
            const collectionData = await nFTCollection.getGetCollectionData();
            
            expect(collectionData.nextItemIndex).toBe(nextItemIndex);
            expect(collectionData.ownerAddress).toEqualAddress(deployer.address);
            expect(collectionData.collectionContent.equals(collectionContent)).toBe(true);
        });

        it('should have correct royalty parameters', async () => {
            const royalty = await nFTCollection.getRoyaltyParams();
            
            expect(royalty?.numerator).toBe(royaltyParams.numerator);
            expect(royalty?.denominator).toBe(royaltyParams.denominator);
            expect(royalty?.destination).toEqualAddress(royaltyParams.destination);
        });
    });

    describe('Minting', () => {
        it('should mint NFT successfully', async () => {
            const mintResult = await nFTCollection.send(
                user1.getSender(),
                {
                    value: toNano('0.1'),
                },
                {
                    $$type: 'Mint'
                }
            );

            expect(mintResult.transactions).toHaveTransaction({
                from: user1.address,
                to: nFTCollection.address,
                success: true,
            });

            // Check collection data updated
            const collectionData = await nFTCollection.getGetCollectionData();
            expect(collectionData.nextItemIndex).toBe(1n);
        });

        it('should deploy NFT item contract on mint', async () => {
            const mintResult = await nFTCollection.send(
                user1.getSender(),
                {
                    value: toNano('0.1'),
                },
                {
                    $$type: 'Mint'
                }
            );

            const nftAddress = await nFTCollection.getGetNftAddressByIndex(0n);
            expect(nftAddress).toBeDefined();

            // Check NFT item was deployed
            expect(mintResult.transactions).toHaveTransaction({
                from: nFTCollection.address,
                to: nftAddress,
                deploy: true,
                success: true,
            });

            // Verify MintExecuted event was emitted
            expect(mintResult.externals).toHaveLength(1);
            const mintBody = mintResult.externals[0].body;
            const mintEvent = loadMintExecuted(mintBody.asSlice());
            expect(mintEvent.minter).toEqualAddress(user1.address);
            expect(mintEvent.itemId).toBe(0n);
        });

        it('should handle multiple mints', async () => {

            await nFTCollection.send(
                user1.getSender(),
                { value: toNano('0.1') },
                { $$type: 'Mint' }
            );

            await nFTCollection.send(
                user2.getSender(),
                { value: toNano('0.1') },
                { $$type: 'Mint' }
            );

            const collectionData = await nFTCollection.getGetCollectionData();
            expect(collectionData.nextItemIndex).toBe(2n);
        });

        it('should require sufficient gas for minting', async () => {
            const mintResult = await nFTCollection.send(
                user1.getSender(),
                {
                    value: toNano('0.01'), // Too low
                },
                {
                    $$type: 'Mint'
                }
            );

            expect(mintResult.transactions).toHaveTransaction({
                from: user1.address,
                to: nFTCollection.address,
                success: false,
            });
        });
    });

    describe('Royalty Handling', () => {
        it('should respond to royalty parameter requests', async () => {
            const result = await nFTCollection.send(
                user1.getSender(),
                {
                    value: toNano('0.01'),
                },
                {
                    $$type: 'GetRoyaltyParams',
                    queryId: 12345n
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: nFTCollection.address,
                success: true,
            });

            // Check response message
            expect(result.transactions).toHaveTransaction({
                from: nFTCollection.address,
                to: user1.address,
                op: 0xa8cb00ad, // ReportRoyaltyParams
                success: true,
            });
        });
    });

    describe('Getter Methods', () => {
        it('should return correct collection data', async () => {
            const data = await nFTCollection.getGetCollectionData();
            
            expect(data.nextItemIndex).toBe(0n);
            expect(data.ownerAddress).toEqualAddress(deployer.address);
            expect(data.collectionContent.equals(collectionContent)).toBe(true);
        });

        it('should generate NFT content correctly', async () => {
            const individualContent = beginCell().storeStringTail('individual.json').endCell();
            const content = await nFTCollection.getGetNftContent(0n, individualContent);
            
            expect(content).toBeDefined();
        });

        it('should calculate NFT address by index', async () => {
            const address = await nFTCollection.getGetNftAddressByIndex(0n);
            expect(address).toBeDefined();
            
            // Different indices should give different addresses
            const address2 = await nFTCollection.getGetNftAddressByIndex(1n);
            expect(address?.toString()).not.toBe(address2?.toString());
        });

        it('should return NFT item init code', async () => {
            const initCode = await nFTCollection.getGetNftItemInit(0n);
            expect(initCode).toBeDefined();
            expect(initCode.code).toBeDefined();
            expect(initCode.data).toBeDefined();
        });
    });

    describe('NFT Item Integration', () => {
        it('should create functional NFT items', async () => {
            await nFTCollection.send(
                user1.getSender(),
                { value: toNano('0.1') },
                { $$type: 'Mint' }
            );

            const nftAddress = await nFTCollection.getGetNftAddressByIndex(0n);
            const nftItem = blockchain.openContract(NftItem.fromAddress(nftAddress!));

            // Check NFT data
            const nftData = await nftItem.getGetNftData();
            expect(nftData.init).toBe(true);
            expect(nftData.index).toBe(0n);
            expect(nftData.collectionAddress).toEqualAddress(nFTCollection.address);
            expect(nftData.ownerAddress).toEqualAddress(user1.address);
        });
    });

    describe('NFT Transfer', () => {
        beforeEach(async () => {
            await nFTCollection.send(
                user1.getSender(),
                { value: toNano('0.1') },
                { $$type: 'Mint' }
            );
        });

        it('should transfer NFT to new owner', async () => {
            const nftAddress = await nFTCollection.getGetNftAddressByIndex(0n);
            const nftItem = blockchain.openContract(NftItem.fromAddress(nftAddress));

            // Transfer NFT from user1 to user2
            const transferResult = await nftItem.send(
                user1.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Transfer',
                    queryId: 0n,
                    newOwner: user2.address,
                    responseDestination: user1.address,
                    customPayload: null,
                    forwardAmount: 0n,
                    forwardPayload: beginCell().endCell().asSlice()
                }
            );

            expect(transferResult.transactions).toHaveTransaction({
                from: user1.address,
                to: nftAddress,
                success: true,
            });

            // Check new owner
            const nftData = await nftItem.getGetNftData();
            expect(nftData.ownerAddress).toEqualAddress(user2.address);
        });

        it('should prevent transfer from non-owner', async () => {
            const nftAddress = await nFTCollection.getGetNftAddressByIndex(0n);
            const nftItem = blockchain.openContract(NftItem.fromAddress(nftAddress));

            // Try to transfer from user2 (non-owner)
            const transferResult = await nftItem.send(
                user2.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Transfer',
                    queryId: 0n,
                    newOwner: user2.address,
                    responseDestination: user2.address,
                    customPayload: null,
                    forwardAmount: 0n,
                    forwardPayload: beginCell().endCell().asSlice()
                }
            );

            expect(transferResult.transactions).toHaveTransaction({
                from: user2.address,
                to: nftAddress,
                success: false,
            });
        });
    });

    describe('NFT Burning', () => {
        beforeEach(async () => {
            await nFTCollection.send(
                user1.getSender(),
                { value: toNano('0.1') },
                { $$type: 'Mint' }
            );
        });

        it('should burn NFT successfully', async () => {
            const nftAddress = await nFTCollection.getGetNftAddressByIndex(0n);

            // Burn NFT (only owner can call this)
            const burnResult = await nFTCollection.send(
                deployer.getSender(),
                {
                    value: toNano('0.1'),
                },
                {
                    $$type: 'Burn',
                    queryId: 123n,
                    itemIndex: 0n
                }
            );

            expect(burnResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: nFTCollection.address,
                success: true,
            });

            // Check burn message was sent to NFT item
            expect(burnResult.transactions).toHaveTransaction({
                from: nFTCollection.address,
                to: nftAddress,
                success: true,
            });

            // Verify BurnExecuted event was emitted
            expect(burnResult.externals).toHaveLength(1);
            const burnBody = burnResult.externals[0].body;
            const burnEvent = loadBurnExecuted(burnBody.asSlice());
            expect(burnEvent.burner).toEqualAddress(deployer.address);
            expect(burnEvent.itemId).toBe(0n);
        });

        it('should prevent burn from non-owner', async () => {
            const burnResult = await nFTCollection.send(
                user1.getSender(),
                {
                    value: toNano('0.1'),
                },
                {
                    $$type: 'Burn',
                    queryId: 123n,
                    itemIndex: 0n
                }
            );

            expect(burnResult.transactions).toHaveTransaction({
                from: user1.address,
                to: nFTCollection.address,
                success: false,
            });
        });

        it('should prevent burn of non-existent NFT', async () => {
            const burnResult = await nFTCollection.send(
                deployer.getSender(),
                {
                    value: toNano('0.1'),
                },
                {
                    $$type: 'Burn',
                    queryId: 123n,
                    itemIndex: 999n // Non-existent index
                }
            );

            expect(burnResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: nFTCollection.address,
                success: false,
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle plain TON transfers', async () => {
            let user1BalanceBefore = await user1.getBalance();

            const result = await nFTCollection.send(
                user1.getSender(),
                { value: toNano('0.1') },
                null
            );

            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: nFTCollection.address,
                success: true,
                value: toNano('0.1'),
            });

            // Should send (most) of the value back to user1
            expect(result.transactions).toHaveTransaction({
                from: nFTCollection.address,
                to: user1.address,
                success: true,
            });

            // User1 should have received most of the value back
            let user1Balance = await user1.getBalance();
            expect(user1Balance).toBeGreaterThan(user1BalanceBefore - toNano('0.1'));
        });
    });
});
