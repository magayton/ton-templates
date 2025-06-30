import { Address } from '@ton/core';
import { JettonMaster } from '../build/JettonMaster/JettonMaster_JettonMaster';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Getting Jetton wallet address ...');

    // Replace with your deployed Jetton Master contract address
    const jettonMasterAddress = Address.parse('YOUR_JETTON_MASTER_ADDRESS_HERE');
    const jettonMaster = provider.open(JettonMaster.fromAddress(jettonMasterAddress));

    // Replace with the owner address to get wallet for
    const ownerAddress = Address.parse('OWNER_ADDRESS_HERE');

    const queryId = 0n;

    try {
        const walletAddress = await jettonMaster.getGetWalletAddress(ownerAddress);
        console.log(`Wallet address for ${ownerAddress.toString()}: ${walletAddress.toString()}`);

    }
    catch (error) {
        console.error('Get wallet address failed:', error);
        return;
    }

    console.log('Wallet address retrieval completed!');
}