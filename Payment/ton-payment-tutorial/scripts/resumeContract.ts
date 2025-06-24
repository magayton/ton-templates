import { Address, toNano } from '@ton/core';
import { TONPaymentHandler } from '../build/TONPaymentHandler/TONPaymentHandler_TONPaymentHandler';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Resuming TON Payment Handler contract...');

    // Contract address (replace with your deployed contract address)
    const contractAddress = Address.parse('CONTRACT_ADDRESS_HERE');
    const payment = provider.open(TONPaymentHandler.fromAddress(contractAddress));

    try {
        // Send resume message (owner only)
        await payment.send(
            provider.sender(),
            {
                value: toNano('0.05') // Gas for resume operation
            },
            'Resume' // String message for Resumable trait
        );

    } catch (error) {
        console.error('Contract resume failed:', error);
        return;
    }

    console.log('Contract resume command sent successfully!');
}