import { toNano } from '@ton/core';
import { Payment } from '../build/Payment/Payment_Payment';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Making deposit to Payment contract ...');

    const payment = provider.open(await Payment.fromInit(provider.sender().address!, false));

    console.log('Contract address:', payment.address.toString());

    const isDeployed = await provider.isContractDeployed(payment.address);
    if (!isDeployed) {
        console.log('Contract not deployed yet. Please deploy first.');
        return;
    }

    const depositAmount = toNano('1.0');
    console.log('Depositing:', depositAmount.toString(), 'nanoTON');

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