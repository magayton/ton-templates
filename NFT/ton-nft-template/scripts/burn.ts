import { toNano, Address } from '@ton/core';
import { NftCollection } from '../build/NftCollection/NftCollection_NftCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Burning NFT...');

    const collectionAddress = Address.parse('COLLECTION_ADDRESS');

    const ownerAddress = Address.parse('OWNER_ADDRESS');
    
    // Item index to burn
    const itemIndex = 0n;
    
    const nFTCollection = provider.open(NftCollection.fromAddress(collectionAddress));

    try {
        await nFTCollection.send(
            provider.sender(),
            {
                value: toNano('0.1'), 
            },
            {
                $$type: 'Burn',
                queryId: 0n,
                itemIndex: itemIndex,
                owner: ownerAddress
            },
        );

        console.log('Burn transaction sent!');
    }
    catch (error) {
        console.error('Burn failed:', error);
        return;
    }

    console.log('NFT burned successfully!');
}