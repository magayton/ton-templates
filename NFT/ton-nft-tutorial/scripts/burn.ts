import { toNano, Address } from '@ton/core';
import { NftCollection } from '../build/NFTCollection/NFTCollection_NFTCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Burning NFT...');

    // Replace with your deployed collection address
    const collectionAddress = Address.parse('YOUR_COLLECTION_ADDRESS_HERE');

    // Replace with the owner address of the NFT you want to burn
    const ownerAddress = Address.parse('YOUR_OWNER_ADDRESS_HERE');

    // Replace with the item index you want to burn
    const itemIndex = 0n;

    const nFTCollection = provider.open(NftCollection.fromAddress(collectionAddress));

    console.log('Collection address:', nFTCollection.address.toString());
    console.log('Burning NFT item index:', itemIndex.toString());

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