import { toNano } from '@ton/core';
import { Payment } from '../build/Payment/Payment_Payment';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const payment = provider.open(await Payment.fromInit(BigInt(Math.floor(Math.random() * 10000)), 0n));

    await payment.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        null,
    );

    await provider.waitForDeploy(payment.address);

    console.log('ID', await payment.getId());
}
