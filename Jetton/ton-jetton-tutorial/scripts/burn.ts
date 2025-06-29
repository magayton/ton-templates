import { toNano, Address } from '@ton/core';
import { JettonMaster } from '../build/JettonMaster/JettonMaster_JettonMaster';
import { JettonWallet } from '../build/JettonWallet/JettonWallet_JettonWallet';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Burning Jetton tokens...');

    // Replace with your deployed Jetton Master contract address
    const jettonMasterAddress = Address.parse('YOUR_CONTRACT_ADDRESS_HERE');
    const jettonMaster = provider.open(JettonMaster.fromAddress(jettonMasterAddress));

    // Get sender's wallet address
    const senderWalletAddress = await jettonMaster.getGetWalletAddress(provider.sender().address!);
    const senderWallet = provider.open(JettonWallet.fromAddress(senderWalletAddress));

    // Amount to burn
    const burnAmount = toNano('50'); // 50 tokens

    const queryId = 0n;

    try {
        await senderWallet.send(
            provider.sender(),
            {
                value: toNano('0.1'), // Gas for burn operations
            },
            {
                $$type: 'Burn',
                queryId: queryId,
                amount: burnAmount,
                responseDestination: provider.sender().address!,
                customPayload: null
            }
        );
    }
    catch (error) {
        console.error('Burn failed:', error);
        return;
    }

    console.log('Jetton tokens burned successfully!');
}