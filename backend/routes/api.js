import express from 'express';
import generateRoutes from './generate.js';

const router = express.Router();

// API health check
router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'Cursor-2D API'
    });
});

router.use('/generate',generateRoutes)

export default router;