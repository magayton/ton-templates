import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Cell, Address } from '@ton/core';
import { TONPaymentHandler, loadDepositReceived } from '../build/Payment/Payment_TONPaymentHandler';
import '@ton/test-utils';

describe('TONPaymentHandler', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;
    let nonOwner: SandboxContract<TreasuryContract>;
    let payment: SandboxContract<TONPaymentHandler>;

    const initial_payment = toNano('0.05'); // Initial deployment fee

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        // Create test accounts
        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');
        user2 = await blockchain.treasury('user2');
        nonOwner = await blockchain.treasury('nonOwner');

        // Deploy the contract
        payment = blockchain.openContract(await TONPaymentHandler.fromInit());

        const deployResult = await payment.send(
            deployer.getSender(),
            {
                value: initial_payment,
            },
            null,
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: payment.address,
            deploy: true,
            success: true,
        });
    });

    describe('Deployment', () => {
        it('should deploy successfully', async () => {
            // Contract should be deployed and ready
            const config = await payment.getConfig();
            expect(config.owner).toEqualAddress(deployer.address);
            expect(config.isStopped).toBe(false);
            expect(config.totalDeposited).toBe(initial_payment); // Initial deployment
            expect(config.totalWithdrawn).toBe(0n);
            expect(config.depositCount).toBe(1n); // Initial deposit from deployment
        });

        it('should have correct initial state', async () => {
            const balance = await payment.getBalance();
            const totalDeposited = await payment.getTotalDeposited();
            const depositCount = await payment.getDepositCount();

            expect(balance).toBeGreaterThan(0n); // Should have deployment fee
            expect(totalDeposited).toBe(initial_payment);
            expect(depositCount).toBe(1n);
        });
    });

    describe('Plain TON Deposits (receive())', () => {
        it('should accept plain TON transfers', async () => {
            const depositAmount = toNano('1');

            const result = await payment.send(
                user1.getSender(),
                {
                    value: depositAmount,
                },
                null,
            );

            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: payment.address,
                success: true,
            });

            // Check state updates
            const totalDeposited = await payment.getTotalDeposited();
            const depositCount = await payment.getDepositCount();
            const userDeposits = await payment.getDepositsForAddress(user1.address);

            expect(totalDeposited).toBe(depositAmount + initial_payment);
            expect(depositCount).toBe(2n); // 1 initial + 1 deposit
            expect(userDeposits).toBe(depositAmount);
        });

        it('should handle multiple deposits from same user', async () => {
            const firstDeposit = toNano('1');
            const secondDeposit = toNano('2');

            // First deposit
            await payment.send(user1.getSender(), { value: firstDeposit }, null);

            // Second deposit
            await payment.send(user1.getSender(), { value: secondDeposit }, null);

            const totalDeposited = await payment.getTotalDeposited();
            const depositCount = await payment.getDepositCount();
            const userDeposits = await payment.getDepositsForAddress(user1.address);

            expect(totalDeposited).toBe(firstDeposit + secondDeposit + initial_payment);
            expect(depositCount).toBe(3n); // 1 initial + 2 deposits
            expect(userDeposits).toBe(firstDeposit + secondDeposit);
        });

        it('should handle deposits from multiple users', async () => {
            const user1Deposit = toNano('1');
            const user2Deposit = toNano('2');

            await payment.send(user1.getSender(), { value: user1Deposit }, null);

            await payment.send(user2.getSender(), { value: user2Deposit }, null);

            const totalDeposited = await payment.getTotalDeposited();
            const user1Deposits = await payment.getDepositsForAddress(user1.address);
            const user2Deposits = await payment.getDepositsForAddress(user2.address);

            expect(totalDeposited).toBe(user1Deposit + user2Deposit + initial_payment);
            expect(user1Deposits).toBe(user1Deposit);
            expect(user2Deposits).toBe(user2Deposit);
        });

        it('should reject zero deposits', async () => {
            const result = await payment.send(user1.getSender(), { value: toNano('0') }, null);

            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: payment.address,
                success: false,
            });
        });
    });

    describe('Structured Deposits (Deposit message)', () => {
        it('should accept deposits with purpose', async () => {
            const depositAmount = toNano('1');
            const purpose = 'Payment for services';

            const result = await payment.send(
                user1.getSender(),
                { value: depositAmount },
                {
                    $$type: 'Deposit',
                    purpose: purpose,
                },
            );

            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: payment.address,
                success: true,
            });

            const totalDeposited = await payment.getTotalDeposited();
            const userDeposits = await payment.getDepositsForAddress(user1.address);

            expect(totalDeposited).toBe(depositAmount + initial_payment);
            expect(userDeposits).toBe(depositAmount);
        });

        it('should emit DepositReceived events', async () => {
            const depositAmount = toNano('1');
            const purpose = 'Test deposit';

            const result = await payment.send(
                user1.getSender(),
                { value: depositAmount },
                {
                    $$type: 'Deposit',
                    purpose: purpose,
                },
            );

            // Check for emitted events in the transaction
            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: payment.address,
                success: true,
            });

            // Verify event
            const depositBody = result.externals[0].body;
            const depositEvent = loadDepositReceived(depositBody.asSlice());
            expect(depositEvent.amount).toEqual(toNano('1'));
            expect(depositEvent.purpose).toBe(purpose);
            expect(depositEvent.sender).toEqualAddress(user1.address);
            expect(depositEvent.timestamp).toBeGreaterThan(1n); // Should be a valid timestamp
        });
    });

    describe('Withdrawals', () => {
        beforeEach(async () => {
            // Add some funds to contract for withdrawal tests
            await payment.send(user1.getSender(), { value: toNano('10') }, null);
        });

        it('should allow owner to withdraw funds', async () => {
            const withdrawAmount = toNano('5');
            const destination = user2.address;

            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') }, // Gas for transaction
                {
                    $$type: 'Withdraw',
                    amount: withdrawAmount,
                    destination: destination,
                    comment: 'Test withdrawal',
                },
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: true,
            });

            // Check withdrawal was executed
            expect(result.transactions).toHaveTransaction({
                from: payment.address,
                to: destination,
                value: withdrawAmount,
                success: true,
            });

            const totalWithdrawn = await payment.getTotalWithdrawn();
            expect(totalWithdrawn).toBe(withdrawAmount);
        });

        it('should prevent non-owner from withdrawing', async () => {
            const withdrawAmount = toNano('1');

            const result = await payment.send(
                nonOwner.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Withdraw',
                    amount: withdrawAmount,
                    destination: nonOwner.address,
                    comment: null,
                },
            );

            expect(result.transactions).toHaveTransaction({
                from: nonOwner.address,
                to: payment.address,
                success: false,
            });
        });

        it('should prevent withdrawal of more than available balance', async () => {
            const excessiveAmount = toNano('100'); // More than contract has

            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Withdraw',
                    amount: excessiveAmount,
                    destination: deployer.address,
                    comment: null,
                },
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: false,
            });
        });

        it('should preserve minimum storage amount', async () => {
            const balance = await payment.getBalance();
            const availableBalance = await payment.getAvailableBalance();

            // Available balance should be less than total balance (due to storage reserve)
            expect(availableBalance).toBeLessThan(balance);

            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Withdraw',
                    amount: balance,
                    destination: deployer.address,
                    comment: null,
                },
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: false,
            });
        });

        it('should reject zero amount withdrawals', async () => {
            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Withdraw',
                    amount: 0n,
                    destination: deployer.address,
                    comment: null,
                },
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: false,
            });
        });
    });

    describe('Ownership Management', () => {
        it('should allow owner to transfer ownership', async () => {
            const newOwner = user1.address;

            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'TransferOwnership',
                    newOwner: newOwner,
                },
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: true,
            });

            const config = await payment.getConfig();
            expect(config.owner).toEqualAddress(newOwner);
        });

        it('should prevent non-owner from transferring ownership', async () => {
            const result = await payment.send(
                nonOwner.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'TransferOwnership',
                    newOwner: nonOwner.address,
                },
            );

            expect(result.transactions).toHaveTransaction({
                from: nonOwner.address,
                to: payment.address,
                success: false,
            });
        });

        it('should prevent transferring ownership to self', async () => {
            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'TransferOwnership',
                    newOwner: payment.address,
                },
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: false,
            });
        });

        it('should allow new owner to perform owner functions after transfer', async () => {
            // Transfer ownership
            await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'TransferOwnership',
                    newOwner: user1.address,
                },
            );

            // Add funds first
            await payment.send(user2.getSender(), { value: toNano('5') }, null);

            // New owner should be able to withdraw
            const result = await payment.send(
                user1.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Withdraw',
                    amount: toNano('1'),
                    destination: user1.address,
                    comment: null,
                },
            );

            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: payment.address,
                success: true,
            });
        });
    });

    describe('Contract State Management (Resumable)', () => {
        it('should allow owner to stop the contract', async () => {
            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                'Stop', // Standard stop message for Resumable trait
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: true,
            });

            const config = await payment.getConfig();
            expect(config.isStopped).toBe(true);
        });

        it('should reject deposits when stopped', async () => {
            // Stop the contract
            await payment.send(deployer.getSender(), { value: toNano('0.1') }, 'Stop');

            // Try to deposit
            const result = await payment.send(user1.getSender(), { value: toNano('1') }, null);

            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: payment.address,
                success: false,
            });
        });

        it('should allow owner to resume the contract', async () => {
            // Stop the contract
            await payment.send(deployer.getSender(), { value: toNano('0.1') }, 'Stop');

            // Resume the contract
            const result = await payment.send(deployer.getSender(), { value: toNano('0.1') }, 'Resume');

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: true,
            });

            const config = await payment.getConfig();
            expect(config.isStopped).toBe(false);
        });
    });

    describe('Getter Functions', () => {
        beforeEach(async () => {
            // Add some test data
            await payment.send(user1.getSender(), { value: toNano('3') }, null);
            await payment.send(user2.getSender(), { value: toNano('2') }, null);
        });

        it('should return correct balance', async () => {
            const balance = await payment.getBalance();
            expect(balance).toBeGreaterThan(toNano('5')); // Initial + deposits
        });

        it('should return correct total deposited', async () => {
            const totalDeposited = await payment.getTotalDeposited();
            expect(totalDeposited).toBe(toNano('5.05'));
        });

        it('should return correct deposit count', async () => {
            const depositCount = await payment.getDepositCount();
            expect(depositCount).toBe(3n); // 1 initial + 2 deposits
        });

        it('should return correct deposits for address', async () => {
            const user1Deposits = await payment.getDepositsForAddress(user1.address);
            const user2Deposits = await payment.getDepositsForAddress(user2.address);
            const unknownUserDeposits = await payment.getDepositsForAddress(nonOwner.address);

            expect(user1Deposits).toBe(toNano('3'));
            expect(user2Deposits).toBe(toNano('2'));
            expect(unknownUserDeposits).toBe(0n);
        });

        it('should return correct available balance', async () => {
            const balance = await payment.getBalance();
            const availableBalance = await payment.getAvailableBalance();

            expect(availableBalance).toBeLessThan(balance);
            expect(availableBalance).toBeGreaterThan(0n);
        });

        it('should return correct config', async () => {
            const config = await payment.getConfig();

            expect(config.owner).toEqualAddress(deployer.address);
            expect(config.isStopped).toBe(false);
            expect(config.totalDeposited).toBe(toNano('5.05'));
            expect(config.totalWithdrawn).toBe(0n);
            expect(config.depositCount).toBe(3n);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle small deposits', async () => {
            const smallAmount = toNano(0.005);

            const result = await payment.send(user1.getSender(), { value: smallAmount }, null);

            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: payment.address,
                success: true,
            });

            const userDeposits = await payment.getDepositsForAddress(user1.address);
            expect(userDeposits).toBe(smallAmount);
        });

        it('should handle maximum TON amounts within reason', async () => {
            const largeAmount = toNano('1000');

            const result = await payment.send(user1.getSender(), { value: largeAmount }, null);

            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: payment.address,
                success: true,
            });
        });

        it('should track state correctly after multiple operations', async () => {
            // Perform multiple deposits and withdrawals
            await payment.send(user1.getSender(), { value: toNano('10') }, null);
            await payment.send(user2.getSender(), { value: toNano('5') }, null);

            await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Withdraw',
                    amount: toNano('3'),
                    destination: deployer.address,
                    comment: null,
                },
            );

            await payment.send(user1.getSender(), { value: toNano('2') }, null);

            // Check final state
            const totalDeposited = await payment.getTotalDeposited();
            const totalWithdrawn = await payment.getTotalWithdrawn();
            const depositCount = await payment.getDepositCount();

            expect(totalDeposited).toBe(toNano('17.05')); // 10 + 5 + 2 + initial
            expect(totalWithdrawn).toBe(toNano('3'));
            expect(depositCount).toBe(4n); // 1 initial + 3 deposits
        });
    });

    describe('Gas Optimization Tests', () => {
        it('should use reasonable gas for deposits', async () => {
            const result = await payment.send(user1.getSender(), { value: toNano('1') }, null);

            // Check that gas consumption is reasonable
            const tx = result.transactions.find(
                (t) => t.inMessage?.info.dest?.toString() === payment.address.toString(),
            );
            expect(tx?.totalFees.coins).toBeLessThan(toNano('0.01'));
        });

        it('should use reasonable gas for withdrawals', async () => {
            // Add funds first
            await payment.send(user1.getSender(), { value: toNano('5') }, null);

            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Withdraw',
                    amount: toNano('1'),
                    destination: user2.address,
                    comment: null,
                },
            );

            const tx = result.transactions.find(
                (t) => t.inMessage?.info.dest?.toString() === payment.address.toString(),
            );
            expect(tx?.totalFees.coins).toBeLessThan(toNano('0.01'));
        });
    });
});
