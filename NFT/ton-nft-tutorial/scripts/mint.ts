import { toNano, Address, beginCell } from '@ton/core';
import { NftCollection } from '../build/NFTCollection/NFTCollection_NFTCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Minting NFT...');

    // Replace with your deployed collection address
    const collectionAddress = Address.parse('YOUR_COLLECTION_ADDRESS_HERE');
    
    const nFTCollection = provider.open(NftCollection.fromAddress(collectionAddress));

    console.log('Collection address:', nFTCollection.address.toString());

    const queryId = 0n;
    const itemContent = beginCell().storeStringTail("item.content").endCell(); // Replace with actual item content

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

        console.log('Mint transaction sent!');
    }
    catch (error) {
        console.error('Mint failed:', error);
        return;
    }

    console.log('NFT minted successfully!');
}