const express = require('express');
const userController = require('../controllers/user.controller');
const { validateUserRegistration } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   POST /api/user/register
 * @desc    Register a new user or update existing user
 * @access  Public
 */
router.post(
    '/register',
    authLimiter,
    validateUserRegistration,
    userController.register
);

/**
 * @route   GET /api/user/profile/:walletAddress
 * @desc    Get user profile by wallet address
 * @access  Public
 */
router.get(
    '/profile/:walletAddress',
    userController.getProfile
);

module.exports = router;
