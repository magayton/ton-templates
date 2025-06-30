import { toNano, Address, beginCell } from '@ton/core';
import { JettonMaster } from '../build/JettonMaster/JettonMaster_JettonMaster';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Minting Jetton tokens...');

    const jettonMasterAddress = Address.parse('YOUR_CONTRACT_ADDRESS_HERE');
    const jettonMaster = provider.open(JettonMaster.fromAddress(jettonMasterAddress));

    const recipientAddress = Address.parse('RECIPIENT_ADDRESS_HERE');

    const mintAmount = toNano('1000');

    const queryId = 0n;

    try {
        await jettonMaster.send(
            provider.sender(),
            {
                value: toNano('0.5'),
            },
            {
                $$type: 'Mint',
                queryId: queryId,
                amount: mintAmount,
                to: recipientAddress,
                responseDestination: provider.sender().address!,
                customPayload: null,
                forwardTonAmount: toNano('0.1'),
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