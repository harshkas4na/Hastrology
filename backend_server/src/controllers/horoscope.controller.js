const userService = require('../services/user.service');
const horoscopeService = require('../services/horoscope.service');
const aiService = require('../services/ai.service');
const solanaService = require('../services/solana.service');
const twitterService = require('../services/twitter.service');
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

            // Get horoscope status from service (checks DB first)
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

            // Check if horoscope card already exists for today
            const existingHoroscope = await horoscopeService.getHoroscope(walletAddress);

            if (existingHoroscope && existingHoroscope.cards) {
                // Handle both old format (dict of cards) and new format (single card)
                const cardData = existingHoroscope.cards;
                // If it's a single card object (has front/back), return as card
                // Otherwise return as cards for backwards compatibility
                if (cardData.front && cardData.back) {
                    return successResponse(res, {
                        message: 'Horoscope already generated for today',
                        card: cardData,
                        date: existingHoroscope.date
                    });
                } else {
                    return successResponse(res, {
                        message: 'Horoscope already generated for today',
                        cards: cardData,
                        date: existingHoroscope.date
                    });
                }
            }

            // PAYMENT DISABLED: Horoscope generation is free for now
            // Uncomment the block below to re-enable payment verification
            /*
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
            */

            logger.info('Generating horoscope card (free mode)', { walletAddress });

            // Fetch enriched X context for personalization (bio, tweets, persona)
            let xContext = { available: false, handle: user.twitter_username };
            try {
                xContext = await twitterService.getEnrichedXContext(user);
                logger.info('X context fetched:', {
                    handle: xContext.handle,
                    hasBio: !!xContext.bio,
                    tweetCount: xContext.recentTweets?.length || 0,
                    persona: xContext.persona
                });
            } catch (error) {
                logger.warn('Failed to fetch X context, continuing with basic info:', error.message);
            }

            // Generate horoscope card using AI with coordinates for CDO and enriched X context
            const card = await aiService.generateHoroscope({
                dob: user.dob,
                birthTime: user.birth_time,
                birthPlace: user.birth_place,
                latitude: user.latitude,
                longitude: user.longitude,
                timezoneOffset: user.timezone_offset,
                xHandle: xContext.handle || user.twitter_username,
                xBio: xContext.bio,
                xRecentTweets: xContext.recentTweets,
                xPersona: xContext.persona
            });


            // Save horoscope card to database (stored as single card object)
            const horoscope = await horoscopeService.saveHoroscope({
                walletAddress,
                cards: card  // Store as single card, backend service expects 'cards' key
            });

            logger.info('Horoscope card generated and saved', { walletAddress });

            return successResponse(res, {
                card: card,
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
