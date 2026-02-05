const userService = require("../services/user.service");
const authService = require("../services/auth.service");
const { successResponse, errorResponse } = require("../utils/response");
const logger = require("../config/logger");

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
      const {
        walletAddress,
        twitterId,
        username,
        twitterUsername,
        twitterProfileUrl,
        dob,
        birthTime,
        birthPlace,
        latitude,
        longitude,
        timezoneOffset,
      } = req.body;

      // Register/update user
      const user = await userService.registerUser({
        walletAddress,
        username,
        twitterId,
        twitterUsername,
        twitterProfileUrl,
        dob,
        birthTime,
        birthPlace,
        latitude,
        longitude,
        timezoneOffset,
      });

      // Generate JWT token for the user
      const token = authService.generateToken(walletAddress, {
        userId: user.id,
      });

      logger.info("User registered successfully", { walletAddress });

      return successResponse(
        res,
        {
          message: "User registered successfully",
          user: {
            id: user.id,
            walletAddress: user.wallet_address,
            createdAt: user.created_at,
            username: user.username,
            twitterId: user.twitter_id,
            twitterUsername: user.twitter_username,
            twitterProfileUrl: user.twitter_profile_url,
          },
          token,
        },
        201
      );
    } catch (error) {
      logger.error("Register controller error:", error);
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
        return errorResponse(res, "User not found", 404);
      }

      return successResponse(res, {
        user: {
          id: user.id,
          walletAddress: user.wallet_address,
          dob: user.dob,
          birthTime: user.birth_time,
          birthPlace: user.birth_place,
          latitude: user.latitude,
          longitude: user.longitude,
          twitterId: user.twitter_id,
          twitterUsername: user.twitter_username,
          twitterProfileUrl: user.twitter_profile_url,
          timezoneOffset: user.timezone_offset,
          createdAt: user.created_at,
          username: user.username,
          twitterAccessToken: user.twitter_access_token,
          twitterRefreshToken: user.twitter_refresh_token,
          twitterTokenExpiresAt: user.twitter_token_expires,
        },
      });
    } catch (error) {
      logger.error("Get profile controller error:", error);
      next(error);
    }
  }

  /**
   * Register a user X account
   * @route POST /api/user/x-account
   */
  async registerX(req, res, next) {
    try {
      const {
        id,
        twitterId,
        username,
        twitterUsername,
        twitterProfileUrl,
        twitterAccessToken,
        twitterRefreshToken,
        twitterTokenExpiresAt,
      } = req.body;

      if (
        !id ||
        (!twitterId &&
          !twitterUsername &&
          !twitterProfileUrl &&
          !twitterAccessToken &&
          !username)
      ) {
        return res.status(400).json({
          success: false,
          message: "User id and X account details are required",
        });
      }

      const user = await userService.registerXAccount({
        userId: id,
        twitterId,
        username,
        twitterUsername,
        twitterProfileUrl,
        twitterAccessToken,
        twitterRefreshToken,
        twitterTokenExpiresAt,
      });

      return successResponse(
        res,
        {
          message: "User X account linked successfully",
          user: {
            id: user.id,
            walletAddress: user.wallet_address,
            dob: user.dob,
            createdAt: user.created_at,
            username: user.username,
            twitterId: user.twitter_id,
            twitterUsername: user.twitter_username,
            twitterProfileUrl: user.twitter_profile_url,
          },
        },
        200
      );
    } catch (error) {
      logger.error("Register X controller error:", error);
      next(error);
    }
  }

  /**
   * Update user's Twitter OAuth tokens
   * @route PATCH /api/user/twitter-tokens
   */
  async updateTwitterTokens(req, res, next) {
    try {
      const { walletAddress, accessToken, refreshToken, expiresAt } = req.body;

      if (!walletAddress || !accessToken || !refreshToken || !expiresAt) {
        return errorResponse(
          res,
          "Wallet address, access token, refresh token, and expiration time are required",
          400
        );
      }

      const existingUser = await userService.findUserByWallet(walletAddress);
      if (!existingUser) {
        return errorResponse(res, "User not found", 404);
      }

      const user = await userService.updateTwitterTokens({
        walletAddress,
        accessToken,
        refreshToken,
        expiresAt,
      });

      logger.info("Twitter tokens updated successfully", { walletAddress });

      return successResponse(
        res,
        {
          message: "Twitter tokens updated successfully",
          user: {
            id: user.id,
            walletAddress: user.wallet_address,
            twitterUsername: user.twitter_username,
            twitterTokenExpiresAt: user.twitter_token_expires,
          },
        },
        200
      );
    } catch (error) {
      logger.error("Update Twitter tokens controller error:", error);
      next(error);
    }
  }

  /**
   * Register user's birth details
   * @route POST /api/user/birth-details
   */
  async registerBirth(req, res, next) {
    try {
      const {
        walletAddress,
        dob,
        birthTime,
        birthPlace,
        latitude,
        longitude,
        timezoneOffset,
      } = req.body;

      const existingUser = await userService.findUserByWallet(walletAddress);
      if (!existingUser) {
        return errorResponse(
          res,
          "User not found. Please register first.",
          404
        );
      }

      if (
        existingUser.dob &&
        existingUser.birth_time &&
        existingUser.birth_place
      ) {
        return errorResponse(
          res,
          "Birth details are already registered for this user. Use update endpoint instead.",
          409
        );
      }

      const birthDate = new Date(dob);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (birthDate > today) {
        return errorResponse(res, "Date of birth cannot be in the future", 400);
      }

      let formattedBirthTime = birthTime;
      if (birthTime && !/^([01]\d|2[0-3]):([0-5]\d)$/.test(birthTime)) {
        return errorResponse(
          res,
          "Birth time must be in HH:MM format (24-hour)",
          400
        );
      }

      if ((latitude && !longitude) || (!latitude && longitude)) {
        return errorResponse(
          res,
          "Both latitude and longitude must be provided together",
          400
        );
      }

      const birthDetails = {
        walletAddress,
        dob,
        birthTime: formattedBirthTime || null,
        birthPlace: birthPlace || null,
        latitude: latitude || null,
        longitude: longitude || null,
        timezoneOffset: timezoneOffset || null,
      };

      const updatedUser = await userService.registerBirthDetails(birthDetails);

      return successResponse(
        res,
        {
          message: "Birth details registered successfully",
          user: {
            id: updatedUser.id,
            walletAddress: updatedUser.wallet_address,
            username: updatedUser.username,
            dob: updatedUser.dob,
            birthTime: updatedUser.birth_time,
            birthPlace: updatedUser.birth_place,
            latitude: updatedUser.latitude,
            longitude: updatedUser.longitude,
            timezoneOffset: updatedUser.timezone_offset,
          },
        },
        201
      );
    } catch (error) {
      logger.error("Register birth details controller error:", error);
      next(error);
    }
  }
}

module.exports = new UserController();
