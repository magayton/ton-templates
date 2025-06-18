import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { NftCollection } from '../build/NFTCollection/NFTCollection_NFTCollection';
import '@ton/test-utils';

describe('NFTCollection', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let nFTCollection: SandboxContract<NftCollection>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        nFTCollection = blockchain.openContract(await NftCollection.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await nFTCollection.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            null,
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: nFTCollection.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and nFTCollection are ready to use
    });
});
