const { getSupabaseClient } = require('../config/supabase');
const logger = require('../config/logger');

/**
 * Horoscope Service - Handles horoscope database operations
 */
class HoroscopeService {
    constructor() {
        this.supabase = getSupabaseClient();
    }

    /**
     * Get today's date in YYYY-MM-DD format
     * @returns {string} Today's date
     */
    getTodayDateString() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Save a new horoscope
     * @param {Object} horoscopeData - Horoscope data
     * @returns {Promise<Object>} Saved horoscope
     */
    async saveHoroscope({ walletAddress, horoscopeText, date = null }) {
        try {
            const horoscopeDate = date || this.getTodayDateString();

            logger.info('Saving horoscope:', { walletAddress, date: horoscopeDate });

            const { data, error } = await this.supabase
                .from('horoscopes')
                .insert({
                    wallet_address: walletAddress,
                    date: horoscopeDate,
                    horoscope_text: horoscopeText
                })
                .select()
                .single();

            if (error) {
                // Check if it's a duplicate entry error
                if (error.code === '23505') { // Unique constraint violation
                    logger.warn('Horoscope already exists for today:', { walletAddress });
                    throw new Error('HOROSCOPE_ALREADY_EXISTS');
                }
                logger.error('Save horoscope error:', error);
                throw error;
            }

            logger.info('Horoscope saved successfully:', { id: data.id });
            return data;
        } catch (error) {
            logger.error('Save horoscope error:', error);
            throw error;
        }
    }

    /**
     * Get horoscope for a specific wallet and date
     * @param {string} walletAddress - User's wallet address
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {Promise<Object|null>} Horoscope or null
     */
    async getHoroscope(walletAddress, date = null) {
        try {
            const queryDate = date || this.getTodayDateString();

            const { data, error } = await this.supabase
                .from('horoscopes')
                .select('*')
                .eq('wallet_address', walletAddress)
                .eq('date', queryDate)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
                logger.error('Get horoscope error:', error);
                throw error;
            }

            return data || null;
        } catch (error) {
            logger.error('Get horoscope error:', error);
            throw error;
        }
    }

    /**
     * Get all horoscopes for a wallet address
     * @param {string} walletAddress - User's wallet address
     * @param {number} limit - Number of results to return
     * @returns {Promise<Array>} Array of horoscopes
     */
    async getUserHoroscopes(walletAddress, limit = 10) {
        try {
            const { data, error } = await this.supabase
                .from('horoscopes')
                .select('*')
                .eq('wallet_address', walletAddress)
                .order('date', { ascending: false })
                .limit(limit);

            if (error) {
                logger.error('Get user horoscopes error:', error);
                throw error;
            }

            return data || [];
        } catch (error) {
            logger.error('Get user horoscopes error:', error);
            throw error;
        }
    }

    /**
     * Check if horoscope exists for today
     * @param {string} walletAddress - User's wallet address
     * @returns {Promise<boolean>} True if horoscope exists
     */
    async todayHoroscopeExists(walletAddress) {
        const horoscope = await this.getHoroscope(walletAddress);
        return !!horoscope;
    }

    /**
     * Get user's horoscope status
     * @param {string} walletAddress - User's wallet address
     * @returns {Promise<Object>} Status object
     */
    async getHoroscopeStatus(walletAddress) {
        try {
            const todayHoroscope = await this.getHoroscope(walletAddress);

            if (todayHoroscope) {
                return {
                    status: 'exists',
                    horoscope: todayHoroscope.horoscope_text,
                    date: todayHoroscope.date
                };
            }

            return {
                status: 'clear_to_pay',
                message: 'No horoscope for today. Payment required to generate.'
            };
        } catch (error) {
            logger.error('Get horoscope status error:', error);
            throw error;
        }
    }
}

module.exports = new HoroscopeService();
