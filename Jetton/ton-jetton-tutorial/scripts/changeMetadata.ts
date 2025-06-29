import { toNano, Address } from '@ton/core';
import { JettonMaster } from '../build/JettonMaster/JettonMaster_JettonMaster';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Changing Jetton metadata URI...');

    // Replace with your deployed Jetton Master contract address
    const jettonMasterAddress = Address.parse('YOUR_CONTRACT_ADDRESS_HERE');
    const jettonMaster = provider.open(JettonMaster.fromAddress(jettonMasterAddress));

    // New metadata URI
    const newMetadataUri = 'https://your-new-metadata-url.com/metadata.json';

    const queryId = 0n;

    try {
        await jettonMaster.send(
            provider.sender(),
            {
                value: toNano('0.05'), // Gas for metadata change
            },
            {
                $$type: 'ChangeMetadataUri',
                queryId: queryId,
                metadataUri: newMetadataUri
            }
        );
    }
    catch (error) {
        console.error('Change metadata failed:', error);
        return;
    }

    console.log('Jetton metadata URI changed successfully!');
}