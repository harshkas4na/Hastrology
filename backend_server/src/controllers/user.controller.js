const userService = require('../services/user.service');
const authService = require('../services/auth.service');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../config/logger');

/**
 * User Controller - Handles user-related HTTP requests
 */
class UserController {
    /**
     * Register a new user or update existing user
     * @route POST /api/user/register
     */
    async register(req, res, next) {
        try {
            const { walletAddress, dob, birthTime, birthPlace } = req.body;

            // Register/update user
            const user = await userService.registerUser({
                walletAddress,
                dob,
                birthTime,
                birthPlace
            });

            // Generate JWT token for the user
            const token = authService.generateToken(walletAddress, {
                userId: user.id
            });

            logger.info('User registered successfully', { walletAddress });

            return successResponse(res, {
                message: 'User registered successfully',
                user: {
                    id: user.id,
                    walletAddress: user.wallet_address,
                    dob: user.dob,
                    birthTime: user.birth_time,
                    birthPlace: user.birth_place,
                    createdAt: user.created_at
                },
                token
            }, 201);
        } catch (error) {
            logger.error('Register controller error:', error);
            next(error);
        }
    }

    /**
     * Get user profile by wallet address
     * @route GET /api/user/profile/:walletAddress
     */
    async getProfile(req, res, next) {
        try {
            const { walletAddress } = req.params;

            const user = await userService.findUserByWallet(walletAddress);

            if (!user) {
                return errorResponse(res, 'User not found', 404);
            }

            return successResponse(res, {
                user: {
                    id: user.id,
                    walletAddress: user.wallet_address,
                    dob: user.dob,
                    birthTime: user.birth_time,
                    birthPlace: user.birth_place,
                    createdAt: user.created_at
                }
            });
        } catch (error) {
            logger.error('Get profile controller error:', error);
            next(error);
        }
    }
}

module.exports = new UserController();
