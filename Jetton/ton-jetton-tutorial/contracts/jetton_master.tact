import "./jetton_wallet.tact";
import "./messages.tact";
import "@stdlib/content";
import "@stdlib/ownable";

// Jetton Master contract => follows TEP74 https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md#jetton-master-contract
// Uses contract parameter for deployment => https://docs.tact-lang.org/book/contracts/#parameters
// For metadata standard => https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md
// This contract is the central authority and management hub for a jetton
contract JettonMaster(
    totalSupply: Int as coins,
    owner: Address,
    metadataUri: String,
    mintable: Bool,
) with OwnableTransferable {
    receive() {
        // Accept deployment call with minimum storage reserve
        // On other calls, it will just keep 0.05 ton
        let value = context().value;
        message(MessageParameters {
            to: sender(),
            value: value - minTonsForStorage,
            mode: SendIgnoreErrors,
            bounce: false,
        });
    }

    // Mint msg.amount tokens to msg.to address
    // It deploys a smart contract "jetton wallet" to track data for this specific user
    receive(msg: Mint) {
        self.requireOwner();
        throwUnless(ERROR_MINT_CLOSED, self.mintable);

        let ctx: Context = context();

        // Validate sufficient gas to mint with compute fees
        throwUnless(
            ERROR_INSUFFICIENT_GAS,
            ctx.value > minTonForWalletDeploy + msg.forwardTonAmount +
                        ctx.readForwardFee() + 2 * getComputeFee(gasForTransfer, false),
        );

        // Validate same workchain (prevent cross-workchain minting)
        // It ensure consistent gas costs and predictable behavior
        throwUnless(ERROR_NOT_SAME_WORKCHAIN, parseStdAddress(msg.to.asSlice()).workchain == parseStdAddress(myAddress().asSlice()).workchain);


        // Fetch wallet state init of specific address
        let walletInit: StateInit = self.getJettonWalletInit(msg.to);

        // Update total supply
        self.totalSupply += msg.amount;

        // No nativeReserve here 
        // I wanted to do nativeReserve(minTonsForStorage, ReserveExact);
        // But from what I understand (it is not 100% sure) it creates a problem (Action phase code 37)
        // Because TVM can not calculate with SendRemainingValue the amount needed to do all the tasks
        // nativeReserve + SendRemainingValue = Reserve X, then send erything except what you reserved
        // But "everything except what you reserved" needs to pay for the deploy action
        // The TVM gets confused trying to calculate this with the reserve constraint

        // Deploy jetton wallet and call InternalTransfer on it to update its balance with first mint
        // If contract is already deployed, it just call InternalTransfer on it (it executes the body message)
        deploy(DeployParameters {
            init: walletInit,
            value: 0,
            bounce: true,
            mode: SendRemainingValue | SendBounceIfActionFail,
            body: InternalTransfer {
                queryId: msg.queryId,
                amount: msg.amount,
                from: myAddress(),
                responseAddress: msg.responseDestination,
                forwardTonAmount: msg.forwardTonAmount,
                forwardPayload: msg.forwardPayload, // https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md#forward_payload-format
            }.toCell(),
        });
    }

    // When user burn tokens from "jetton wallet" contract, master contract get a BurnNotification
    // To keep track of the total supply
    receive(msg: BurnNotification) {
        // Validate sender is legitimate wallet
        // https://docs.tact-lang.org/ref/core-addresses/#stateinithassamebasechainaddress
        let walletInit = self.getJettonWalletInit(msg.sender);
        let isExpectedWallet: Bool = walletInit.hasSameBasechainAddress(sender());
        throwUnless(ERROR_INVALID_SENDER, isExpectedWallet);

        // Update total supply
        self.totalSupply -= msg.amount;

        // Send excesses if response destination provided (same workchain only)
        if (msg.responseDestination != null && parseStdAddress(msg.responseDestination!!.asSlice()).workchain == parseStdAddress(myAddress().asSlice()).workchain) {
            message(MessageParameters {
                to: msg.responseDestination!!,
                value: 0,
                mode: SendRemainingValue | SendIgnoreErrors, // Ignore is ok here, supply is already updated
                bounce: false,
                body: Excesses { queryId: 0 }.toCell(),
            });
        }
    }

    // TEP89 WALLET DISCOVERY
    receive(msg: ProvideWalletAddress) {
        let ctx: Context = context();
        // TEP89: Minimum gas requirement = 5000 gas + forward fees ≈ 0.0061 TON
        let minGasRequired: Int = getComputeFee(5000, false) + ctx.readForwardFee();
        throwUnless(ERROR_INSUFFICIENT_GAS, ctx.value > minGasRequired);

        // Calculate owner address if it is on the same workchain
        // Not the best way, it would be better with :
        // ? contractBasechainAddress(self.getJettonWalletInit(msg.ownerAddress)): emptyBasechainAddress();
        // However it will create a BaseChainAddress and not an Address type
        // Since TEP89 provides this : take_wallet_address#d1735400 query_id:uint64 wallet_address:MsgAddress owner_address:(Maybe ^MsgAddress) = InternalMsgBody;
        // We can not use BaseChainAddress but Address to follow the standard
        // However if you use BaseChainAddress for best practice you can see a "trick" here
        // https://github.com/tact-lang/defi-cookbook/blob/main/jettons/impl/utils.tact#L10
        // To "transform" the BaseChainAddress to Address. I am not using it since Tact can evolve and change this behavior
        let walletAddress: Address = parseStdAddress(msg.ownerAddress.asSlice()).workchain == parseStdAddress(myAddress().asSlice()).workchain
            ? contractAddress(self.getJettonWalletInit(msg.ownerAddress))
            : emptyAddress();

        // No bounce "handling" because it acts as a notification
        message(MessageParameters {
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: TakeWalletAddress {
                queryId: msg.queryId,
                walletAddress,
                ownerAddress: msg.includeAddress ? beginCell().storeAddress(msg.ownerAddress).endCell() : null,
            }.toCell(),
        });
    }

    bounced(msg: bounced<InternalTransfer>) {
        // Handle bounced mint operations by restoring total supply
        self.totalSupply -= msg.amount;
    }

    //  TEP74 GET METHODS
    get fun get_jetton_data(): JettonData {
        return JettonData {
            totalSupply: self.totalSupply,
            mintable: self.mintable,
            adminAddress: self.owner,
            jettonContent: self.buildContentCell(),
            jettonWalletCode: codeOf JettonWallet,
        };
    }

    get fun get_wallet_address(ownerAddress: Address): Address {
        return contractAddress(self.getJettonWalletInit(ownerAddress));
    }

    // OWNER METHODS
    receive(msg: ChangeMetadataUri) {
        self.requireOwner();
        self.metadataUri = msg.metadataUri;
    }

    // https://github.com/tact-lang/defi-cookbook/tree/main/basics/update
    receive(msg: Upgrade) {
        self.requireOwner();
        setData(msg.newData);
        setCode(msg.newCode);
    }

    receive(msg: ChangeMintState) {
        self.requireOwner();
        self.mintable = !self.mintable;
    }

    // UTILITY FUNCTIONS
    // Since a wallet is always initialized with a 0 balance, it is predictible
    // However it could not work for a NFT for example, with an item index changing
    inline fun getJettonWalletInit(ownerAddress: Address): StateInit {
        return initOf JettonWallet(0, myAddress(), ownerAddress);
    }

    // https://docs.tact-lang.org/ref/stdlib-content/#createoffchaincontent
    inline fun buildContentCell(): Cell {
        return createOffchainContent(self.metadataUri);
    }
}

// ASSEMBLY FUNCTIONS FOR CONTRACT UPGRADE
asm fun setData(newData: Cell) {
    c4 POP
}

asm fun setCode(newCode: Cell) {
    SETCODE
}

// ASSEMBLY FUNCTION TO CREATE AN EMPTY ADDRESS
// https://docs.tact-lang.org/ref/core-addresses/#newaddress
// (Unreliable information) it is a better way than calling newAddress(0, 0) ?
asm fun emptyAddress(): Address { b{00} PUSHSLICE }
