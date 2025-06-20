import { toNano, beginCell } from '@ton/core';
import { NftCollection } from '../build/NFTCollection/NFTCollection_NFTCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Deploying NFT Collection contract ...');

    // TO CHANGE WITH YOUR OWN VALUES
    // https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md#content-representation
    const OFFCHAIN_PREFIX = 0x01;
    const collectionContent = beginCell()
        .storeInt(OFFCHAIN_PREFIX, 8)
        .storeStringTail('https://example.com/collection.png')
        .endCell();

    const nFTCollection = provider.open(await NftCollection.fromInit(
        0n, // nextItemIndex
        provider.sender().address!, // ownerAddress (you can write your own address here instead)
        null, // royaltyParams
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
