import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { SoulboundCollection } from '../build/SoulboundCollection/SoulboundCollection_SoulboundCollection';
import '@ton/test-utils';

describe('SoulboundCollection', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let soulboundCollection: SandboxContract<SoulboundCollection>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        soulboundCollection = blockchain.openContract(await SoulboundCollection.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await soulboundCollection.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            null,
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: soulboundCollection.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and soulboundCollection are ready to use
    });
});
