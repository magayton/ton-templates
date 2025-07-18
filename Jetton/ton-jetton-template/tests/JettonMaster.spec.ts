import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Cell, beginCell, Address } from '@ton/core';
import { JettonMaster } from '../build/JettonMaster/JettonMaster_JettonMaster';
import { JettonWallet } from '../build/JettonWallet/JettonWallet_JettonWallet';
import '@ton/test-utils';

describe('JettonMaster', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;
    let jettonMaster: SandboxContract<JettonMaster>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');
        user2 = await blockchain.treasury('user2');

        jettonMaster = blockchain.openContract(
            await JettonMaster.fromInit(
                0n,
                deployer.address,
                'https://example.com/metadata.json',
                true
            )
        );

        const deployResult = await jettonMaster.send(
            deployer.getSender(),
            { value: toNano('0.5') },
            null
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonMaster.address,
            deploy: true,
            success: true
        });
    });

    describe('Deployment', () => {
        it('should deploy correctly with initial parameters', async () => {
            const jettonData = await jettonMaster.getGetJettonData();

            expect(jettonData.totalSupply).toBe(0n);
            expect(jettonData.mintable).toBe(true);
            expect(jettonData.adminAddress.toString()).toBe(deployer.address.toString());

            const expectedContent = beginCell()
                .storeUint(0x01, 8)
                .storeStringTail('https://example.com/metadata.json')
                .endCell();
            expect(jettonData.jettonContent.equals(expectedContent)).toBe(true);
        });

        it('should have correct wallet code', async () => {
            const jettonData = await jettonMaster.getGetJettonData();
            const expectedWalletInit = await JettonWallet.init(0n, jettonMaster.address, deployer.address);
            expect(jettonData.jettonWalletCode.equals(expectedWalletInit.code)).toBe(true);
        });
    });

    describe('Minting and Wallet Deployment', () => {
        it('should mint tokens to new user and deploy wallet', async () => {
            const mintAmount = toNano('100');
            const initialTotalSupply = (await jettonMaster.getGetJettonData()).totalSupply;

            const mintResult = await jettonMaster.send(
                deployer.getSender(),
                { value: toNano('0.5') },
                {
                    $$type: 'Mint',
                    queryId: 0n,
                    amount: mintAmount,
                    to: user1.address,
                    responseDestination: deployer.address,
                    customPayload: null,
                    forwardTonAmount: toNano('0.2'),
                    forwardPayload: beginCell().endCell().asSlice()
                }
            );

            expect(mintResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: jettonMaster.address,
                success: true
            });

            const walletAddress = await jettonMaster.getGetWalletAddress(user1.address);
            expect(mintResult.transactions).toHaveTransaction({
                from: jettonMaster.address,
                to: walletAddress,
                deploy: true,
                success: true
            });

            expect(mintResult.transactions).toHaveTransaction({
                from: jettonMaster.address,
                to: walletAddress,
                body: (body) => {
                    try {
                        const slice = body?.asSlice();
                        if (!slice) return false;
                        const op = slice.loadUint(32);
                        return op === 0x178d4519;
                    } catch {
                        return false;
                    }
                }
            });

            expect(mintResult.transactions).toHaveTransaction({
                from: walletAddress,
                to: user1.address,
                body: (body) => {
                    try {
                        const slice = body?.asSlice();
                        if (!slice) return false;
                        const op = slice.loadUint(32);
                        return op === 0x7362d09c;
                    } catch {
                        return false;
                    }
                }
            });

            expect(mintResult.transactions).toHaveTransaction({
                from: walletAddress,
                to: deployer.address,
                body: (body) => {
                    try {
                        const slice = body?.asSlice();
                        if (!slice) return false;
                        const op = slice.loadUint(32);
                        return op === 0xd53276db;
                    } catch {
                        return false;
                    }
                }
            });

            const jettonData = await jettonMaster.getGetJettonData();
            expect(jettonData.totalSupply).toBe(initialTotalSupply + mintAmount);

            const wallet = blockchain.openContract(JettonWallet.fromAddress(walletAddress));
            const walletData = await wallet.getGetWalletData();
            expect(walletData.balance).toBe(mintAmount);
            expect(walletData.ownerAddress.toString()).toBe(user1.address.toString());
            expect(walletData.jettonMasterAddress.toString()).toBe(jettonMaster.address.toString());

            expect(walletData.jettonWalletCode.equals(jettonData.jettonWalletCode)).toBe(true);
        });

        it('should fail mint when not owner', async () => {
            const mintAmount = toNano('100');

            const mintResult = await jettonMaster.send(
                user1.getSender(),
                { value: toNano('0.5') },
                {
                    $$type: 'Mint',
                    queryId: 0n,
                    amount: mintAmount,
                    to: user1.address,
                    responseDestination: user1.address,
                    customPayload: null,
                    forwardTonAmount: toNano('0.01'),
                    forwardPayload: beginCell().endCell().asSlice()
                }
            );

            expect(mintResult.transactions).toHaveTransaction({
                from: user1.address,
                to: jettonMaster.address,
                success: false,
                exitCode: 132
            });
        });

        it('should fail mint when minting is closed', async () => {
            await jettonMaster.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeMintState',
                    queryId: 0n
                }
            );

            const mintAmount = toNano('100');

            const mintResult = await jettonMaster.send(
                deployer.getSender(),
                { value: toNano('0.5') },
                {
                    $$type: 'Mint',
                    queryId: 0n,
                    amount: mintAmount,
                    to: user1.address,
                    responseDestination: deployer.address,
                    customPayload: null,
                    forwardTonAmount: toNano('0.01'),
                    forwardPayload: beginCell().endCell().asSlice()
                }
            );

            expect(mintResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: jettonMaster.address,
                success: false,
                exitCode: 307
            });
        });

        it('should fail mint with insufficient gas', async () => {
            const mintAmount = toNano('100');

            const mintResult = await jettonMaster.send(
                deployer.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'Mint',
                    queryId: 0n,
                    amount: mintAmount,
                    to: user1.address,
                    responseDestination: deployer.address,
                    customPayload: null,
                    forwardTonAmount: toNano('0.01'),
                    forwardPayload: beginCell().endCell().asSlice()
                }
            );

            expect(mintResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: jettonMaster.address,
                success: false,
                exitCode: 302
            });
        });
    });

    describe('Transfer with Existing Wallets', () => {
        beforeEach(async () => {
            await jettonMaster.send(
                deployer.getSender(),
                { value: toNano('0.5') },
                {
                    $$type: 'Mint',
                    queryId: 0n,
                    amount: toNano('1000'),
                    to: user1.address,
                    responseDestination: deployer.address,
                    customPayload: null,
                    forwardTonAmount: toNano('0.01'),
                    forwardPayload: beginCell().endCell().asSlice()
                }
            );
        });

        it('should transfer tokens between users', async () => {
            const user1JettonWallet = await jettonMaster.getGetWalletAddress(user1.address);
            const user1Wallet = blockchain.openContract(JettonWallet.fromAddress(user1JettonWallet));

            const transferAmount = toNano('100');
            const transferResult = await user1Wallet.send(
                user1.getSender(),
                { value: toNano('0.2') },
                {
                    $$type: 'Transfer',
                    queryId: 0n,
                    amount: transferAmount,
                    destination: user2.address,
                    responseDestination: user1.address,
                    customPayload: null,
                    forwardTonAmount: toNano('0.01'),
                    forwardPayload: beginCell().endCell().asSlice()
                }
            );

            expect(transferResult.transactions).toHaveTransaction({
                from: user1.address,
                to: user1JettonWallet,
                success: true
            });

            const user1WalletData = await user1Wallet.getGetWalletData();
            expect(user1WalletData.balance).toBe(toNano('1000') - transferAmount);

            const user2WalletAddress = await jettonMaster.getGetWalletAddress(user2.address);
            const user2Wallet = blockchain.openContract(JettonWallet.fromAddress(user2WalletAddress));
            const user2WalletData = await user2Wallet.getGetWalletData();
            expect(user2WalletData.balance).toBe(transferAmount);
        });

        it('should fail transfer with insufficient balance', async () => {
            const user1WalletAddress = await jettonMaster.getGetWalletAddress(user1.address);
            const user1Wallet = blockchain.openContract(JettonWallet.fromAddress(user1WalletAddress));

            const transferAmount = toNano('2000');
            const transferResult = await user1Wallet.send(
                user1.getSender(),
                { value: toNano('0.2') },
                {
                    $$type: 'Transfer',
                    queryId: 0n,
                    amount: transferAmount,
                    destination: user2.address,
                    responseDestination: user1.address,
                    customPayload: null,
                    forwardTonAmount: toNano('0.01'),
                    forwardPayload: beginCell().endCell().asSlice()
                }
            );

            expect(transferResult.transactions).toHaveTransaction({
                from: user1.address,
                to: user1WalletAddress,
                success: false,
                exitCode: 303
            });
        });

        it('should fail transfer with insufficient gas', async () => {
            const user1WalletAddress = await jettonMaster.getGetWalletAddress(user1.address);
            const user1Wallet = blockchain.openContract(JettonWallet.fromAddress(user1WalletAddress));

            const transferAmount = toNano('100');
            const transferResult = await user1Wallet.send(
                user1.getSender(),
                { value: toNano('0.01') },
                {
                    $$type: 'Transfer',
                    queryId: 0n,
                    amount: transferAmount,
                    destination: user2.address,
                    responseDestination: user1.address,
                    customPayload: null,
                    forwardTonAmount: toNano('0.01'),
                    forwardPayload: beginCell().endCell().asSlice()
                }
            );

            expect(transferResult.transactions).toHaveTransaction({
                from: user1.address,
                to: user1WalletAddress,
                success: false,
                exitCode: 302
            });
        });
    });

    describe('Burn Operations', () => {
        beforeEach(async () => {
            await jettonMaster.send(
                deployer.getSender(),
                { value: toNano('0.2') },
                {
                    $$type: 'Mint',
                    queryId: 0n,
                    amount: toNano('1000'),
                    to: user1.address,
                    responseDestination: deployer.address,
                    customPayload: null,
                    forwardTonAmount: toNano('0.01'),
                    forwardPayload: beginCell().endCell().asSlice()
                }
            );
        });

        it('should burn tokens and update total supply', async () => {
            const user1WalletAddress = await jettonMaster.getGetWalletAddress(user1.address);
            const user1Wallet = blockchain.openContract(JettonWallet.fromAddress(user1WalletAddress));

            const burnAmount = toNano('100');
            const initialTotalSupply = (await jettonMaster.getGetJettonData()).totalSupply;

            const burnResult = await user1Wallet.send(
                user1.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Burn',
                    queryId: 0n,
                    amount: burnAmount,
                    responseDestination: user1.address,
                    customPayload: null
                }
            );

            expect(burnResult.transactions).toHaveTransaction({
                from: user1.address,
                to: user1WalletAddress,
                success: true
            });

            expect(burnResult.transactions).toHaveTransaction({
                from: user1WalletAddress,
                to: jettonMaster.address,
                success: true
            });

            const user1WalletData = await user1Wallet.getGetWalletData();
            expect(user1WalletData.balance).toBe(toNano('1000') - burnAmount);

            const jettonData = await jettonMaster.getGetJettonData();
            expect(jettonData.totalSupply).toBe(initialTotalSupply - burnAmount);
        });

        it('should fail burn with insufficient balance', async () => {
            const user1WalletAddress = await jettonMaster.getGetWalletAddress(user1.address);
            const user1Wallet = blockchain.openContract(JettonWallet.fromAddress(user1WalletAddress));

            const burnAmount = toNano('2000');
            const burnResult = await user1Wallet.send(
                user1.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Burn',
                    queryId: 0n,
                    amount: burnAmount,
                    responseDestination: user1.address,
                    customPayload: null
                }
            );

            expect(burnResult.transactions).toHaveTransaction({
                from: user1.address,
                to: user1WalletAddress,
                success: false,
                exitCode: 303
            });
        });
    });

    describe('TEP89 Wallet Discovery', () => {
        it('should provide wallet address for valid owner', async () => {
            const provideResult = await jettonMaster.send(
                user1.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ProvideWalletAddress',
                    queryId: 0n,
                    ownerAddress: user1.address,
                    includeAddress: true
                }
            );

            expect(provideResult.transactions).toHaveTransaction({
                from: jettonMaster.address,
                to: user1.address,
                success: true
            });

            expect(provideResult.transactions).toHaveTransaction({
                body: (body) => {
                    try {
                        const slice = body?.asSlice();
                        if (!slice) return false;
                        const op = slice.loadUint(32);
                        return op === 0xd1735400;
                    } catch {
                        return false;
                    }
                }
            });


        });

        it('should fail with insufficient gas', async () => {
            const provideResult = await jettonMaster.send(
                user1.getSender(),
                { value: toNano('0.001') },
                {
                    $$type: 'ProvideWalletAddress',
                    queryId: 0n,
                    ownerAddress: user1.address,
                    includeAddress: true
                }
            );

            expect(provideResult.transactions).toHaveTransaction({
                from: user1.address,
                to: jettonMaster.address,
                success: false
            });
        });
    });

    describe('Admin Operations', () => {
        it('should change metadata URI when owner', async () => {
            const newMetadata = 'https://newexample.com/metadata.json';

            const updateResult = await jettonMaster.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeMetadataUri',
                    queryId: 0n,
                    metadataUri: newMetadata
                }
            );

            expect(updateResult.transactions).toHaveTransaction({
                from: deployer.address,
                to: jettonMaster.address,
                success: true
            });

            const jettonData = await jettonMaster.getGetJettonData();
            const expectedContent = beginCell()
                .storeUint(0x01, 8)
                .storeStringTail(newMetadata)
                .endCell();
            expect(jettonData.jettonContent.equals(expectedContent)).toBe(true);
        });

        it('should fail to change metadata URI when not owner', async () => {
            const newMetadata = 'https://newexample.com/metadata.json';

            const updateResult = await jettonMaster.send(
                user1.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeMetadataUri',
                    queryId: 0n,
                    metadataUri: newMetadata
                }
            );

            expect(updateResult.transactions).toHaveTransaction({
                from: user1.address,
                to: jettonMaster.address,
                success: false,
                exitCode: 132
            });
        });

        it('should toggle mint state when owner', async () => {
            let jettonData = await jettonMaster.getGetJettonData();
            expect(jettonData.mintable).toBe(true);

            await jettonMaster.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeMintState',
                    queryId: 0n
                }
            );

            jettonData = await jettonMaster.getGetJettonData();
            expect(jettonData.mintable).toBe(false);

            await jettonMaster.send(
                deployer.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeMintState',
                    queryId: 0n
                }
            );

            jettonData = await jettonMaster.getGetJettonData();
            expect(jettonData.mintable).toBe(true);
        });

        it('should fail to toggle mint state when not owner', async () => {
            const toggleResult = await jettonMaster.send(
                user1.getSender(),
                { value: toNano('0.05') },
                {
                    $$type: 'ChangeMintState',
                    queryId: 0n
                }
            );

            expect(toggleResult.transactions).toHaveTransaction({
                from: user1.address,
                to: jettonMaster.address,
                success: false,
                exitCode: 132
            });
        });
    });
});