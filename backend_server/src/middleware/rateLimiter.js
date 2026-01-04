const rateLimit = require("express-rate-limit");
const { getConfig } = require("../config/environment");
const { errorResponse } = require("../utils/response");
const logger = require("../config/logger");

const config = getConfig();

/**
 * Create rate limiter with custom error response
 */
const createRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || config.security.rateLimitWindowMs,
    max: options.max || config.security.rateLimitMaxRequests,
    message: options.message || "Too many requests, please try again later",
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
      logger.warn("Rate limit exceeded", {
        ip: req.ip,
        path: req.path,
      });
      return errorResponse(
        res,
        "Too many requests, please try again later",
        429
      );
    },
    skip: (req) => {
      // Skip rate limiting in test environment
      return process.env.NODE_ENV === "test";
    },
  });
};

/**
 * General API rate limiter
 * 100 requests per 15 minutes by default
 */
const generalLimiter = createRateLimiter();

/**
 * Strict rate limiter for expensive operations
 * 10 requests per 15 minutes
 */
const strictLimiter = createRateLimiter({
  max: 10,
  message: "Too many requests for this operation, please try again later",
});

/**
 * Auth rate limiter for login/register
 * 5 requests per 15 minutes
 */
const authLimiter = createRateLimiter({
  max: 10,
  message: "Too many authentication attempts, please try again later",
});

module.exports = {
  generalLimiter,
  strictLimiter,
  authLimiter,
  createRateLimiter,
};
