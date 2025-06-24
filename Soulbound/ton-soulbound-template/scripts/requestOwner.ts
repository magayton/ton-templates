import { toNano, beginCell, Address } from '@ton/core';
import { SoulboundCollection } from '../build/SoulboundCollection/SoulboundCollection_SoulboundCollection';
import { SBTItem } from '../build/SoulboundCollection/SoulboundCollection_SBTItem';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const collectionAddress = Address.parse("COLLECTION_ADDRESS_HERE");

    const soulboundCollection = provider.open(
        SoulboundCollection.fromAddress(collectionAddress)
    );

    const itemIndex = 0n;
    const sbtItemAddress = await soulboundCollection.getGetNftAddressByIndex(itemIndex);

    console.log('SBT Item address:', sbtItemAddress);

    const sbtItem = provider.open(SBTItem.fromAddress(sbtItemAddress));

    const queryId = 0n;
    const destinationAddress = Address.parse("DESTINATION_ADDRESS_HERE");
    const withContent = true;

    const forwardPayload = beginCell().storeStringTail("PAYLOAD HERE").endCell();

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