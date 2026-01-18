/**
 * Public Lottery Routes - No admin authentication required
 */

const express = require('express');
const lotteryScheduler = require('../services/lottery-scheduler.service');
const logger = require('../config/logger');

const router = express.Router();

/**
 * Trigger lottery draw (public endpoint)
 * @route POST /api/lottery/trigger-draw
 * 
 * This endpoint allows any user to trigger the lottery draw if:
 * 1. The lottery scheduler is initialized
 * 2. The lottery endtime has passed
 * 3. No winner has been selected yet (winner === 0)
 * 
 * This serves as a fallback when the cron job fails to execute.
 */
router.post('/trigger-draw', async (req, res) => {
    try {
        // Check if scheduler is initialized
        if (!lotteryScheduler.isInitialized) {
            return res.status(503).json({
                success: false,
                error: 'Lottery scheduler not initialized',
                details: lotteryScheduler.initializationError || 'Unknown initialization failure',
                code: 'SCHEDULER_NOT_INITIALIZED'
            });
        }

        // Fetch current lottery state
        const state = await lotteryScheduler.fetchLotteryState();
        const now = Math.floor(Date.now() / 1000);
        const endtime = Number(state.lotteryEndtime);

        // Check if lottery has ended
        if (now < endtime) {
            return res.status(400).json({
                success: false,
                error: 'Lottery has not ended yet',
                code: 'LOTTERY_NOT_ENDED',
                endsAt: new Date(endtime * 1000).toISOString()
            });
        }

        // Check if winner already selected
        if (Number(state.winner) > 0) {
            return res.status(200).json({
                success: true,
                message: 'Winner already selected',
                code: 'WINNER_ALREADY_SELECTED',
                winner: state.winner.toString()
            });
        }

        // Check if no participants
        if (Number(state.totalParticipants) === 0) {
            return res.status(400).json({
                success: false,
                error: 'No participants in this lottery',
                code: 'NO_PARTICIPANTS'
            });
        }

        // Check if draw is already in progress
        if (lotteryScheduler.isRunning) {
            return res.status(202).json({
                success: true,
                message: 'Draw is already in progress',
                code: 'DRAW_IN_PROGRESS'
            });
        }

        // Trigger the draw
        logger.info('Public lottery draw triggered via API');

        // Start draw asynchronously so we don't timeout
        lotteryScheduler.triggerManualDraw().catch(err => {
            logger.error('Public draw failed:', err);
        });

        res.json({
            success: true,
            message: 'Lottery draw initiated. Poll for winner.',
            code: 'DRAW_INITIATED'
        });

    } catch (error) {
        logger.error('Public draw trigger failed:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            code: 'INTERNAL_ERROR'
        });
    }
});

/**
 * Get lottery status (public endpoint)
 * @route GET /api/lottery/status
 */
router.get('/status', async (req, res) => {
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
 * Get lottery health status (public endpoint)
 * @route GET /api/lottery/health
 * 
 * Returns detailed health information about the lottery system,
 * including any detected issues and their severity.
 */
router.get('/health', async (req, res) => {
    try {
        const health = await lotteryScheduler.getHealthStatus();
        const statusCode = health.healthy ? 200 : 503;
        res.status(statusCode).json({
            success: health.healthy,
            timestamp: new Date().toISOString(),
            data: health
        });
    } catch (error) {
        logger.error('Failed to get lottery health:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get last lottery result and user status
 * @route GET /api/lottery/last-result
 * @query address (optional) - Wallet address to check status for
 */
router.get('/last-result', async (req, res) => {
    try {
        const { getSupabaseClient } = require('../config/supabase');
        const supabase = getSupabaseClient();
        const { address } = req.query;

        // 1. Get latest draw
        const { data: latestDraw, error: drawError } = await supabase
            .from('lottery_draws')
            .select('*')
            .order('lottery_id', { ascending: false })
            .limit(1)
            .single();

        if (drawError && drawError.code !== 'PGRST116') {
            throw drawError;
        }

        if (!latestDraw) {
            return res.json({
                success: true,
                data: null
            });
        }

        let userStatus = 'not_entered';
        let userPrize = null;

        // 2. Check user status if address provided
        if (address) {
            const { data: participant, error: partError } = await supabase
                .from('lottery_participants')
                .select('*')
                .eq('lottery_id', latestDraw.lottery_id)
                .eq('wallet_address', address)
                .single();

            if (!partError && participant) {
                userStatus = participant.is_winner ? 'won' : 'lost';
                if (participant.is_winner) {
                    userPrize = latestDraw.prize_amount;
                }
            }
        }

        res.json({
            success: true,
            data: {
                lotteryId: latestDraw.lottery_id,
                drawTime: latestDraw.draw_time,
                winner: latestDraw.winner_wallet,
                prize: latestDraw.prize_amount,
                userStatus: userStatus, // 'won', 'lost', 'not_entered'
                userPrize: userPrize
            }
        });

    } catch (error) {
        logger.error('Failed to get last lottery result:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
