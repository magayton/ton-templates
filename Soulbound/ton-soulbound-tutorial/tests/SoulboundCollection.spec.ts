import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, beginCell, Address } from '@ton/core';
import { SoulboundCollection } from '../build/SoulboundCollection/SoulboundCollection_SoulboundCollection';
import { SBTItem } from '../build/SoulboundCollection/SoulboundCollection_SBTItem';
import '@ton/test-utils';

describe('SoulboundCollection', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;
    let soulboundCollection: SandboxContract<SoulboundCollection>;

    // https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md#content-representation
    const OFFCHAIN_PREFIX = 0x01;
    const COLLECTION_CONTENT = beginCell()
        .storeInt(OFFCHAIN_PREFIX, 8)
        .storeStringTail('https://example.com/collection/')
        .endCell();
    const ITEM_CONTENT = beginCell().storeStringRefTail('item-test').endCell();

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');
        user2 = await blockchain.treasury('user2');

        soulboundCollection = blockchain.openContract(
            await SoulboundCollection.fromInit(
                0n, // nextItemIndex
                deployer.address, // ownerAddress
                COLLECTION_CONTENT // collectionContent
            )
        );

        const deployResult = await soulboundCollection.send(
            deployer.getSender(),
            {
                value: toNano('0.1'),
            },
            null,
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: soulboundCollection.address,
            deploy: true,
            success: true,
        });
    });

    describe('Deployment', () => {
        it('should return correct collection data after deployment', async () => {
            const collectionData = await soulboundCollection.getGetCollectionData();

            expect(collectionData.nextItemIndex).toBe(0n);
            expect(collectionData.ownerAddress.toString()).toBe(deployer.address.toString());
            expect(collectionData.collectionContent.equals(COLLECTION_CONTENT)).toBe(true);
        });
    });

    describe('Minting', () => {
        it('should allow deployer to mint SBT', async () => {
            const mintResult = await soulboundCollection.send(
                deployer.getSender(),
                { value: toNano('0.2') },
                {
                    $$type: 'Mint',
                    queryId: 1n,
                    to: user1.address,
                    itemContent: ITEM_CONTENT,
                }
            );

            expect(mintResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: soulboundCollection.address,
                success: true,
            });

            // Check that SBT was deployed
            const sbtAddress = await soulboundCollection.getGetNftAddressByIndex(0n);
            expect(mintResult.transactions).toHaveTransaction({
                from: soulboundCollection.address,
                to: sbtAddress,
                deploy: true,
                success: true,
            });

            // Verify collection data updated
            const collectionData = await soulboundCollection.getGetCollectionData();
            expect(collectionData.nextItemIndex).toBe(1n);
        });

        it('should reject mint from non-deployer', async () => {
            const mintResult = await soulboundCollection.send(
                user1.getSender(),
                { value: toNano('0.2') },
                {
                    $$type: 'Mint',
                    queryId: 1n,
                    to: user2.address,
                    itemContent: ITEM_CONTENT,
                }
            );

            expect(mintResult.transactions).toHaveTransaction({
                from: user1.address,
                to: soulboundCollection.address,
                success: false,
                exitCode: 400, // ERROR_NOT_COLLECTION_OWNER
            });
        });

        it('should mint multiple SBTs with correct indices', async () => {
            // Mint first SBT
            await soulboundCollection.send(
                deployer.getSender(),
                { value: toNano('0.2') },
                {
                    $$type: 'Mint',
                    queryId: 1n,
                    to: user1.address,
                    itemContent: ITEM_CONTENT,
                }
            );

            // Mint second SBT
            await soulboundCollection.send(
                deployer.getSender(),
                { value: toNano('0.2') },
                {
                    $$type: 'Mint',
                    queryId: 2n,
                    to: user2.address,
                    itemContent: ITEM_CONTENT,
                }
            );

            const collectionData = await soulboundCollection.getGetCollectionData();
            expect(collectionData.nextItemIndex).toBe(2n);

            // Check addresses are different
            const sbt1Address = await soulboundCollection.getGetNftAddressByIndex(0n);
            const sbt2Address = await soulboundCollection.getGetNftAddressByIndex(1n);
            expect(sbt1Address.toString()).not.toBe(sbt2Address.toString());
        });
    });

    describe('Collection Get Methods', () => {
        beforeEach(async () => {
            await soulboundCollection.send(
                deployer.getSender(),
                { value: toNano('0.2') },
                {
                    $$type: 'Mint',
                    queryId: 1n,
                    to: user1.address,
                    itemContent: ITEM_CONTENT,
                }
            );
        });

        it('should return correct NFT address by index', async () => {
            const sbtAddress = await soulboundCollection.getGetNftAddressByIndex(0n);
            expect(Address.isAddress(sbtAddress)).toBe(true);
        });

        it('should return correct collection data', async () => {
            const data = await soulboundCollection.getGetCollectionData();
            expect(data.nextItemIndex).toBe(1n);
            expect(data.ownerAddress.toString()).toBe(deployer.address.toString());
            expect(data.collectionContent.equals(COLLECTION_CONTENT)).toBe(true);
        });

        it('should return correct NFT content', async () => {
            const content = await soulboundCollection.getGetNftContent(0n, ITEM_CONTENT);

            // The contract uses StringBuilder to concatenate strings from both cells
            // So we need to create the expected content by concatenating the string representations
            const expectedContent = beginCell()
                .storeUint(OFFCHAIN_PREFIX, 8)
                .storeStringTail('https://example.com/collection/item-test')
                .endCell();

            // Compare the cells directly
            expect(content.toString()).toBe(expectedContent.toString());
        });
    });

    describe('Item Get Methods', () => {
        let sbtItem: SandboxContract<SBTItem>;
        let sbtAddress: Address;

        beforeEach(async () => {
            await soulboundCollection.send(
                deployer.getSender(),
                { value: toNano('0.2') },
                {
                    $$type: 'Mint',
                    queryId: 1n,
                    to: user1.address,
                    itemContent: ITEM_CONTENT,
                }
            );

            sbtAddress = await soulboundCollection.getGetNftAddressByIndex(0n);
            sbtItem = blockchain.openContract(SBTItem.fromAddress(sbtAddress));
        });

        it('should return correct NFT data', async () => {
            const nftData = await sbtItem.getGetNftData();

            expect(nftData.isInitialized).toBe(true);
            expect(nftData.index).toBe(0n);
            expect(nftData.collectionAddress.toString()).toBe(soulboundCollection.address.toString());
            expect(nftData.ownerAddress?.toString()).toBe(user1.address.toString());
        });

        it('should return authority address', async () => {
            const authorityAddr = await sbtItem.getGetAuthority();
            expect(authorityAddr.toString()).toBe(deployer.address.toString());
        });

        it('should return correct revocation status for non-revoked SBT', async () => {
            const isRevoked = await sbtItem.getIsRevoked();
            expect(isRevoked).toBe(false);

            const revokedTime = await sbtItem.getGetRevokedTime();
            expect(revokedTime).toBe(0n);
        });

        it('should return correct revocation status after revocation', async () => {
            await sbtItem.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'Revoke',
                    queryId: 1n,
                }
            );

            const isRevoked = await sbtItem.getIsRevoked();
            expect(isRevoked).toBe(true);

            const revokedTime = await sbtItem.getGetRevokedTime();
            expect(revokedTime).toBeGreaterThan(0n);
        });
    });

    describe('SBT Item Functionality', () => {
        let sbtItem: SandboxContract<SBTItem>;
        let sbtAddress: Address;

        beforeEach(async () => {
            await soulboundCollection.send(
                deployer.getSender(),
                { value: toNano('0.2') },
                {
                    $$type: 'Mint',
                    queryId: 1n,
                    to: user1.address,
                    itemContent: ITEM_CONTENT,
                }
            );

            sbtAddress = await soulboundCollection.getGetNftAddressByIndex(0n);
            sbtItem = blockchain.openContract(SBTItem.fromAddress(sbtAddress));
        });

        it('should reject transfer attempts', async () => {
            const transferResult = await sbtItem.send(
                user1.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Transfer',
                    queryId: 1n,
                    newOwner: user2.address,
                    responseDestination: user1.address,
                    customPayload: null,
                    forwardAmount: 0n,
                    forwardPayload: beginCell().endCell().asSlice(),
                }
            );

            expect(transferResult.transactions).toHaveTransaction({
                from: user1.address,
                to: sbtAddress,
                success: false,
                exitCode: 403, // ERROR_SOULBOUND_CANNOT_TRANSFER
            });
        });

        it('should handle prove ownership', async () => {
            const proveResult = await sbtItem.send(
                user1.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'ProveOwnership',
                    queryId: 1n,
                    dest: user2.address,
                    forwardPayload: beginCell().storeUint(123, 32).endCell(),
                    withContent: true,
                }
            );

            expect(proveResult.transactions).toHaveTransaction({
                from: user1.address,
                to: sbtAddress,
                success: true,
            });

            expect(proveResult.transactions).toHaveTransaction({
                from: sbtAddress,
                to: user2.address,
                success: true,
            });
        });

        it('should allow deployer to revoke SBT', async () => {
            const revokeResult = await sbtItem.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'Revoke',
                    queryId: 1n,
                }
            );

            expect(revokeResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: sbtAddress,
                success: true,
            });

            const isRevoked = await sbtItem.getIsRevoked();
            expect(isRevoked).toBe(true);

            const revokedTime = await sbtItem.getGetRevokedTime();
            expect(revokedTime).toBeGreaterThan(0n);
        });

        it('should reject revoke from non-deployer', async () => {
            const revokeResult = await sbtItem.send(
                user1.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'Revoke',
                    queryId: 1n,
                }
            );

            expect(revokeResult.transactions).toHaveTransaction({
                from: user1.address,
                to: sbtAddress,
                success: false,
                exitCode: 400, // ERROR_NOT_COLLECTION_OWNER
            });
        });

        it('should allow owner to destroy SBT', async () => {
            const destroyResult = await sbtItem.send(
                user1.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'Destroy',
                    queryId: 1n,
                }
            );

            expect(destroyResult.transactions).toHaveTransaction({
                from: user1.address,
                to: sbtAddress,
                success: true,
            });

            expect(destroyResult.transactions).toHaveTransaction({
                from: sbtAddress,
                to: user1.address,
                success: true,
            });
        });

        it('should reject destroy from non-owner', async () => {
            const destroyResult = await sbtItem.send(
                user2.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'Destroy',
                    queryId: 1n,
                }
            );

            expect(destroyResult.transactions).toHaveTransaction({
                from: user2.address,
                to: sbtAddress,
                success: false,
                exitCode: 401, // ERROR_NOT_SBT_OWNER
            });
        });

        it('should handle request owner', async () => {
            const requestResult = await sbtItem.send(
                user2.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'RequestOwner',
                    queryId: 1n,
                    dest: user2.address,
                    forwardPayload: beginCell().storeUint(456, 32).endCell(),
                    withContent: false,
                }
            );

            expect(requestResult.transactions).toHaveTransaction({
                from: user2.address,
                to: sbtAddress,
                success: true,
            });

            expect(requestResult.transactions).toHaveTransaction({
                from: sbtAddress,
                to: user2.address,
                success: true,
            });
        });

        it('should handle get static data', async () => {
            const staticDataResult = await sbtItem.send(
                user2.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'GetStaticData',
                    queryId: 1n,
                }
            );

            expect(staticDataResult.transactions).toHaveTransaction({
                from: user2.address,
                to: sbtAddress,
                success: true,
            });

            expect(staticDataResult.transactions).toHaveTransaction({
                from: sbtAddress,
                to: user2.address,
                success: true,
            });
        });

    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle insufficient gas for minting', async () => {
            const mintResult = await soulboundCollection.send(
                deployer.getSender(),
                { value: toNano('0.001') }, // Too low
                {
                    $$type: 'Mint',
                    queryId: 1n,
                    to: user1.address,
                    itemContent: ITEM_CONTENT,
                }
            );

            expect(mintResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: soulboundCollection.address,
                success: false,
            });
        });

        it('should prevent double revocation', async () => {
            await soulboundCollection.send(
                deployer.getSender(),
                { value: toNano('0.2') },
                {
                    $$type: 'Mint',
                    queryId: 1n,
                    to: user1.address,
                    itemContent: ITEM_CONTENT,
                }
            );

            const sbtAddress = await soulboundCollection.getGetNftAddressByIndex(0n);
            const sbtItem = blockchain.openContract(SBTItem.fromAddress(sbtAddress));

            // First revocation should succeed
            await sbtItem.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'Revoke',
                    queryId: 1n,
                }
            );

            // Second revocation should fail
            const secondRevokeResult = await sbtItem.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'Revoke',
                    queryId: 2n,
                }
            );

            expect(secondRevokeResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: sbtAddress,
                success: false,
                exitCode: 406, // ERROR_ALREADY_REVOKED
            });
        });

        it('should reject prove ownership from revoked SBT', async () => {
            await soulboundCollection.send(
                deployer.getSender(),
                { value: toNano('0.2') },
                {
                    $$type: 'Mint',
                    queryId: 1n,
                    to: user1.address,
                    itemContent: ITEM_CONTENT,
                }
            );

            const sbtAddress = await soulboundCollection.getGetNftAddressByIndex(0n);
            const sbtItem = blockchain.openContract(SBTItem.fromAddress(sbtAddress));

            await sbtItem.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'Revoke',
                    queryId: 1n,
                }
            );

            // Try to prove ownership after revocation
            const proveResult = await sbtItem.send(
                user1.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'ProveOwnership',
                    queryId: 2n,
                    dest: user2.address,
                    forwardPayload: beginCell().endCell(),
                    withContent: false,
                }
            );

            expect(proveResult.transactions).toHaveTransaction({
                from: user1.address,
                to: sbtAddress,
                success: false,
                exitCode: 404, // ERROR_SBT_REVOKED
            });
        });
    });
});
