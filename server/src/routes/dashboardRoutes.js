const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authenticateToken = require('../middleware/authMiddleware');

router.get('/summary', authenticateToken, dashboardController.getDashboardSummary);
router.get('/monthly-progress', authenticateToken, dashboardController.getMonthlyProgress);
router.get('/recent-activities', authenticateToken, dashboardController.getRecentActivities);

module.exports = router;
