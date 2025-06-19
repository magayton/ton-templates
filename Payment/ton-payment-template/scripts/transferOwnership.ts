import { toNano, Address } from '@ton/core';
import { Payment } from '../build/Payment/Payment_Payment';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Transferring ownership of Payment contract ...');

    const payment = provider.open(await Payment.fromInit(provider.sender().address!, false));

    console.log('Contract address:', payment.address.toString());

    const isDeployed = await provider.isContractDeployed(payment.address);
    if (!isDeployed) {
        console.log('Contract not deployed yet. Please deploy first.');
        return;
    }

    // Set new owner address (replace with actual address)
    const newOwnerAddress = Address.parse('EQD4FPq-PRDieaQKkizFPRtSDyucUIqrj0v_zXJmqaDp6_0t');
    
    console.log('Transferring ownership to:', newOwnerAddress.toString());

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