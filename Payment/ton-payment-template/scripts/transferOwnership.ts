import { toNano, Address } from '@ton/core';
import { Payment } from '../build/Payment/Payment_Payment';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Transferring ownership of Payment contract ...');

    const contractAddress = Address.parse('CONTRACT_ADDRESS_HERE');
    const payment = provider.open(Payment.fromAddress(contractAddress));


    const isDeployed = await provider.isContractDeployed(payment.address);
    if (!isDeployed) {
        console.log('Contract not deployed yet. Please deploy first.');
        return;
    }

    const newOwnerAddress = Address.parse('NEW_OWNER_ADDRESS');

    try {
        await payment.send(
            provider.sender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'TransferOwnership',
                newOwner: newOwnerAddress,
            }
        );
    } catch (error) {
        console.error('Ownership transfer failed:', error);
        return;
    }

    console.log('Ownership transfer successful!');
}