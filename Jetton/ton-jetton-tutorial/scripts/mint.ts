import { toNano, Address, beginCell } from '@ton/core';
import { JettonMaster } from '../build/JettonMaster/JettonMaster_JettonMaster';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Minting Jetton tokens...');

    // Replace with your deployed Jetton Master contract address
    const jettonMasterAddress = Address.parse('YOUR_CONTRACT_ADDRESS_HERE');
    const jettonMaster = provider.open(JettonMaster.fromAddress(jettonMasterAddress));

    // Replace with the recipient address
    const recipientAddress = Address.parse('RECIPIENT_ADDRESS_HERE');
    
    // Amount to mint (in nanotons for convenience)
    const mintAmount = toNano('1000'); // 1000 tokens

    const queryId = 0n;

    try {
        await jettonMaster.send(
            provider.sender(),
            {
                value: toNano('0.5'), // Gas for deployment and operations
            },
            {
                $$type: 'Mint',
                queryId: queryId,
                amount: mintAmount,
                to: recipientAddress,
                responseDestination: provider.sender().address!,
                customPayload: null,
                forwardTonAmount: toNano('0.1'), // TON amount for transfer notification
                forwardPayload: beginCell().endCell().asSlice()
            }
        );
    }
    catch (error) {
        console.error('Mint failed:', error);
        return;
    }

    console.log('Jetton tokens minted successfully!');
}