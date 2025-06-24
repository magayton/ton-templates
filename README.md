# TON Smart Contract Templates

A collection of production-ready TON smart contract templates written in **Tact**, following TEP (TON Enhancement Proposal) standards and using the latest Tact syntax.

## Technology Stack

- **Language**: [Tact](https://tact-lang.org/) (Trying to use latest syntax)
- **Blockchain**: [TON](https://ton.org/)
- **Testing**: Jest with @ton/sandbox
- **Build Tool**: TON Blueprint
- **Standards**: [TEPs](https://github.com/ton-blockchain/TEPs/tree/master)

## Repository Structure

This repository contains three main contract categories, each with two implementations:

- **`template`** - Clean, ready to use contracts without comments
- **`tutorial`** - Educational versions with detailed comments and explanations

```
TON/
  NFT/
    ton-nft-template/ 
    ton-nft-tutorial/
  Payment/
    ton-payment-template/
    ton-payment-tutorial/
  Soulbound/
    ton-soulbound-template/
    ton-soulbound-tutorial/
```

## Smart Contracts

### Payment Contract
Flexible payment processing contract featuring:
- Deposit and withdrawal operations
- Owner management
- Contract pause/resume functionality
- Secure fund handling

### NFT Collection
TEP-62 compliant NFT collection implementation with:
- Minting functionality
- Transfer capabilities
- Burn mechanism
- Royalty support
- Gas-optimized operations

### Soulbound NFT Collection
TEP-85 compliant soulbound tokens with:
- Non-transferable tokens
- Proof of ownership
- Revocation mechanism
- Destroy functionality

## Prerequisites

- Node.js 18+
- npm or yarn
- TON Blueprint

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd TON
   ```

2. **Choose your contract type**
   ```bash
   cd NFT/ton-nft-template  # or any other contract
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Build the contract**
   ```bash
   npx blueprint build
   ```

5. **Run tests**
   ```bash
   npx blueprint test
   ```

6. **Deploy**
   ```bash
   npx blueprint run
   ```

## Learning Path

1. **Start with tutorials** - Explore the commented versions to understand implementation details
2. **Run tests** - See how contracts behave in different scenarios
3. **Use templates** - Copy clean template versions for your projects
4. **Customize** - Modify contracts to fit your specific needs

## Resources

- [Tact Documentation](https://tact-lang.org/)
- [TON Documentation](https://ton.org/docs/)
- [TEP Standards](https://github.com/ton-blockchain/TEPs)
- [TON Blueprint](https://github.com/ton-org/blueprint)

## License

This project is open source and available under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

**Note**: These templates are designed for educational and development purposes. Always audit smart contracts before deploying to mainnet.