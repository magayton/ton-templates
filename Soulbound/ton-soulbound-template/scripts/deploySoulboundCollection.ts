import { toNano, beginCell } from '@ton/core';
import { SoulboundCollection } from '../build/SoulboundCollection/SoulboundCollection_SoulboundCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const nextItemIndex = 0n;
    const ownerAddress = provider.sender().address!;

    const OFFCHAIN_PREFIX = 0x01;
    const collectionContent = beginCell()
        .storeInt(OFFCHAIN_PREFIX, 8)
        .storeStringTail('https://example.com/collection/')
        .endCell();

    const soulboundCollection = provider.open(
        await SoulboundCollection.fromInit(nextItemIndex, ownerAddress, collectionContent)
    );

    try {
        await soulboundCollection.send(
            provider.sender(),
            {
                value: toNano('0.1'),
            },
            null,
        );

        await provider.waitForDeploy(soulboundCollection.address);
    }
    catch (error) {
        console.error('Error deploying Soulbound Collection:', error);
        return;
    }

    console.log('Soulbound Collection contract deployed!');
}
