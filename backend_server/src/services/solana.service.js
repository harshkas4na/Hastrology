const { Connection, PublicKey } = require('@solana/web3.js');
const logger = require('../config/logger');

/**
 * Solana Service - Handles Solana blockchain verification
 */
const BN = require('bn.js');

// Hastrology Program Constants
// Hastrology Program Constants
const PROGRAM_ID = new PublicKey('A3voJRWMzoy1118ZmTjsoYAGXrM9zPySUPwcgUQ3PV76');

/**
 * Solana Service - Handles Solana blockchain verification
 */
class SolanaService {
    constructor() {
        // Use devnet for development, mainnet-beta for production
        const network = process.env.SOLANA_NETWORK || 'mainnet-beta';
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
