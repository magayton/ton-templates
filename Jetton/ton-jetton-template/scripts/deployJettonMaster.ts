import { toNano } from '@ton/core';
import { JettonMaster } from '../build/JettonMaster/JettonMaster_JettonMaster';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Deploying Jetton Master contract...');

    const totalSupply = 0n;
    const owner = provider.sender().address!;
    const metadataUri = 'https://your-metadata-url.com/metadata.json';
    const mintable = true;

    const jettonMaster = provider.open(await JettonMaster.fromInit(
        totalSupply,
        owner,
        metadataUri,
        mintable
    ));

    console.log(`Contract address: ${jettonMaster.address.toString()}`);

    try {
        await jettonMaster.send(
            provider.sender(),
            {
                value: toNano('0.5'),
            },
            null,
        );

        await provider.waitForDeploy(jettonMaster.address);
    }
    catch (error) {
        console.error('Deployment failed:', error);
        return;
    }

    console.log('Jetton Master deployed successfully!');
}
