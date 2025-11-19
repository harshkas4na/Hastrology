const jwt = require('jsonwebtoken');
const { getConfig } = require('../config/environment');
const logger = require('../config/logger');

/**
 * Authentication Service - Handles JWT token operations
 */
class AuthService {
    constructor() {
        const config = getConfig();
        this.jwtSecret = config.security.jwtSecret;
    }

    /**
     * Generate JWT token for wallet address
     * @param {string} walletAddress - User's wallet address
     * @param {Object} additionalClaims - Additional JWT claims
     * @returns {string} JWT token
     */
    generateToken(walletAddress, additionalClaims = {}) {
        try {
            const payload = {
                wallet_address: walletAddress,
                ...additionalClaims,
                iat: Math.floor(Date.now() / 1000),
            };

            const token = jwt.sign(payload, this.jwtSecret, {
                expiresIn: '24h' // Token expires in 24 hours
            });

            logger.info('JWT token generated', { walletAddress });
            return token;
        } catch (error) {
            logger.error('Token generation error:', error);
            throw error;
        }
    }

    /**
     * Verify and decode JWT token
     * @param {string} token - JWT token to verify
     * @returns {Object} Decoded token payload
     */
    verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            return decoded;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                logger.warn('Token expired');
                throw new Error('TOKEN_EXPIRED');
            } else if (error.name === 'JsonWebTokenError') {
                logger.warn('Invalid token');
                throw new Error('INVALID_TOKEN');
            }
            logger.error('Token verification error:', error);
            throw error;
        }
    }

    /**
     * Extract token from Authorization header
     * @param {string} authHeader - Authorization header value
     * @returns {string|null} Token or null
     */
    extractTokenFromHeader(authHeader) {
        if (!authHeader) return null;

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return null;
        }

        return parts[1];
    }
}

module.exports = new AuthService();
