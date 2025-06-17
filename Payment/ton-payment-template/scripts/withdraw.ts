import { toNano, Address } from '@ton/core';
import { Payment } from '../build/Payment/Payment_Payment';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Withdrawing from Payment contract ...');

    const payment = provider.open(await Payment.fromInit());

    console.log('Contract address:', payment.address.toString());

    const isDeployed = await provider.isContractDeployed(payment.address);
    if (!isDeployed) {
        console.log('Contract not deployed yet. Please deploy first.');
        return;
    }

    const availableBalance = await payment.getAvailableBalance();
    console.log('Available balance for withdrawal:', availableBalance.toString(), 'nanoTON');

    const withdrawAmount = toNano('0.5');
    const destination = provider.sender().address!; 

    if (withdrawAmount > availableBalance) {
        console.error('Withdrawal amount exceeds available balance.');
        return;
    }

    console.log('Withdrawing:', withdrawAmount.toString(), 'nanoTON');
    console.log('To address:', destination.toString());

    try {
        await payment.send(
            provider.sender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Withdraw',
                amount: withdrawAmount,
                destination: destination,
            }
        );
    } catch (error) {
        console.error('Withdrawal failed:', error);
        return;
    }

    console.log('Withdrawal successful!');
}