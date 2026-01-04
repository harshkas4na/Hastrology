const express = require("express");
const userController = require("../controllers/user.controller");
const {
  validateUserRegistration,
  validateTwitterConfirm,
  validateTwitterTokensUpdate,
} = require("../middleware/validation");
const { authLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

/**
 * @route   POST /api/user/register
 * @desc    Register a new user or update existing user
 * @access  Public
 */
router.post(
  "/register",
  authLimiter,
  validateUserRegistration,
  userController.register
);

/**
 * @route   POST /api/user/x-account
 * @desc    Link X (Twitter) account to an existing user
 * @access  Private
 */
router.post(
  "/x-account",
  authLimiter,
  validateTwitterConfirm,
  userController.registerX
);

/**
 * @route   PATCH /api/user/twitter-tokens
 * @desc    Update Twitter OAuth tokens for a user
 * @access  Private
 */
router.patch(
  "/twitter-tokens",
  authLimiter,
  validateTwitterTokensUpdate,
  userController.updateTwitterTokens
);

/**
 * @route   GET /api/user/profile/:walletAddress
 * @desc    Get user profile by wallet address
 * @access  Public
 */
router.get("/profile/:walletAddress", userController.getProfile);

module.exports = router;
