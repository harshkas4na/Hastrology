const Joi = require('joi');
const { errorResponse } = require('../utils/response');
const logger = require('../config/logger');

/**
 * Validation middleware factory
 * Creates middleware to validate request data against Joi schemas
 */
const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            logger.warn('Validation error:', errors);
            return errorResponse(res, 'Validation failed', 400, errors);
        }

        // Replace req.body with validated and sanitized data
        req.body = value;
        next();
    };
};

/**
 * User registration validation schema
 */
const userRegistrationSchema = Joi.object({
    walletAddress: Joi.string()
        .required()
        .min(32)
        .max(44)
        .pattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
        .messages({
            'string.pattern.base': 'Invalid Solana wallet address format',
            'string.empty': 'Wallet address is required',
            'any.required': 'Wallet address is required'
        }),

    dob: Joi.string()
        .required()
        .messages({
            'string.empty': 'Date of birth is required',
            'any.required': 'Date of birth is required'
        }),

    birthTime: Joi.string()
        .required()
        .messages({
            'string.empty': 'Birth time is required',
            'any.required': 'Birth time is required'
        }),

    birthPlace: Joi.string()
        .required()
        .min(2)
        .messages({
            'string.empty': 'Birth place is required',
            'string.min': 'Birth place must be at least 2 characters',
            'any.required': 'Birth place is required'
        })
});

/**
 * Horoscope confirmation validation schema
 */
const horoscopeConfirmSchema = Joi.object({
    walletAddress: Joi.string()
        .required()
        .min(32)
        .max(44)
        .pattern(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
        .messages({
            'string.pattern.base': 'Invalid Solana wallet address format',
            'string.empty': 'Wallet address is required',
            'any.required': 'Wallet address is required'
        }),

    signature: Joi.string()
        .required()
        .min(1)
        .messages({
            'string.empty': 'Transaction signature is required',
            'any.required': 'Transaction signature is required'
        })
});

module.exports = {
    validate,
    validateUserRegistration: validate(userRegistrationSchema),
    validateHoroscopeConfirm: validate(horoscopeConfirmSchema)
};
