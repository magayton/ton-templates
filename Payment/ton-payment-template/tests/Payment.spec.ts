import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Cell, Address } from '@ton/core';
import { Payment, loadDepositReceived, loadWithdrawalExecuted} from '../build/Payment/Payment_Payment';
import '@ton/test-utils';

describe('Payment', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let user1: SandboxContract<TreasuryContract>;
    let user2: SandboxContract<TreasuryContract>;
    let nonOwner: SandboxContract<TreasuryContract>;
    let payment: SandboxContract<Payment>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        // Create test accounts
        deployer = await blockchain.treasury('deployer');
        user1 = await blockchain.treasury('user1');
        user2 = await blockchain.treasury('user2');
        nonOwner = await blockchain.treasury('nonOwner');

        // Deploy the contract
        payment = blockchain.openContract(await Payment.fromInit(deployer.address, false));

        const deployResult = await payment.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
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

            const balance = await payment.getBalance();
            expect(balance).toBeGreaterThan(0n); // Should have deployment value
            
            const availableBalance = await payment.getAvailableBalance();
            expect(availableBalance).toBeGreaterThanOrEqual(0n);
        });

        it('should have correct initial owner', async () => {
            const owner = await payment.getOwner();
            expect(owner.toString()).toEqual(deployer.address.toString());
        });

        it('should have correct initial state', async () => {
            const balance = await payment.getBalance();
            const availableBalance = await payment.getAvailableBalance();
            
            expect(balance).toBeGreaterThan(0n);
            expect(availableBalance).toBeLessThanOrEqual(balance);
        });
    });

    describe('Plain TON Deposits (receive())', () => {
        it('should accept plain TON transfers', async () => {
            const depositAmount = toNano('1');
            const initialBalance = await payment.getBalance();
            
            const result = await payment.send(
                user1.getSender(),
                {
                    value: depositAmount,
                },
                null
            );

            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: payment.address,
                success: true,
            });

            // Check balance increased
            const newBalance = await payment.getBalance();
            expect(newBalance).toBeGreaterThan(initialBalance);
        });

        it('should emit DepositReceived events', async () => {
            const depositAmount = toNano('1');

            const result = await payment.send(
                user1.getSender(),
                { value: depositAmount },
                null
            );

            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: payment.address,
                success: true,
            });

            // Verify event
            const depositBody = result.externals[0].body;
            const depositEvent = loadDepositReceived(depositBody.asSlice());
            expect(depositEvent.amount).toEqual(toNano('1'));
            expect(depositEvent.sender).toEqualAddress(user1.address);
            expect(depositEvent.timestamp).toBeGreaterThan(1n); // Should be a valid timestamp
        });

        it('should handle multiple deposits from same user', async () => {
            const firstDeposit = toNano('1');
            const secondDeposit = toNano('2');
            const initialBalance = await payment.getBalance();

            // First deposit
            await payment.send(
                user1.getSender(),
                { value: firstDeposit },
                null
            );

            // Second deposit
            await payment.send(
                user1.getSender(),
                { value: secondDeposit },
                null
            );

            const finalBalance = await payment.getBalance();
            expect(finalBalance).toBeGreaterThan(initialBalance + firstDeposit);
        });

        it('should handle deposits from multiple users', async () => {
            const user1Deposit = toNano('1');
            const user2Deposit = toNano('2');
            const initialBalance = await payment.getBalance();

            await payment.send(
                user1.getSender(),
                { value: user1Deposit },
                null
            );

            await payment.send(
                user2.getSender(),
                { value: user2Deposit },
                null
            );

            const finalBalance = await payment.getBalance();
            expect(finalBalance).toBeGreaterThan(initialBalance + user1Deposit);
        });

        it('should reject zero deposits', async () => {
            const result = await payment.send(
                user1.getSender(),
                { value: toNano('0') },
                null
            );

            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: payment.address,
                success: false,
            });
        });

        it('should handle small deposits', async () => {
            const smallAmount = toNano('0.01');
            const initialBalance = await payment.getBalance();

            const result = await payment.send(
                user1.getSender(),
                { value: smallAmount },
                null
            );

            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: payment.address,
                success: true,
            });

            const newBalance = await payment.getBalance();
            expect(newBalance).toBeGreaterThan(initialBalance);
        });
    });

    describe('Withdrawals', () => {
        beforeEach(async () => {
            // Add some funds to contract for withdrawal tests
            await payment.send(
                user1.getSender(),
                { value: toNano('3') },
                null
            );
        });

        it('should allow owner to withdraw funds', async () => {
            const withdrawAmount = toNano('1.2');
            const destination = user2.address;
            const initialBalance = await payment.getBalance();

            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') }, // Gas for transaction
                {
                    $$type: 'Withdraw',
                    amount: withdrawAmount,
                    destination: destination,
                }
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
                success: true,
            });

            // Check contract balance decreased
            const newBalance = await payment.getBalance();
            expect(newBalance).toBeLessThan(initialBalance);
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
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: nonOwner.address,
                to: payment.address,
                success: false,
            });
        });

        it('should prevent withdrawal of more than available balance', async () => {
            const excessiveAmount = await payment.getBalance() + BigInt(toNano('0.05')); // Add buffer

            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Withdraw',
                    amount: excessiveAmount,
                    destination: deployer.address,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: false,
            });
        });

        it('should preserve minimum storage amount', async () => {
            const availableBalance = await payment.getAvailableBalance();
            
            // Try to withdraw slightly more than available (should fail)
            const excessiveAmount = availableBalance + toNano('0.01');

            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Withdraw',
                    amount: excessiveAmount,
                    destination: deployer.address,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: false,
            });
        });

        it('should succeed when withdrawing available balance', async () => {
            const availableBalance = await payment.getAvailableBalance();
    
            // Withdraw slightly less than available (due to strict < comparison)
            const withdrawAmount = availableBalance - toNano('0.01');
            
            const deployerBalanceBefore = await deployer.getBalance();

            // This should succeed
            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Withdraw',
                    amount: withdrawAmount,
                    destination: deployer.address,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: true,
            });

            expect(result.transactions).toHaveTransaction({
                from: payment.address,
                to: deployer.address,
                success: true,
            });

            const deployerBalanceAfter = await deployer.getBalance();
            expect(deployerBalanceAfter).toBeGreaterThan(deployerBalanceBefore);
        });

        it('should reject zero amount withdrawals', async () => {
            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Withdraw',
                    amount: 0n,
                    destination: deployer.address,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: false,
            });
        });

        it('should emit WithdrawalExecuted events', async () => {
            const withdrawAmount = toNano('1');

            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Withdraw',
                    amount: withdrawAmount,
                    destination: user2.address,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: true,
            });

            // Verify event
            const depositBody = result.externals[0].body;
            const depositEvent = loadWithdrawalExecuted(depositBody.asSlice());
            expect(depositEvent.amount).toEqual(toNano('1'));
            expect(depositEvent.destination).toEqualAddress(user2.address);
            expect(depositEvent.timestamp).toBeGreaterThan(1n); // Should be a valid timestamp
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
                    newOwner: newOwner
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: true,
            });

            // Verify new owner can perform owner actions
            await payment.send(
                user1.getSender(),
                { value: toNano('5') }, // Add some funds first
                null
            );

            const withdrawResult = await payment.send(
                user1.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Withdraw',
                    amount: toNano('1'),
                    destination: user1.address,
                }
            );

            expect(withdrawResult.transactions).toHaveTransaction({
                from: user1.address,
                to: payment.address,
                success: true,
            });
        });

        it('should prevent non-owner from transferring ownership', async () => {
            const result = await payment.send(
                nonOwner.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'TransferOwnership',
                    newOwner: nonOwner.address
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: nonOwner.address,
                to: payment.address,
                success: false,
            });
        });

        it('should prevent transferring ownership to contract itself', async () => {
            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'TransferOwnership',
                    newOwner: payment.address
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: false,
            });
        });

        it('should prevent old owner from performing actions after transfer', async () => {
            // Transfer ownership
            await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'TransferOwnership',
                    newOwner: user1.address
                }
            );

            // Old owner should no longer be able to withdraw
            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Withdraw',
                    amount: toNano('1'),
                    destination: deployer.address,
                }
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: false,
            });
        });
    });

    describe('Contract State Management (Resumable)', () => {
        it('should allow owner to stop the contract', async () => {
            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                "Stop" // Standard stop message for Resumable trait
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: true,
            });
        });

        it('should reject deposits when stopped', async () => {
            // Stop the contract
            await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                "Stop"
            );

            // Try to deposit
            const result = await payment.send(
                user1.getSender(),
                { value: toNano('1') },
                null
            );

            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: payment.address,
                success: false,
            });
        });

        it('should allow owner to resume the contract', async () => {
            // Stop the contract
            await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                "Stop"
            );

            // Resume the contract
            const result = await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                "Resume"
            );

            expect(result.transactions).toHaveTransaction({
                from: deployer.address,
                to: payment.address,
                success: true,
            });

            // Should accept deposits again
            const depositResult = await payment.send(
                user1.getSender(),
                { value: toNano('1') },
                null
            );

            expect(depositResult.transactions).toHaveTransaction({
                from: user1.address,
                to: payment.address,
                success: true,
            });
        });

        it('should prevent non-owner from stopping contract', async () => {
            const result = await payment.send(
                nonOwner.getSender(),
                { value: toNano('0.1') },
                "Stop"
            );

            expect(result.transactions).toHaveTransaction({
                from: nonOwner.address,
                to: payment.address,
                success: false,
            });
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
            expect(balance).toBeGreaterThan(toNano('5')); // At least deposits + deployment
        });

        it('should return correct available balance', async () => {
            const balance = await payment.getBalance();
            const availableBalance = await payment.getAvailableBalance();
            
            expect(availableBalance).toBeLessThan(balance);
            expect(availableBalance).toBeGreaterThan(0n);
            expect(balance - availableBalance).toEqual(toNano('0.05')); // MIN_TON_FOR_STORAGE
        });

        it('should handle edge case when balance is at minimum', async () => {
            // Withdraw almost everything
            const availableBalance = await payment.getAvailableBalance();
            
            await payment.send(
                deployer.getSender(),
                { value: toNano('0.1') },
                {
                    $$type: 'Withdraw',
                    amount: availableBalance,
                    destination: deployer.address,
                }
            );

            const newAvailableBalance = await payment.getAvailableBalance();
            expect(newAvailableBalance).toBeGreaterThanOrEqual(toNano('0.05')); // Should be at least MIN_TON_FOR_STORAGE
        });
    });

    describe('Gas Optimization and Performance', () => {
        it('should use reasonable gas for deposits', async () => {
            const result = await payment.send(
                user1.getSender(),
                { value: toNano('1') },
                null
            );

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
                }
            );

            // Check that gas consumption is reasonable
            const tx = result.transactions.find(
                (t) => t.inMessage?.info.dest?.toString() === payment.address.toString(),
            );
            expect(tx?.totalFees.coins).toBeLessThan(toNano('0.01'));
        });

        it('should handle large amounts efficiently', async () => {
            const largeAmount = toNano('1000');

            const result = await payment.send(
                user1.getSender(),
                { value: largeAmount },
                null
            );

            expect(result.transactions).toHaveTransaction({
                from: user1.address,
                to: payment.address,
                success: true,
            });

            // Gas should still be reasonable even for large amounts
            const tx = result.transactions.find(
                (t) => t.inMessage?.info.dest?.toString() === payment.address.toString(),
            );
            expect(tx?.totalFees.coins).toBeLessThan(toNano('0.01'));
        });
    });
});