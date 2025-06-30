# Jetton Smart Contract

TEP-74 compliant fungible token contract in Tact for the TON blockchain.

## Structure

- **`ton-jetton-template/`** - Production-ready contract without comments
- **`ton-jetton-tutorial/`** - Educational version with detailed comments

## Features

- TEP-74 standard compliance for fungible tokens
- Token minting and burning operations
- Secure transfer functionality
- Metadata management and updates
- Mint state control (enable/disable minting)
- Wallet address computation
- Comprehensive test suite
- Ready-to-use deployment and operation scripts

## Available Scripts

- `deployJettonMaster.ts` - Deploy jetton master contract
- `mint.ts` - Mint new tokens
- `burn.ts` - Burn existing tokens
- `transfer.ts` - Transfer tokens between wallets
- `changeMetadata.ts` - Update token metadata
- `toggleMintState.ts` - Enable/disable minting
- `getJettonData.ts` - Query jetton information
- `getWalletAddress.ts` - Get wallet address for owner

## License

MIT License - see LICENSE file for details.

---

**⚠️ Security Notice**: Always audit smart contracts before deploying to mainnet. Test thoroughly on testnet first.