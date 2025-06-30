import "./jetton_wallet.tact";
import "./messages.tact";
import "@stdlib/content";
import "@stdlib/ownable";

contract JettonMaster(
    totalSupply: Int as coins,
    owner: Address,
    metadataUri: String,
    mintable: Bool,
) with OwnableTransferable {
    receive() {
        let value = context().value;
        message(MessageParameters {
            to: sender(),
            value: value - minTonsForStorage,
            mode: SendIgnoreErrors,
            bounce: false,
        });
    }

    receive(msg: Mint) {
        self.requireOwner();
        throwUnless(ERROR_MINT_CLOSED, self.mintable);

        let ctx: Context = context();

        throwUnless(
            ERROR_INSUFFICIENT_GAS,
            ctx.value > minTonForWalletDeploy + msg.forwardTonAmount +
                        ctx.readForwardFee() + 2 * getComputeFee(gasForTransfer, false),
        );

        throwUnless(ERROR_NOT_SAME_WORKCHAIN, parseStdAddress(msg.to.asSlice()).workchain == parseStdAddress(myAddress().asSlice()).workchain);

        let walletInit: StateInit = self.getJettonWalletInit(msg.to);

        self.totalSupply += msg.amount;

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
                forwardPayload: msg.forwardPayload,
            }.toCell(),
        });
    }

    receive(msg: BurnNotification) {
        let walletInit = self.getJettonWalletInit(msg.sender);
        let isExpectedWallet: Bool = walletInit.hasSameBasechainAddress(sender());
        throwUnless(ERROR_INVALID_SENDER, isExpectedWallet);

        self.totalSupply -= msg.amount;

        if (msg.responseDestination != null && parseStdAddress(msg.responseDestination!!.asSlice()).workchain == parseStdAddress(myAddress().asSlice()).workchain) {
            message(MessageParameters {
                to: msg.responseDestination!!,
                value: 0,
                mode: SendRemainingValue | SendIgnoreErrors,
                bounce: false,
                body: Excesses { queryId: 0 }.toCell(),
            });
        }
    }

    receive(msg: ProvideWalletAddress) {
        let ctx: Context = context();
        let minGasRequired: Int = getComputeFee(5000, false) + ctx.readForwardFee();
        throwUnless(ERROR_INSUFFICIENT_GAS, ctx.value > minGasRequired);

        let walletAddress: Address = parseStdAddress(msg.ownerAddress.asSlice()).workchain == parseStdAddress(myAddress().asSlice()).workchain
            ? contractAddress(self.getJettonWalletInit(msg.ownerAddress))
            : emptyAddress();

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
        self.totalSupply -= msg.amount;
    }

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

    receive(msg: ChangeMetadataUri) {
        self.requireOwner();
        self.metadataUri = msg.metadataUri;
    }

    receive(msg: Upgrade) {
        self.requireOwner();
        setData(msg.newData);
        setCode(msg.newCode);
    }

    receive(msg: ChangeMintState) {
        self.requireOwner();
        self.mintable = !self.mintable;
    }

    inline fun getJettonWalletInit(ownerAddress: Address): StateInit {
        return initOf JettonWallet(0, myAddress(), ownerAddress);
    }

    inline fun buildContentCell(): Cell {
        return createOffchainContent(self.metadataUri);
    }
}

asm fun setData(newData: Cell) {
    c4 POP
}

asm fun setCode(newCode: Cell) {
    SETCODE
}

asm fun emptyAddress(): Address { b{00} PUSHSLICE }
