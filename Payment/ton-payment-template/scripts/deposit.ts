import { Address, toNano } from '@ton/core';
import { Payment } from '../build/Payment/Payment_Payment';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Making deposit to Payment contract ...');

    const contractAddress = Address.parse('CONTRACT_ADDRESS_HERE');
    const payment = provider.open(Payment.fromAddress(contractAddress));

    const isDeployed = await provider.isContractDeployed(payment.address);
    if (!isDeployed) {
        console.log('Contract not deployed yet. Please deploy first.');
        return;
    }

    const depositAmount = toNano('DEPOSIT_AMOUNT_HERE');

    try {
        await payment.send(
            provider.sender(),
            {
                value: depositAmount,
            },
            null,
        );
    }
    catch (error) {
        console.error('Deposit failed:', error);
        return;
    }

    console.log('Deposit successful!');
}