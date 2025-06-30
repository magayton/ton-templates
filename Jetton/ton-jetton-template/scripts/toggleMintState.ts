import { toNano, Address } from '@ton/core';
import { JettonMaster } from '../build/JettonMaster/JettonMaster_JettonMaster';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Toggling Jetton mint state...');

    const jettonMasterAddress = Address.parse('YOUR_CONTRACT_ADDRESS_HERE');
    const jettonMaster = provider.open(JettonMaster.fromAddress(jettonMasterAddress));

    const queryId = 0n;

    try {
        await jettonMaster.send(
            provider.sender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'ChangeMintState',
                queryId: queryId
            }
        );
    }
    catch (error) {
        console.error('Toggle mint state failed:', error);
        return;
    }

    console.log('Jetton mint state toggled successfully!');
}