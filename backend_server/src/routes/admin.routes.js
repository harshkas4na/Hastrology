/**
 * Admin Routes - Lottery management endpoints
 */

const express = require('express');
const lotteryScheduler = require('../services/lottery-scheduler.service');
const logger = require('../config/logger');

const router = express.Router();

/**
 * Get current lottery status
 * @route GET /api/admin/lottery/status
 */
router.get('/lottery/status', async (req, res) => {
    try {
        const status = await lotteryScheduler.getStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        logger.error('Failed to get lottery status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Manually trigger lottery draw (for testing/emergency)
 * @route POST /api/admin/lottery/draw
 * 
 * Protected by a secret key for security
 */
router.post('/lottery/draw', async (req, res) => {
    try {
        const { adminSecret } = req.body;

        // Simple secret protection - in production use proper auth
        const expectedSecret = process.env.ADMIN_SECRET || 'hastrology-admin-2024';

        if (adminSecret !== expectedSecret) {
            return res.status(403).json({
                success: false,
                error: 'Invalid admin secret'
            });
        }

        logger.info('Manual lottery draw triggered via API');

        // Start draw asynchronously
        lotteryScheduler.triggerManualDraw().catch(err => {
            logger.error('Manual draw failed:', err);
        });

        res.json({
            success: true,
            message: 'Lottery draw initiated. Check server logs for progress.'
        });
    } catch (error) {
        logger.error('Manual draw trigger failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
