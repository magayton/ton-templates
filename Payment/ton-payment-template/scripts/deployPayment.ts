import { toNano } from '@ton/core';
import { Payment } from '../build/Payment/Payment_Payment';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Deploying TON Payment contract ...');

    const payment = provider.open(await Payment.fromInit(provider.sender().address!, false));

    console.log('Contract address:', payment.address.toString());

    try {
        await payment.send(
            provider.sender(),
            {
                value: toNano('0.05'),
            },
            null,
        );

        await provider.waitForDeploy(payment.address);
    }
    catch (error) {
        console.error('Deployment failed:', error);
        return;
    }

    console.log('Payment contract deployed!');
}
