import { toNano } from '@ton/core';
import { JettonMaster } from '../build/JettonMaster/JettonMaster_JettonMaster';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Deploying Jetton Master contract...');

    // Jetton Master parameters
    const totalSupply = 0n; // Initial supply
    const owner = provider.sender().address!; // Replace with your contract owner address
    const metadataUri = 'https://your-metadata-url.com/metadata.json'; // Replace with your metadata URL
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
                value: toNano('0.5'), // Increased gas for deployment (excesses sent back)
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
