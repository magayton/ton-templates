import { toNano } from '@ton/core';
import { NftCollection } from '../build/NFTCollection/NFTCollection_NFTCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const nFTCollection = provider.open(await NftCollection.fromInit());

    await nFTCollection.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        null,
    );

    await provider.waitForDeploy(nFTCollection.address);

    // run methods on `nFTCollection`
}
