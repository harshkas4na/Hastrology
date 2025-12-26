const { Connection, PublicKey } = require('@solana/web3.js');
const logger = require('../config/logger');

/**
 * Solana Service - Handles Solana blockchain verification
 */
const BN = require('bn.js');

// Hastrology Program Constants
const PROGRAM_ID = new PublicKey('A3voJRWMzoy1118ZmTjsoYAGXrM9zPySUPwcgUQ3PV76');
const LOTTERY_STATE_SEED = Buffer.from('lottery_state');
const USER_RECEIPT_SEED = Buffer.from('user-receipt');

/**
 * Solana Service - Handles Solana blockchain verification
 */
class SolanaService {
    constructor() {
        // Use devnet for development, mainnet-beta for production
        const network = process.env.SOLANA_NETWORK || 'devnet';
        const endpoint = network === 'mainnet-beta'
            ? 'https://api.mainnet-beta.solana.com'
            : 'https://api.devnet.solana.com';

        this.connection = new Connection(endpoint, 'confirmed');
        this.network = network;

        logger.info(`Solana service initialized on ${network}`);
    }

    /**
     * Verify a transaction signature exists on-chain
     * @param {string} signature - Transaction signature
     * @returns {Promise<boolean>} Verification result
     */
    async verifyTransaction(signature) {
        try {
            logger.info('Verifying Solana transaction:', { signature });

            const tx = await this.connection.getTransaction(signature, {
                commitment: 'confirmed'
            });

            if (!tx) {
                logger.warn('Transaction not found:', { signature });
                return false;
            }

            logger.info('Transaction verified successfully:', { signature });
            return true;
        } catch (error) {
            logger.error('Transaction verification error:', error);
            return false;
        }
    }

    /**
     * Get the current lottery ID from the on-chain state
     * @returns {Promise<BN>} Current lottery ID
     */
    async getCurrentLotteryId() {
        try {
            const [lotteryStatePDA] = PublicKey.findProgramAddressSync(
                [LOTTERY_STATE_SEED],
                PROGRAM_ID
            );

            const accountInfo = await this.connection.getAccountInfo(lotteryStatePDA);

            if (!accountInfo) {
                throw new Error('Lottery state not found on-chain');
            }

            // Decode current_lottery_id from LotteryState account
            // structure: discriminator(8) + authority(32) + pot_vault(32) + platform_wallet(32) 
            // + platform_fee(2) + ticket_price(8) + winner(8) + current_lottery_id(8) ...
            const offset = 8 + 32 + 32 + 32 + 2 + 8 + 8;

            // Read u64 little-endian
            const currentLotteryId = new BN(accountInfo.data.slice(offset, offset + 8), 'le');

            return currentLotteryId;
        } catch (error) {
            logger.error('Error fetching lottery state:', error);
            throw error;
        }
    }

    /**
     * Verify if a user has entered the current lottery
     * @param {string} walletAddress - User's wallet address
     * @returns {Promise<boolean>} True if entered
     */
    async verifyLotteryParticipation(walletAddress) {
        try {
            const userPubkey = new PublicKey(walletAddress);
            const currentLotteryId = await this.getCurrentLotteryId();

            // Derive UserEntryReceipt PDA
            // Seeds: ["user-receipt", user_pubkey, lottery_id (u64 le)]
            const lotteryIdBuffer = currentLotteryId.toArrayLike(Buffer, 'le', 8);

            const [userReceiptPDA] = PublicKey.findProgramAddressSync(
                [USER_RECEIPT_SEED, userPubkey.toBuffer(), lotteryIdBuffer],
                PROGRAM_ID
            );

            // Check if account exists
            const accountInfo = await this.connection.getAccountInfo(userReceiptPDA);

            const hasEntered = accountInfo !== null;

            logger.info('Verified lottery participation:', {
                walletAddress,
                lotteryId: currentLotteryId.toString(),
                hasEntered
            });

            return hasEntered;
        } catch (error) {
            logger.error('Lottery verification error:', error);
            return false;
        }
    }

    /**
     * Verify wallet address is valid
     * @param {string} walletAddress - Solana wallet address
     * @returns {boolean} Validity
     */
    isValidWalletAddress(walletAddress) {
        try {
            new PublicKey(walletAddress);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get wallet balance
     * @param {string} walletAddress - Solana wallet address
     * @returns {Promise<number>} Balance in SOL
     */
    async getBalance(walletAddress) {
        try {
            const publicKey = new PublicKey(walletAddress);
            const balance = await this.connection.getBalance(publicKey);
            // Convert lamports to SOL (1 SOL = 1,000,000,000 lamports)
            return balance / 1e9;
        } catch (error) {
            logger.error('Get balance error:', error);
            throw error;
        }
    }

    /**
     * Mock signature verification (for development)
     * In production, this should verify actual on-chain transactions
     * @param {string} signature - Transaction signature
     * @returns {Promise<boolean>} Always true for development
     */
    async mockVerifySignature(signature) {
        logger.warn('Using mock signature verification - NOT FOR PRODUCTION');
        // In development, accept any non-empty signature
        return signature && signature.length > 0;
    }
}

module.exports = new SolanaService();
