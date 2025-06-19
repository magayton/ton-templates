import { toNano, Address } from '@ton/core';
import { NftCollection } from '../build/NftCollection/NftCollection_NftCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Minting NFT...');

    // Replace with your deployed collection address
    const collectionAddress = Address.parse('YOUR_COLLECTION_ADDRESS_HERE');
    
    const nFTCollection = provider.open(NftCollection.fromAddress(collectionAddress));

    console.log('Collection address:', nFTCollection.address.toString());

    try {
        await nFTCollection.send(
            provider.sender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'Mint',
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