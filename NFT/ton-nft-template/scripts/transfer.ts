import { toNano, Address, beginCell } from '@ton/core';
import { NftItem } from '../build/NftCollection/NftCollection_NftItem';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Transferring NFT...');

    const nftItemAddress = Address.parse('YOUR_NFT_ITEM_ADDRESS_HERE');
    
    const newOwnerAddress = Address.parse('NEW_OWNER_ADDRESS_HERE');
    
    const nftItem = provider.open(NftItem.fromAddress(nftItemAddress));

    try {
        await nftItem.send(
            provider.sender(),
            {
                value: toNano('0.1'),
            },
            {
                $$type: 'Transfer',
                queryId: 0n,
                newOwner: newOwnerAddress,
                responseDestination: provider.sender().address!,
                customPayload: null,
                forwardAmount: toNano('0.01'),
                forwardPayload: beginCell().endCell().asSlice()
            },
        );

        console.log('Transfer transaction sent!');
    }
    catch (error) {
        console.error('Transfer failed:', error);
        return;
    }

    console.log('NFT transferred successfully!');
}