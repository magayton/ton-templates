import { toNano } from '@ton/core';
import { SoulboundCollection } from '../build/SoulboundCollection/SoulboundCollection_SoulboundCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const soulboundCollection = provider.open(await SoulboundCollection.fromInit());

    await soulboundCollection.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        null,
    );

    await provider.waitForDeploy(soulboundCollection.address);

    // run methods on `soulboundCollection`
}
