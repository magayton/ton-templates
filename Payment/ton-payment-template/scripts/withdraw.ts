import { toNano, Address } from '@ton/core';
import { Payment } from '../build/Payment/Payment_Payment';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Withdrawing from Payment contract ...');

    const contractAddress = Address.parse('CONTRACT_ADDRESS_HERE');
    const payment = provider.open(Payment.fromAddress(contractAddress));

    const isDeployed = await provider.isContractDeployed(payment.address);
    if (!isDeployed) {
        console.log('Contract not deployed yet. Please deploy first.');
        return;
    }

    const availableBalance = await payment.getAvailableBalance();
    console.log('Available balance for withdrawal:', availableBalance.toString(), 'nanoTON');


    const withdrawAmount = toNano('AMOUNT_HERE');
    const destination = Address.parse('DESTINATION_ADDRESS_HERE');

    if (withdrawAmount > availableBalance) {
        console.error('Withdrawal amount exceeds available balance.');
        return;
    }

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