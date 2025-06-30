import { toNano, Address, beginCell } from '@ton/core';
import { JettonMaster } from '../build/JettonMaster/JettonMaster_JettonMaster';
import { JettonWallet } from '../build/JettonWallet/JettonWallet_JettonWallet';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Transferring Jetton tokens...');

    const jettonMasterAddress = Address.parse('YOUR_CONTRACT_ADDRESS_HERE');
    const jettonMaster = provider.open(JettonMaster.fromAddress(jettonMasterAddress));

    const senderWalletAddress = await jettonMaster.getGetWalletAddress(provider.sender().address!);
    const senderWallet = provider.open(JettonWallet.fromAddress(senderWalletAddress));

    const destinationAddress = Address.parse('RECIPIENT_TRANSFER_HERE');

    const transferAmount = toNano('100');

    const queryId = 0n;

    try {
        await senderWallet.send(
            provider.sender(),
            {
                value: toNano('0.4'),
            },
            {
                $$type: 'Transfer',
                queryId: queryId,
                amount: transferAmount,
                destination: destinationAddress,
                responseDestination: provider.sender().address!,
                customPayload: null,
                forwardTonAmount: 0n,
                forwardPayload: beginCell().endCell().asSlice()
            }
        );
    }
    catch (error) {
        console.error('Transfer failed:', error);
        return;
    }

    console.log('Jetton tokens transferred successfully!');
}