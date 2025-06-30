import { Address } from '@ton/core';
import { JettonMaster } from '../build/JettonMaster/JettonMaster_JettonMaster';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Getting Jetton data...');

    const jettonMasterAddress = Address.parse('YOUR_JETTON_MASTER_ADDRESS_HERE');
    const jettonMaster = provider.open(JettonMaster.fromAddress(jettonMasterAddress));

    try {
        console.log('=== Jetton Master Data ===');
        const jettonData = await jettonMaster.getGetJettonData();

        console.log(`Total Supply: ${jettonData.totalSupply}`);
        console.log(`Mintable: ${jettonData.mintable}`);
        console.log(`Admin Address: ${jettonData.adminAddress.toString()}`);
        console.log(`Jetton Content: ${jettonData.jettonContent.toString()}`);
    }
    catch (error) {
        console.error('Get jetton data failed:', error);
        return;
    }

    console.log('Jetton data retrieval completed!');
}