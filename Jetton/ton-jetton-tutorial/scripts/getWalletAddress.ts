import { toNano, Address } from '@ton/core';
import { JettonMaster } from '../build/JettonMaster/JettonMaster_JettonMaster';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Getting Jetton wallet address (TEP89)...');

    // Replace with your deployed Jetton Master contract address
    const jettonMasterAddress = Address.parse('YOUR_JETTON_MASTER_ADDRESS_HERE');
    const jettonMaster = provider.open(JettonMaster.fromAddress(jettonMasterAddress));

    // Replace with the owner address to get wallet for
    const ownerAddress = Address.parse('OWNER_ADDRESS_HERE');

    const queryId = 0n;

    try {
        // Method 1: Direct get method (faster, no transaction)
        console.log('=== Method 1: Direct get method ===');
        const walletAddress = await jettonMaster.getGetWalletAddress(ownerAddress);
        console.log(`Wallet address for ${ownerAddress.toString()}: ${walletAddress.toString()}`);

        // Method 2: TEP89 ProvideWalletAddress message (creates transaction)
        console.log('\n=== Method 2: TEP89 ProvideWalletAddress ===');
        await jettonMaster.send(
            provider.sender(),
            {
                value: toNano('0.01'), // Minimum gas for TEP89
            },
            {
                $$type: 'ProvideWalletAddress',
                queryId: queryId,
                ownerAddress: ownerAddress,
                includeAddress: true
            }
        );

        console.log('ProvideWalletAddress transaction sent!');
        console.log('Check the transaction result for TakeWalletAddress message response.');
    }
    catch (error) {
        console.error('Get wallet address failed:', error);
        return;
    }

    console.log('Wallet address retrieval completed!');
}