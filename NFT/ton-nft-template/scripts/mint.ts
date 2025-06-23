import { toNano, Address, beginCell } from '@ton/core';
import { NftCollection } from '../build/NftCollection/NftCollection_NftCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Minting NFT...');

    // Replace with your deployed collection address
    const collectionAddress = Address.parse('kQABfyPBGln1NMSFzufVjEvoeiiRGopj6V6cZI-0aA0IyN7u');
    
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