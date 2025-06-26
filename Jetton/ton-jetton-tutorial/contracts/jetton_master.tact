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
    jettonWalletCode: Cell,
    metadataUri: String,
) with OwnableTransferable {
    // GAS CONSTANTS
    const StorageReserve: Int = ton("0.05");
    const MinTonForWalletDeploy: Int = ton("0.05");

    receive() {
        // Accept deployment with minimum storage reserve
        // On other calls, it will just keep 0.05 ton
        let value = context().value;
        message(MessageParameters {
            to: sender(),
            value: value - self.StorageReserve,
            mode: SendIgnoreErrors,
            bounce: false,
        });
    }

    // Mint msg.amount tokens to msg.to address
    // It deploys a smart contract "jetton wallet" to track data for this specific user
    receive(msg: Mint) {
        self.requireOwner();

        let ctx: Context = context();

        // Validate owner and sufficient gas to mint
        throwUnless(ERROR_INSUFFICIENT_GAS, ctx.value >= self.MinTonForWalletDeploy + msg.forwardTonAmount);

        // Validate same workchain (prevent cross-workchain minting)
        throwUnless(ERROR_NOT_SAME_WORKCHAIN, parseStdAddress(msg.to.asSlice()).workchain == parseStdAddress(myAddress().asSlice()).workchain);

        // Reserve storage fees (https://docs.tact-lang.org/ref/core-contextstate/#nativereserve)
        // Why nativeReserve() instead of basic math to ensure minimum storage reserve
        // => It ensures at protocol level that contract will reserve this amount. Jetton has complex interactions which could lead to error with basic math
        nativeReserve(self.StorageReserve, ReserveExact);

        // Fetch wallet state init of specific address
        let walletInit: StateInit = self.getJettonWalletInit(msg.to);
        self.totalSupply += msg.amount;

        // Deploy jetton wallet and call InternalTransfer on it and update its balance with first mint
        deploy(DeployParameters {
            init: walletInit,
            value: 0,
            mode: SendRemainingValue,
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

    // When a user burns tokens from "jetton_wallet" contract, master contract get a BurnNotification
    // To keep track of the total supply
    receive(msg: BurnNotification) {
        let ctx: Context = context();

        // Validate sender is legitimate wallet
        let expectedWallet: Address = contractAddress(self.getJettonWalletInit(msg.sender));
        throwUnless(ERROR_INVALID_SENDER, ctx.sender == expectedWallet);

        // Update total supply
        self.totalSupply -= msg.amount;

        // Send excesses if response destination provided (same workchain only)
        if (msg.responseDestination != null && parseStdAddress(msg.responseDestination!!.asSlice()).workchain == parseStdAddress(myAddress().asSlice()).workchain) {
            message(MessageParameters {
                to: msg.responseDestination!!,
                value: 0,
                mode: SendRemainingValue + SendIgnoreErrors,
                bounce: false,
                body: Excesses { queryId: 0 }.toCell(),
            });
        }
    }

    bounced(msg: bounced<InternalTransfer>) {
        // Handle bounced mint operations - restore total supply
        self.totalSupply -= msg.amount;
    }

    // TEP89 WALLET DISCOVERY
    receive(msg: ProvideWalletAddress) {
        throwUnless(ERROR_INSUFFICIENT_GAS, context().value >= ton("0.005"));

        // Check it is on same workchain
        let walletAddress: Address = parseStdAddress(msg.ownerAddress.asSlice()).workchain == parseStdAddress(myAddress().asSlice()).workchain
            ? contractAddress(self.getJettonWalletInit(msg.ownerAddress))
            : newAddress(0, 0);

        let ownerSlice: Slice = msg.includeAddress ? msg.ownerAddress.asSlice() : emptySlice();

        // No bounce "handling" because it acts as a notification
        message(MessageParameters {
            to: context().sender,
            value: 0,
            mode: SendRemainingValue + SendBounceIfActionFail,
            bounce: true,
            body: TakeWalletAddress {
                queryId: msg.queryId,
                walletAddress,
                ownerAddress: ownerSlice,
            }.toCell(),
        });
    }

    //  TEP74 GET METHODS
    get fun get_jetton_data(): JettonData {
        return JettonData {
            totalSupply: self.totalSupply,
            mintable: true, // Always mintable by admin
            adminAddress: self.owner,
            jettonContent: self.buildContentCell(),
            jettonWalletCode: self.jettonWalletCode,
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

    // UTILITY FUNCTIONS
    inline fun getJettonWalletInit(ownerAddress: Address): StateInit {
        return initOf JettonWallet(myAddress(), ownerAddress);
    }

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
