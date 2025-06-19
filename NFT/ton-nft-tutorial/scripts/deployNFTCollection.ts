import { toNano, beginCell } from '@ton/core';
import { NftCollection } from '../build/NFTCollection/NFTCollection_NFTCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Deploying NFT Collection contract ...');

    const COLLECTION_NAME = 'My NFT Collection';
    const COLLECTION_DESCRIPTION = 'A collection of unique NFTs';
    const COLLECTION_URI = 'https://example.com/collection.png';
    const collectionContent = beginCell().storeStringTail(COLLECTION_NAME).storeStringRefTail(COLLECTION_DESCRIPTION).storeStringRefTail(COLLECTION_URI).endCell();

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
