/**
 * Lottery Scheduler Service
 * 
 * Automatically executes lottery draws at midnight IST using node-cron.
 * This service handles:
 * 1. Calling request_draw with the authority keypair
 * 2. Polling for VRF callback (winner resolution)
 * 3. Calling payout to distribute funds and reset lottery
 * 4. Handling edge case: no participants → call reset
 */

const cron = require('node-cron');
const { Connection, PublicKey, Keypair, Transaction, SystemProgram, ComputeBudgetProgram } = require('@solana/web3.js');
const BN = require('bn.js');
const logger = require('../config/logger');

// Program Constants
const PROGRAM_ID = new PublicKey('A3voJRWMzoy1118ZmTjsoYAGXrM9zPySUPwcgUQ3PV76');
const LOTTERY_STATE_SEED = Buffer.from('lottery_state');
const POT_VAULT_SEED = Buffer.from('pot_vault');
const USER_TICKET_SEED = Buffer.from('user-ticket');

// MagicBlock Ephemeral VRF Devnet Queue
const VRF_QUEUE = new PublicKey('Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh');

class LotterySchedulerService {
    constructor() {
        this.connection = null;
        this.authorityKeypair = null;
        this.isInitialized = false;
        this.isRunning = false;
        this.program = null;
    }

    /**
     * Initialize the lottery scheduler
     */
    initialize(keypairPath) {
        try {
            const anchor = require('@coral-xyz/anchor');
            const network = process.env.SOLANA_NETWORK || 'devnet';
            const endpoint = network === 'mainnet-beta'
                ? 'https://api.mainnet-beta.solana.com'
                : 'https://api.devnet.solana.com';

            this.connection = new Connection(endpoint, 'confirmed');

            // Load authority keypair
            if (keypairPath) {
                if (keypairPath.startsWith('/') || keypairPath.startsWith('.')) {
                    const fs = require('fs');
                    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
                    this.authorityKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
                } else {
                    try {
                        const keypairData = JSON.parse(keypairPath);
                        this.authorityKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
                    } catch {
                        const bs58 = require('bs58');
                        this.authorityKeypair = Keypair.fromSecretKey(bs58.decode(keypairPath));
                    }
                }

                // Set up Anchor Provider and Program
                const wallet = {
                    publicKey: this.authorityKeypair.publicKey,
                    signTransaction: (tx) => {
                        tx.partialSign(this.authorityKeypair);
                        return Promise.resolve(tx);
                    },
                    signAllTransactions: (txs) => {
                        txs.forEach(tx => tx.partialSign(this.authorityKeypair));
                        return Promise.resolve(txs);
                    },
                };

                const provider = new anchor.AnchorProvider(this.connection, wallet, { commitment: 'confirmed' });

                // Load IDL
                const path = require('path');
                const idlPath = path.resolve(__dirname, '../../../hastrology_program/target/idl/hastrology_program.json');
                const fs = require('fs');
                if (fs.existsSync(idlPath)) {
                    const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
                    this.program = new anchor.Program(idl, provider);
                } else {
                    logger.warn('IDL not found at ' + idlPath + ' - Scheduler will have limited functionality');
                }

                logger.info(`Lottery scheduler initialized with Anchor. Authority: ${this.authorityKeypair.publicKey.toBase58()}`);
                this.isInitialized = true;
            } else {
                logger.warn('Lottery scheduler initialized WITHOUT authority keypair.');
                this.isInitialized = false;
            }

            return true;
        } catch (error) {
            logger.error('Failed to initialize lottery scheduler:', error);
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Start the cron scheduler
     */
    startScheduler() {
        if (!this.isInitialized) {
            logger.warn('Lottery scheduler not initialized with keypair. Scheduler will not run automatically.');
            return;
        }

        const job = cron.schedule('0 0 * * *', async () => {
            logger.info('🎰 Midnight IST - Starting automatic lottery draw...');
            await this.executeDraw();
        }, {
            timezone: 'Asia/Kolkata'
        });

        logger.info('✅ Lottery scheduler started. Will run at midnight IST (00:00 Asia/Kolkata)');
        return job;
    }

    /**
     * Get lottery state PDAs
     */
    getLotteryStatePDA() {
        return PublicKey.findProgramAddressSync([LOTTERY_STATE_SEED], PROGRAM_ID);
    }

    getPotVaultPDA() {
        return PublicKey.findProgramAddressSync([POT_VAULT_SEED], PROGRAM_ID);
    }

    getUserTicketPDA(lotteryId, ticketIndex) {
        const lotteryIdBuffer = lotteryId.toArrayLike(Buffer, 'le', 8);
        const ticketIndexBuffer = ticketIndex.toArrayLike(Buffer, 'le', 8);
        return PublicKey.findProgramAddressSync(
            [USER_TICKET_SEED, lotteryIdBuffer, ticketIndexBuffer],
            PROGRAM_ID
        );
    }

    /**
     * Fetch current lottery state
     */
    async fetchLotteryState() {
        if (this.program) {
            const [lotteryStatePDA] = this.getLotteryStatePDA();
            return await this.program.account.lotteryState.fetch(lotteryStatePDA);
        }
        throw new Error('Program not initialized');
    }

    /**
     * Execute the lottery draw
     */
    async executeDraw() {
        if (this.isRunning) {
            logger.warn('Draw already in progress, skipping...');
            return;
        }

        this.isRunning = true;
        logger.info('='.repeat(60));
        logger.info('LOTTERY DRAW EXECUTION STARTED');
        logger.info('='.repeat(60));

        try {
            const [lotteryStatePDA] = this.getLotteryStatePDA();
            const [potVaultPDA] = this.getPotVaultPDA();

            // Fetch current state
            let state = await this.fetchLotteryState();
            logger.info(`Lottery ID: ${state.currentLotteryId.toString()}`);
            logger.info(`Participants: ${state.totalParticipants.toString()}`);
            logger.info(`Endtime: ${new Date(Number(state.lotteryEndtime) * 1000).toISOString()}`);

            // Check if lottery ended
            const now = Math.floor(Date.now() / 1000);
            if (now < Number(state.lotteryEndtime)) {
                logger.info('⏳ Lottery endtime has not passed yet. Skipping draw.');
                this.isRunning = false;
                return;
            }

            // No participants case
            if (Number(state.totalParticipants) === 0) {
                logger.info('📭 No participants. Skipping draw.');
                this.isRunning = false;
                return;
            }

            // Step 1: Request Draw
            logger.info('\n1. Requesting Randomness Draw...');
            try {
                // If already drawing, skip request
                if (state.isDrawing) {
                    logger.info('Lottery is already in drawing state.');
                } else {
                    await this.requestDraw(lotteryStatePDA);
                    logger.info('✅ Draw Requested! Waiting for VRF callback...');
                }
            } catch (e) {
                logger.error('⚠️ Request Draw failed:', e);
                // Continue to polling in case it was already drawing
            }

            // Step 2: Poll for winner
            logger.info('\n2. Polling for Winner Resolution...');
            let winnerIndex = 0;

            for (let i = 0; i < 30; i++) {
                await this.sleep(2000);
                state = await this.fetchLotteryState();
                if (Number(state.winner) > 0) {
                    winnerIndex = Number(state.winner);
                    logger.info(`✅ Winner Selected! Ticket Index: ${winnerIndex}`);
                    break;
                }
                process.stdout.write('.');
            }

            if (winnerIndex === 0) {
                logger.error('❌ Timed out waiting for VRF callback.');
                this.isRunning = false;
                return;
            }

            // Step 3: Execute Payout
            logger.info('\n3. Executing Payout...');
            try {
                await this.executePayout(state, lotteryStatePDA, potVaultPDA, winnerIndex);
                logger.info('✅ Payout Successful! Lottery reset.');
            } catch (e) {
                logger.error('❌ Payout Failed:', e.message);
            }

        } catch (error) {
            logger.error('Draw execution failed:', error);
        } finally {
            this.isRunning = false;
            logger.info('='.repeat(60));
        }
    }

    async requestDraw(lotteryStatePDA) {
        if (!this.program) throw new Error('Program not initialized');
        return await this.program.methods
            .requestDraw()
            .accounts({
                authority: this.authorityKeypair.publicKey,
                lotteryState: lotteryStatePDA,
                oracleQueue: VRF_QUEUE,
            })
            .rpc();
    }

    async executePayout(state, lotteryStatePDA, potVaultPDA, winnerIndex) {
        if (!this.program) throw new Error('Program not initialized');

        const [winningTicketPDA] = this.getUserTicketPDA(
            state.currentLotteryId,
            new BN(winnerIndex - 1)
        );

        const ticket = await this.program.account.userTicket.fetch(winningTicketPDA);
        const winnerPubkey = ticket.user;

        return await this.program.methods
            .payout()
            .accounts({
                authority: this.authorityKeypair.publicKey,
                lotteryState: lotteryStatePDA,
                potVault: potVaultPDA,
                platformWallet: state.platformWallet,
                winningTicket: winningTicketPDA,
                winner: winnerPubkey,
                systemProgram: SystemProgram.programId,
            })
            .preInstructions([
                ComputeBudgetProgram.setComputeUnitPrice({
                    microLamports: 5000,
                })
            ])
            .rpc();
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async triggerManualDraw() {
        if (!this.isInitialized) throw new Error('Not initialized');
        return await this.executeDraw();
    }

    async getStatus() {
        try {
            const state = await this.fetchLotteryState();
            return {
                lotteryId: state.currentLotteryId.toString(),
                participants: state.totalParticipants.toString(),
                endtime: new Date(Number(state.lotteryEndtime) * 1000).toISOString(),
                isDrawing: state.isDrawing,
                winner: state.winner.toString(),
                prizePool: (Number(state.ticketPrice) * Number(state.totalParticipants) / 1e9).toFixed(4) + ' SOL',
            };
        } catch (error) {
            return { error: error.message };
        }
    }
}

const lotteryScheduler = new LotterySchedulerService();
module.exports = lotteryScheduler;
