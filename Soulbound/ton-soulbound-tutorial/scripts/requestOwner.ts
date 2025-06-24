import { toNano, beginCell, Address } from '@ton/core';
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

    // RequestOwner parameters
    const queryId = 0n;
    const destinationAddress = Address.parse("DESTINATION_ADDRESS_HERE"); // Replace with destination address
    const withContent = true;

    // Forward payload format
    // https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md#forward_payload-format
    const forwardPayload = beginCell().storeStringTail("Owner request payload").endCell(); // Replace with actual payload

    try {
        await sbtItem.send(
            provider.sender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'RequestOwner',
                queryId: queryId,
                dest: destinationAddress,
                forwardPayload: forwardPayload,
                withContent: withContent,
            }
        );
    }
    catch (error) {
        console.error('Error requesting owner of Soulbound Token:', error);
        return;
    }

    console.log('RequestOwner message sent successfully');
}