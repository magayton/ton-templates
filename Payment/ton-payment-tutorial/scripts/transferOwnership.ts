import { Address, toNano } from '@ton/core';
import { TONPaymentHandler } from '../build/TONPaymentHandler/TONPaymentHandler_TONPaymentHandler';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Transferring contract ownership...');

    // Contract address (replace with your deployed contract address)
    const contractAddress = Address.parse('CONTRACT_ADDRESS_HERE');
    const payment = provider.open(TONPaymentHandler.fromAddress(contractAddress));

    // New owner address (replace with actual address)
    const newOwnerAddress = Address.parse('NEW_OWNER_ADDRESS_HERE');

    try {
        // Send transfer ownership message
        await payment.send(
            provider.sender(),
            {
                value: toNano('0.05') // Gas for ownership transfer
            },
            {
                $$type: 'TransferOwnership',
                newOwner: newOwnerAddress
            }
        );

    } catch (error) {
        console.error('Ownership transfer failed:', error);
        return;
    }

    console.log('Ownership transfer sent successfully!');
}