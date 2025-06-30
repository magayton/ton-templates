import { toNano, Address, beginCell } from '@ton/core';
import { JettonMaster } from '../build/JettonMaster/JettonMaster_JettonMaster';
import { JettonWallet } from '../build/JettonWallet/JettonWallet_JettonWallet';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Transferring Jetton tokens...');

    // Replace with your deployed Jetton Master contract address
    const jettonMasterAddress = Address.parse('YOUR_CONTRACT_ADDRESS_HERE');
    const jettonMaster = provider.open(JettonMaster.fromAddress(jettonMasterAddress));

    // Get sender's wallet address
    const senderWalletAddress = await jettonMaster.getGetWalletAddress(provider.sender().address!);
    const senderWallet = provider.open(JettonWallet.fromAddress(senderWalletAddress));

    // Replace with the destination address
    const destinationAddress = Address.parse('RECIPIENT_TRANSFER_HERE');

    // Amount to transfer
    const transferAmount = toNano('100');

    const queryId = 0n;

    // If the transfer is for a user wallet, use 0 in forwardTonAmount because it does not handle the message
    // If the transfer is for a DEX Contract, staking ... it can be used (or a contract handling the message)
    try {
        await senderWallet.send(
            provider.sender(),
            {
                value: toNano('0.4'), // Gas for transfer operations (0.2 too low)
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