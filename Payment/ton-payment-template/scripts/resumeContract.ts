import { Address, toNano } from '@ton/core';
import { Payment } from '../build/Payment/Payment_Payment';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Resuming TON Payment Handler contract...');

    const contractAddress = Address.parse('CONTRACT_ADDRESS_HERE');
    const payment = provider.open(Payment.fromAddress(contractAddress));

    try {
        await payment.send(
            provider.sender(),
            {
                value: toNano('0.05')
            },
            'Resume'
        );

    } catch (error) {
        console.error('Contract resume failed:', error);
        return;
    }

    console.log('Contract resume command sent successfully!');
}