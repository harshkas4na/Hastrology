const { getSupabaseClient } = require('../config/supabase');
const logger = require('../config/logger');

/**
 * User Service - Handles all user-related database operations
 */
class UserService {
    constructor() {
        this.supabase = getSupabaseClient();
    }

    /**
     * Register or update a user
     * @param {Object} userData - User registration data
     * @returns {Promise<Object>} Created/updated user
     */
    async registerUser({ walletAddress, dob, birthTime, birthPlace }) {
        try {
            logger.info('Registering user:', { walletAddress });

            // Use upsert to create or update user
            const { data, error } = await this.supabase
                .from('users')
                .upsert(
                    {
                        wallet_address: walletAddress,
                        dob: dob,
                        birth_time: birthTime,
                        birth_place: birthPlace,
                        updated_at: new Date().toISOString()
                    },
                    {
                        onConflict: 'wallet_address',
                        returning: 'representation'
                    }
                )
                .select()
                .single();

            if (error) {
                logger.error('User registration error:', error);
                throw error;
            }

            logger.info('User registered successfully:', { userId: data.id });
            return data;
        } catch (error) {
            logger.error('User service error:', error);
            throw error;
        }
    }

    /**
     * Find user by wallet address
     * @param {string} walletAddress - User's wallet address
     * @returns {Promise<Object|null>} User object or null
     */
    async findUserByWallet(walletAddress) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('wallet_address', walletAddress)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                logger.error('Find user error:', error);
                throw error;
            }

            return data || null;
        } catch (error) {
            logger.error('Find user error:', error);
            throw error;
        }
    }

    /**
     * Get user by ID
     * @param {string} userId - User's UUID
     * @returns {Promise<Object|null>} User object or null
     */
    async getUserById(userId) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                logger.error('Get user error:', error);
                throw error;
            }

            return data || null;
        } catch (error) {
            logger.error('Get user error:', error);
            throw error;
        }
    }

    /**
     * Update user information
     * @param {string} walletAddress - User's wallet address
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>} Updated user
     */
    async updateUser(walletAddress, updates) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('wallet_address', walletAddress)
                .select()
                .single();

            if (error) {
                logger.error('Update user error:', error);
                throw error;
            }

            logger.info('User updated successfully:', { walletAddress });
            return data;
        } catch (error) {
            logger.error('Update user error:', error);
            throw error;
        }
    }

    /**
     * Check if user exists
     * @param {string} walletAddress - User's wallet address
     * @returns {Promise<boolean>} True if user exists
     */
    async userExists(walletAddress) {
        const user = await this.findUserByWallet(walletAddress);
        return !!user;
    }
}

module.exports = new UserService();
