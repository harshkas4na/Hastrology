const axios = require('axios');
const { getConfig } = require('../config/environment');
const logger = require('../config/logger');

/**
 * AI Service - Handles communication with the Python AI server
 */
class AIService {
    constructor() {
        const config = getConfig();
        this.aiServerUrl = config.aiServer.url;
    }

    /**
     * Generate horoscope cards using AI server
     * @param {Object} birthDetails - User's birth details
     * @returns {Promise<Object>} Generated horoscope cards
     */
    async generateHoroscope({ dob, birthTime, birthPlace }) {
        try {
            logger.info('Requesting horoscope cards from AI server');

            const response = await axios.post(
                `${this.aiServerUrl}/generate_horoscope`,
                {
                    dob: dob,
                    birth_time: birthTime,
                    birth_place: birthPlace
                },
                {
                    timeout: 60000, // 60 second timeout (increased for card generation)
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            // New response format: { cards: {...}, cached: bool }
            if (!response.data || !response.data.cards) {
                throw new Error('Invalid response from AI server');
            }

            logger.info('Horoscope cards generated successfully');
            return response.data.cards;
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                logger.error('AI server is not running or not reachable');
                throw new Error('AI_SERVER_UNAVAILABLE');
            } else if (error.code === 'ETIMEDOUT') {
                logger.error('AI server request timeout');
                throw new Error('AI_SERVER_TIMEOUT');
            } else {
                logger.error('AI server error:', error.message);
                throw error;
            }
        }
    }

    /**
     * Check if AI server is healthy
     * @returns {Promise<boolean>} Health status
     */
    async healthCheck() {
        try {
            const response = await axios.get(`${this.aiServerUrl}/`, {
                timeout: 5000
            });

            return response.status === 200;
        } catch (error) {
            logger.error('AI server health check failed:', error.message);
            return false;
        }
    }
}

module.exports = new AIService();

