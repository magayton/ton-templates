import { toNano, Address } from '@ton/core';
import { SoulboundCollection } from '../build/SoulboundCollection/SoulboundCollection_SoulboundCollection';
import { SBTItem } from '../build/SoulboundCollection/SoulboundCollection_SBTItem';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    // Replace with your collection address
    const collectionAddress = Address.parse("COLLECTION_ADDRESS_HERE");
    
    const soulboundCollection = provider.open(
        SoulboundCollection.fromAddress(collectionAddress)
    );

    // Get the SBT item address (replace itemIndex with the actual index)
    const itemIndex = 0n;
    const sbtItemAddress = await soulboundCollection.getGetNftAddressByIndex(itemIndex);
    
    console.log('SBT Item address:', sbtItemAddress);

    // Create connection to the SBT item
    const sbtItem = provider.open(SBTItem.fromAddress(sbtItemAddress));

    // Destroy parameters
    const queryId = 0n;

    try {
        await sbtItem.send(
            provider.sender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Destroy',
                queryId: queryId,
            }
        );
    }
    catch (error) {
        console.error('Error destroying Soulbound Token:', error);
        return;
    }

    console.log('Destroy message sent successfully');
}