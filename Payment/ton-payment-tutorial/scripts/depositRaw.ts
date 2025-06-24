import { Address, toNano } from '@ton/core';
import { TONPaymentHandler } from '../build/TONPaymentHandler/TONPaymentHandler_TONPaymentHandler';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Making a plain TON deposit...');

    // Contract address (replace with your deployed contract address)
    const contractAddress = Address.parse('CONTRACT_ADDRESS_HERE');
    const payment = provider.open(TONPaymentHandler.fromAddress(contractAddress));

    const depositAmount = toNano('0.2');

    try {
        // Send plain TON (no message body)
        await payment.send(
            provider.sender(),
            { value: depositAmount + toNano('0.05') }, // Deposit amount + gas
            null
        );

    } catch (error) {
        console.error('Plain deposit failed:', error);
        return;
    }

    console.log('Plain deposit sent successfully!');
}