import { toNano, beginCell, Address } from '@ton/core';
import { SoulboundCollection } from '../build/SoulboundCollection/SoulboundCollection_SoulboundCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const collectionAddress = Address.parse("COLLECTION_ADDRESS_HERE");
    
    const soulboundCollection = provider.open(
        SoulboundCollection.fromAddress(collectionAddress)
    );

    const queryId = 0n;
    const recipientAddress = Address.parse("RECIPIENT_ADDRESS_HERE");
    const itemContent = beginCell().storeStringTail("CONTENT_HERE").endCell(); 

    try {
        await soulboundCollection.send(
            provider.sender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'Mint',
                queryId: queryId,
                to: recipientAddress,
                itemContent: itemContent,
            }
        );
    }
    catch (error) {
        console.error('Error minting Soulbound Token:', error);
        return;
    }

    console.log('Mint message sent successfully');
}