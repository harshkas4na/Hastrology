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
     * Generate horoscope card using AI server
     * @param {Object} birthDetails - User's birth details including coordinates
     * @returns {Promise<Object>} Generated horoscope card (single card)
     */
    async generateHoroscope({ dob, birthTime, birthPlace, latitude, longitude, timezoneOffset, xHandle, xBio, xRecentTweets, xPersona }) {
        try {
            logger.info('Requesting horoscope cards from AI server', { latitude, longitude, xHandle, xPersona });

            const response = await axios.post(
                `${this.aiServerUrl}/generate_horoscope`,
                {
                    dob: dob,
                    birth_time: birthTime,
                    birth_place: birthPlace,
                    latitude: latitude || 0,
                    longitude: longitude || 0,
                    timezone_offset: timezoneOffset || 0,
                    x_handle: xHandle || null,
                    x_bio: xBio || null,
                    x_recent_tweets: xRecentTweets || [],
                    x_persona: xPersona || null
                },
                {
                    timeout: 60000, // 60 second timeout (increased for card generation)
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            // New response format: { card: {...}, cached: bool, generation_mode: 'cdo' | 'fallback' }
            if (!response.data || !response.data.card) {
                throw new Error('Invalid response from AI server');
            }

            logger.info('Horoscope card generated successfully', { mode: response.data.generation_mode });

            const card = response.data.card;
            // Ensure ruling_planet_theme is present (frontend expects this)
            if (card && card.ruling_planet && !card.ruling_planet_theme) {
                card.ruling_planet_theme = card.ruling_planet;
            }

            return card;
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

