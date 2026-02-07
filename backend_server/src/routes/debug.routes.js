const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * Debug endpoint to check environment configuration
 */
router.get('/config', (req, res) => {
    res.json({
        nodeEnv: process.env.NODE_ENV,
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
        hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
        hasAiServerUrl: !!process.env.AI_SERVER_URL,
        aiServerUrl: process.env.AI_SERVER_URL || 'NOT_SET',
        hasTwitterClientId: !!process.env.TWITTER_CLIENT_ID,
        hasTwitterClientSecret: !!process.env.TWITTER_CLIENT_SECRET,
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasPort: !!process.env.PORT,
        timestamp: new Date().toISOString()
    });
});

/**
 * Test AI server connectivity
 */
router.get('/ai-health', async (req, res) => {
    try {
        const aiServerUrl = process.env.AI_SERVER_URL;

        if (!aiServerUrl) {
            return res.status(500).json({
                success: false,
                error: 'AI_SERVER_URL not configured in environment variables'
            });
        }

        // Try to ping the AI server
        const response = await axios.get(`${aiServerUrl}/health`, {
            timeout: 5000
        }).catch(err => {
            // If /health doesn't exist, try root
            return axios.get(aiServerUrl, { timeout: 5000 });
        });

        res.json({
            success: true,
            aiServerStatus: 'reachable',
            aiServerUrl: aiServerUrl,
            statusCode: response.status,
            message: 'AI server is accessible from Vercel'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code,
            aiServerUrl: process.env.AI_SERVER_URL || 'NOT_SET',
            details: error.response?.data || 'No response data'
        });
    }
});

/**
 * Test Supabase connectivity
 */
router.get('/supabase-health', async (req, res) => {
    try {
        const { getSupabaseClient } = require('../config/supabase');
        const supabase = getSupabaseClient();

        const { data, error } = await supabase
            .from('users')
            .select('count')
            .limit(1);

        if (error) {
            return res.status(500).json({
                success: false,
                error: error.message,
                details: error
            });
        }

        res.json({
            success: true,
            message: 'Supabase connection successful',
            supabaseUrl: process.env.SUPABASE_URL || 'NOT_SET'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;