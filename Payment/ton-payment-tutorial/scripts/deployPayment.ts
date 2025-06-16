import { toNano } from '@ton/core';
import { TONPaymentHandler } from '../build/TONPaymentHandler/TONPaymentHandler_TONPaymentHandler';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Deploying TON Payment Handler...');
    
    // No param needed since contract use "sender()" as owner
    const payment = provider.open(
        await TONPaymentHandler.fromInit()
    );

    console.log('Contract address:', payment.address.toString());

    // Use "send" method to deploy
    // https://docs.tact-lang.org/book/gas-best-practices/#do-not-deploy-contracts-with-deployable-trait
    await payment.send(
        provider.sender(),
        { value: toNano('0.1') },
        null
    );

    await provider.waitForDeploy(payment.address);
    console.log('✅ Payment contract deployed!');
}