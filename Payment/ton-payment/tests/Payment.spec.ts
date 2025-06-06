import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { Payment } from '../build/Payment/Payment_Payment';
import '@ton/test-utils';

describe('Payment', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let payment: SandboxContract<Payment>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        payment = blockchain.openContract(await Payment.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await payment.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            null,
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: payment.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and payment are ready to use
    });
});
