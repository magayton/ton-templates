import { Address, toNano } from '@ton/core';
import { TONPaymentHandler } from '../build/TONPaymentHandler/TONPaymentHandler_TONPaymentHandler';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('💸 Withdrawing from TON Payment Handler...');
    
    // Contract address (replace with your deployed contract address)
    const contractAddress = Address.parse('kQDhFNocZIru9_IB1h66RmFjy6j7KhFMlX7qsYWiapaQ5ny4');
    const payment = provider.open(TONPaymentHandler.fromAddress(contractAddress));

    // Withdrawal parameters
    const withdrawAmount = toNano('0.1'); // 0.8 TON
    const destinationAddress = Address.parse('0QCxbHUYTYL-iQam3tOEnjZIxS-CJ9sh0C_FM1ucBpIYMG--'); // Your wallet address
    const comment = 'Withdrawal to owner wallet';

    console.log('Contract address:', contractAddress.toString());
    console.log('Withdraw amount:', withdrawAmount.toString(), 'nanoTON');
    console.log('Destination:', destinationAddress.toString());
    console.log('Comment:', comment);

    try {
        // Withdrawal message
        await payment.send(
            provider.sender(),
            { 
                value: toNano('0.1') // Gas for withdrawal
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
    }

    console.log('Withdrawal sent successfully!');
}