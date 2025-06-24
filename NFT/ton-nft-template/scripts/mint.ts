import { toNano, Address, beginCell } from '@ton/core';
import { NftCollection } from '../build/NftCollection/NftCollection_NftCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Minting NFT...');

    const collectionAddress = Address.parse('COLLECTION_ADDRESS');
    const nFTCollection = provider.open(NftCollection.fromAddress(collectionAddress));

    const queryId = 0n;
    const itemContent = beginCell().storeStringTail("YOUR_ITEM_CONTENT").endCell();

    try {
        await nFTCollection.send(
            provider.sender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'Mint',
                queryId: queryId,
                itemContent: itemContent
            }
        );
    }
    catch (error) {
        console.error('Mint failed:', error);
        return;
    }

    console.log('NFT minted successfully!');
}