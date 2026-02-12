const express = require('express');
const horoscopeController = require('../controllers/horoscope.controller');
const { validateHoroscopeConfirm, validateHoroscopeVerify } = require('../middleware/validation');
const { generalLimiter, strictLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * @route   GET /api/horoscope/status
 * @desc    Get horoscope status for a wallet address
 * @access  Public
 */
router.get(
    '/status',
    generalLimiter,
    horoscopeController.getStatus
);

/**
 * @route   POST /api/horoscope/confirm
 * @desc    Confirm payment and generate horoscope
 * @access  Public
 */
router.post(
    '/confirm',
    strictLimiter,
    validateHoroscopeConfirm,
    horoscopeController.confirm
);

/**
 * @route   POST /api/horoscope/verify
 * @desc    Verify horoscope via a profitable trade
 * @access  Public
 */
router.post(
    '/verify',
    strictLimiter,
    validateHoroscopeVerify,
    horoscopeController.verify
);

/**
 * @route   GET /api/horoscope/history/:walletAddress
 * @desc    Get user's horoscope history
 * @access  Public
 */
router.get(
    '/history/:walletAddress',
    generalLimiter,
    horoscopeController.getHistory
);

module.exports = router;
