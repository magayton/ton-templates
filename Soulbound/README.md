# Soulbound NFT Collection Smart Contract

TEP-85 compliant Soulbound NFT Collection implementation in Tact for the TON blockchain.

## Structure

- **`ton-soulbound-template/`** - Production-ready contract without comments
- **`ton-soulbound-tutorial/`** - Educational version with detailed comments

## Features

- Follows TEP-85 Soulbound Token Standard
- Non-transferable tokens bound to original recipient
- Proof of ownership mechanisms
- Revocation and destroy functionality
- Comprehensive test suite
- Ready-to-use deployment and operation scripts

## Available Scripts

- `deploySoulboundCollection.ts` - Deploy soulbound collection
- `mintSoulbound.ts` - Mint soulbound tokens
- `proveOwnership.ts` - Prove token ownership
- `requestOwner.ts` - Request owner information
- `revokeSoulbound.ts` - Revoke soulbound tokens
- `destroySoulbound.ts` - Destroy soulbound tokens

## License

MIT License - see LICENSE file for details.

---

**⚠️ Security Notice**: Always audit smart contracts before deploying to mainnet. Test thoroughly on testnet first.