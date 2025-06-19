import { Address, toNano } from '@ton/core';
import { TONPaymentHandler } from '../build/TONPaymentHandler/TONPaymentHandler_TONPaymentHandler';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('👑 Transferring contract ownership...');
    
    // Contract address (replace with your deployed contract address)
    const contractAddress = Address.parse('kQDhFNocZIru9_IB1h66RmFjy6j7KhFMlX7qsYWiapaQ5ny4');
    const payment = provider.open(TONPaymentHandler.fromAddress(contractAddress));

    // New owner address (replace with actual address)
    const newOwnerAddress = Address.parse('NewAddressHere');

    console.log('Contract address:', contractAddress.toString());
    console.log('New owner address:', newOwnerAddress.toString());

    try {
        console.log('WARNING: This will permanently transfer contract ownership!');
        console.log('New owner will be:', newOwnerAddress.toString());

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