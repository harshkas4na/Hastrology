const userService = require('../services/user.service');
const horoscopeService = require('../services/horoscope.service');
const aiService = require('../services/ai.service');
const solanaService = require('../services/solana.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../config/logger');

/**
 * Horoscope Controller - Handles horoscope-related HTTP requests
 */
class HoroscopeController {
    /**
     * Get horoscope status for a wallet address
     * @route GET /api/horoscope/status
     */
    async getStatus(req, res, next) {
        try {
            const { walletAddress } = req.query;

            if (!walletAddress) {
                return errorResponse(res, 'walletAddress is required', 400);
            }

            // Check if user exists
            const user = await userService.findUserByWallet(walletAddress);

            if (!user) {
                return successResponse(res, { status: 'new_user' });
            }

            // Get horoscope status
            const status = await horoscopeService.getHoroscopeStatus(walletAddress);

            return successResponse(res, status);
        } catch (error) {
            logger.error('Get status controller error:', error);
            next(error);
        }
    }

    /**
     * Confirm payment and generate horoscope
     * @route POST /api/horoscope/confirm
     */
    async confirm(req, res, next) {
        try {
            const { walletAddress, signature } = req.body;

            // Verify user exists
            const user = await userService.findUserByWallet(walletAddress);

            if (!user) {
                return errorResponse(res, 'User not found. Please register first.', 404);
            }

            // Check if horoscope cards already exist for today
            const existingHoroscope = await horoscopeService.getHoroscope(walletAddress);

            if (existingHoroscope && existingHoroscope.cards) {
                return successResponse(res, {
                    message: 'Horoscope already generated for today',
                    cards: existingHoroscope.cards,
                    date: existingHoroscope.date
                });
            }

            // Verify lottery participation via on-chain PDA
            const hasParticipated = await solanaService.verifyLotteryParticipation(walletAddress);

            if (!hasParticipated) {
                // If PDA check fails, we can fallback to signature verification for legacy support or retry
                // But for the new lottery system, PDA is the source of truth
                logger.warn('User has not entered the lottery:', { walletAddress });
                return res.status(402).json({
                    success: false,
                    message: 'Please enter the lottery to view your horoscope'
                });
            }

            logger.info('Payment/Lottery entry verified for:', { walletAddress, signature });

            logger.info('Payment verified, generating horoscope cards', { walletAddress });

            // Generate horoscope cards using AI
            const cards = await aiService.generateHoroscope({
                dob: user.dob,
                birthTime: user.birth_time,
                birthPlace: user.birth_place
            });

            // Save horoscope cards to database
            const horoscope = await horoscopeService.saveHoroscope({
                walletAddress,
                cards
            });

            logger.info('Horoscope cards generated and saved', { walletAddress });

            return successResponse(res, {
                cards: cards,
                date: horoscope.date
            });
        } catch (error) {
            if (error.message === 'AI_SERVER_UNAVAILABLE') {
                return errorResponse(res, 'AI server is currently unavailable. Please try again later.', 503);
            }
            if (error.message === 'AI_SERVER_TIMEOUT') {
                return errorResponse(res, 'Horoscope generation timed out. Please try again.', 504);
            }
            if (error.message === 'HOROSCOPE_ALREADY_EXISTS') {
                return errorResponse(res, 'Horoscope already generated for today', 409);
            }

            logger.error('Confirm controller error:', error);
            next(error);
        }
    }

    /**
     * Get user's horoscope history
     * @route GET /api/horoscope/history/:walletAddress
     */
    async getHistory(req, res, next) {
        try {
            const { walletAddress } = req.params;
            const limit = parseInt(req.query.limit) || 10;

            const horoscopes = await horoscopeService.getUserHoroscopes(walletAddress, limit);

            return successResponse(res, {
                count: horoscopes.length,
                horoscopes: horoscopes.map(h => ({
                    date: h.date,
                    horoscopeText: h.horoscope_text,
                    createdAt: h.created_at
                }))
            });
        } catch (error) {
            logger.error('Get history controller error:', error);
            next(error);
        }
    }
}

module.exports = new HoroscopeController();
