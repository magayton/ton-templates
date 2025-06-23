import { toNano, Address, beginCell } from '@ton/core';
import { NftItem } from '../build/NFTCollection/NFTCollection_NftItem';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    console.log('Transferring NFT...');

    // Replace with your NFT item address (not collection address)
    const nftItemAddress = Address.parse('YOUR_NFT_ITEM_ADDRESS_HERE');
    
    // Replace with the new owner address
    const newOwnerAddress = Address.parse('NEW_OWNER_ADDRESS_HERE');
    
    const nftItem = provider.open(NftItem.fromAddress(nftItemAddress));

    console.log('NFT Item address:', nftItem.address.toString());
    console.log('Transferring to:', newOwnerAddress.toString());

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
                forwardPayload: beginCell().endCell().asSlice() // https://github.com/ton-blockchain/TEPs/blob/master/text/0062-nft-standard.md#forward_payload-format
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