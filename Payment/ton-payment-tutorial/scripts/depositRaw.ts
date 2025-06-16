import { Address, toNano } from '@ton/core';
import { TONPaymentHandler } from '../build/TONPaymentHandler/TONPaymentHandler_TONPaymentHandler';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('💰 Making a plain TON deposit...');
    
    // Contract address (replace with your deployed contract address)
    const contractAddress = Address.parse('kQDhFNocZIru9_IB1h66RmFjy6j7KhFMlX7qsYWiapaQ5ny4');
    const payment = provider.open(TONPaymentHandler.fromAddress(contractAddress));

    const depositAmount = toNano('0.2'); 

    console.log('Contract address:', contractAddress.toString());
    console.log('Deposit amount:', depositAmount.toString(), 'nanoTON');

    try {
        // Send plain TON (no message body)
        await payment.send(
            provider.sender(),
            { value: depositAmount },
            null 
        );
        
    } catch (error) {
        console.error('Plain deposit failed:', error);
    }

    console.log('Plain deposit sent successfully!');
}