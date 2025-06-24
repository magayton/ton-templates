import { Address, toNano } from '@ton/core';
import { TONPaymentHandler } from '../build/TONPaymentHandler/TONPaymentHandler_TONPaymentHandler';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Withdrawing from TON Payment Handler...');

    // Contract address (replace with your deployed contract address)
    const contractAddress = Address.parse('CONTRACT_ADDRESS_HERE');
    const payment = provider.open(TONPaymentHandler.fromAddress(contractAddress));

    // Withdrawal parameters
    const withdrawAmount = toNano('0.12');
    const destinationAddress = Address.parse('DESTINATION_WALLET_HERE'); // Your wallet address
    const comment = 'Withdrawal to owner wallet';

    try {
        // Withdrawal message
        await payment.send(
            provider.sender(),
            {
                value: toNano('0.05') // Gas for withdrawal
            },
            {
                $$type: 'Withdraw',
                amount: withdrawAmount,
                destination: destinationAddress,
                comment: comment
            }
        );
    } catch (error) {
        console.error('Withdrawal failed:', error);
        return;
    }

    console.log('Withdrawal sent successfully!');
}