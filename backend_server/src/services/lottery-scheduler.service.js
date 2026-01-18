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
                try {
                    if (keypairPath.startsWith('/') || keypairPath.startsWith('.')) {
                        const fs = require('fs');
                        if (fs.existsSync(keypairPath)) {
                            const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
                            this.authorityKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
                        } else {
                            throw new Error(`Keypair file not found at path: ${keypairPath}`);
                        }
                    } else {
                        try {
                            const keypairData = JSON.parse(keypairPath);
                            this.authorityKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
                        } catch {
                            const bs58 = require('bs58');
                            this.authorityKeypair = Keypair.fromSecretKey(bs58.decode(keypairPath));
                        }
                    }
                } catch (keypairError) {
                    this.initializationError = `Invalid Keypair: ${keypairError.message}`;
                    logger.error('Failed to parse authority keypair:', keypairError);
                    this.isInitialized = false;
                    return false;
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

                // Load IDL - Look in bundled location first
                const path = require('path');
                // Try bundled IDL path first
                let idlPath = path.resolve(__dirname, '../idl/hastrology_program.json');
                const fs = require('fs');

                // Fallback to target directory (for local dev if bundled missing)
                if (!fs.existsSync(idlPath)) {
                    idlPath = path.resolve(__dirname, '../../../hastrology_program/target/idl/hastrology_program.json');
                }

                if (fs.existsSync(idlPath)) {
                    try {
                        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
                        this.program = new anchor.Program(idl, provider);

                        logger.info(`Lottery scheduler initialized with Anchor. Authority: ${this.authorityKeypair.publicKey.toBase58()}`);
                        this.isInitialized = true;
                        this.initializationError = null;
                        return true;
                    } catch (idlError) {
                        this.initializationError = `Invalid IDL file: ${idlError.message}`;
                        logger.error('Failed to parse IDL:', idlError);
                    }
                } else {
                    this.initializationError = 'IDL file not found. Ensure src/idl/hastrology_program.json exists.';
                    logger.warn('IDL not found at ' + idlPath + ' - Scheduler will have limited functionality');
                }
            } else {
                this.initializationError = 'LOTTERY_AUTHORITY_KEYPAIR environment variable not set';
                logger.warn('Lottery scheduler initialized WITHOUT authority keypair.');
            }

            this.isInitialized = false;
            return false;
        } catch (error) {
            this.initializationError = `Unexpected initialization error: ${error.message}`;
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

        // Start midnight draw cron job
        const job = cron.schedule('0 0 * * *', async () => {
            logger.info('🎰 Midnight IST - Starting automatic lottery draw...');
            await this.executeDraw();
        }, {
            timezone: 'Asia/Kolkata'
        });

        // Start health check cron job (every 5 minutes)
        cron.schedule('*/5 * * * *', async () => {
            await this.runHealthCheck();
        }, {
            timezone: 'Asia/Kolkata'
        });

        // Run initial health check on startup
        setTimeout(() => this.runHealthCheck(), 5000);

        logger.info('✅ Lottery scheduler started. Will run at midnight IST (00:00 Asia/Kolkata)');
        logger.info('✅ Health check scheduler started. Will run every 5 minutes.');
        return job;
    }

    /**
     * Run a health check on the lottery state
     * Detects and recovers from stuck lotteries
     */
    async runHealthCheck() {
        if (!this.isInitialized) return;

        try {
            const state = await this.fetchLotteryState();
            const now = Math.floor(Date.now() / 1000);
            const endtime = Number(state.lotteryEndtime);
            const participants = Number(state.totalParticipants);
            const winner = Number(state.winner);
            const isDrawing = state.isDrawing;

            // Calculate time since lottery ended
            const timeSinceEnd = now - endtime;
            const hoursSinceEnd = timeSinceEnd / 3600;

            // Health check conditions
            const issues = [];

            // Issue 1: Lottery ended but no winner selected and not drawing
            if (timeSinceEnd > 0 && participants > 0 && winner === 0 && !isDrawing) {
                issues.push({
                    type: 'EXPIRED_NO_DRAW',
                    message: `Lottery #${state.currentLotteryId} expired ${hoursSinceEnd.toFixed(1)} hours ago with ${participants} participants but no draw initiated`,
                    severity: 'HIGH',
                    autoRecover: true
                });
            }

            // Issue 2: Lottery stuck in drawing state for too long (> 1 hour)
            if (isDrawing && timeSinceEnd > 3600) {
                issues.push({
                    type: 'STUCK_DRAWING',
                    message: `Lottery #${state.currentLotteryId} has been in drawing state for over ${hoursSinceEnd.toFixed(1)} hours`,
                    severity: 'CRITICAL',
                    autoRecover: true
                });
            }

            // Issue 3: Winner selected but not paid out (lottery not reset)
            if (winner > 0 && participants > 0 && timeSinceEnd > 300) {
                issues.push({
                    type: 'UNPAID_WINNER',
                    message: `Lottery #${state.currentLotteryId} has winner #${winner} but payout not completed`,
                    severity: 'HIGH',
                    autoRecover: true
                });
            }

            // Log and handle issues
            if (issues.length > 0) {
                logger.warn('⚠️ Lottery Health Check Issues Detected:');
                for (const issue of issues) {
                    logger.warn(`  [${issue.severity}] ${issue.type}: ${issue.message}`);
                }

                // Attempt auto-recovery
                await this.attemptRecovery(issues, state);
            } else {
                logger.debug('✓ Lottery health check passed');
            }

            return { healthy: issues.length === 0, issues };
        } catch (error) {
            logger.error('Health check failed:', error.message);
            return { healthy: false, error: error.message };
        }
    }

    /**
     * Attempt to recover from detected issues
     */
    async attemptRecovery(issues, state) {
        for (const issue of issues) {
            if (!issue.autoRecover) continue;

            try {
                switch (issue.type) {
                    case 'EXPIRED_NO_DRAW':
                        // Try to trigger a draw
                        logger.info('🔧 Auto-recovery: Attempting to trigger draw...');
                        if (!this.isRunning) {
                            await this.executeDraw();
                        }
                        break;

                    case 'STUCK_DRAWING':
                        // Log for manual intervention - can't safely reset isDrawing without Solana tx
                        logger.warn('🔧 Auto-recovery: isDrawing stuck. Manual intervention may be needed.');
                        logger.warn('   Use update_config to reset isDrawing flag if VRF callback failed.');
                        // Attempt draw anyway - might recover if VRF callback eventually arrives
                        if (!this.isRunning) {
                            await this.executeDraw();
                        }
                        break;

                    case 'UNPAID_WINNER':
                        // Try to complete payout
                        logger.info('🔧 Auto-recovery: Attempting to complete payout...');
                        if (!this.isRunning) {
                            await this.executeDraw(); // executeDraw will handle payout if winner exists
                        }
                        break;

                    default:
                        logger.warn(`No auto-recovery available for ${issue.type}`);
                }
            } catch (error) {
                logger.error(`Recovery for ${issue.type} failed:`, error.message);
            }
        }
    }

    /**
     * Get detailed health status
     */
    async getHealthStatus() {
        if (!this.isInitialized) {
            return {
                initialized: false,
                healthy: false,
                message: 'Scheduler not initialized'
            };
        }

        const healthCheck = await this.runHealthCheck();
        const status = await this.getStatus();

        return {
            initialized: true,
            running: !this.isRunning,
            ...status,
            ...healthCheck
        };
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
