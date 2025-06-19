import { Dictionary, toNano } from '@ton/core';
import { TONPaymentHandler } from '../build/TONPaymentHandler/TONPaymentHandler_TONPaymentHandler';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Deploying TON Payment Handler...');
    
    // Initialize contract with required parameters
    const payment = provider.open(
        await TONPaymentHandler.fromInit(
            provider.sender().address!,  // owner: Address
            false,                       // stopped: Bool
            0n,                         // totalDeposited: Int as coins
            0n,                         // totalWithdrawn: Int as coins
            0n,                          // depositCount: Int as uint32
            Dictionary.empty()           // depositsByAddress: map<Address, Int as coins>
        )
    );

    console.log('Contract address:', payment.address.toString());

    // Use "send" method to deploy
    // https://docs.tact-lang.org/book/gas-best-practices/#do-not-deploy-contracts-with-deployable-trait
    try {
        await payment.send(
            provider.sender(),
            { value: toNano('0.2') }, // 0.1 seems not enough for deployment
            null
        );
        await provider.waitForDeploy(payment.address);
    } catch (error) {
        console.error('Deployment failed:', error);
        return;
    }

    console.log('✅ Payment contract deployed!');
}