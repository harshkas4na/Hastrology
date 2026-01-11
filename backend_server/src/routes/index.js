const express = require('express');
const userRoutes = require('./user.routes');
const horoscopeRoutes = require('./horoscope.routes');
const adminRoutes = require('./admin.routes');

const router = express.Router();

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Hastrology API is running',
        timestamp: new Date().toISOString()
    });
});

/**
 * Mount route modules
 */
router.use('/user', userRoutes);
router.use('/horoscope', horoscopeRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
