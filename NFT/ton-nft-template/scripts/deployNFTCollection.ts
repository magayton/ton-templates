import { toNano, beginCell } from '@ton/core';
import { NftCollection } from '../build/NftCollection/NftCollection_NftCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Deploying NFT Collection contract ...');

    // To change
    const OFFCHAIN_PREFIX = 0x01;
    const collectionContent = beginCell()
        .storeInt(OFFCHAIN_PREFIX, 8)
        .storeStringTail('https://example.com/collection.png')
        .endCell();

    const nFTCollection = provider.open(await NftCollection.fromInit(
        0n,
        provider.sender().address!, // ownerAddress to change
        null,
        collectionContent
    ));

    console.log('Contract address:', nFTCollection.address.toString());

    try {
        await nFTCollection.send(
            provider.sender(),
            {
                value: toNano('0.1'),
            },
            null,
        );

        await provider.waitForDeploy(nFTCollection.address);
    }
    catch (error) {
        console.error('Deployment failed:', error);
        return;
    }

    console.log('NFT Collection contract deployed!');
}
