const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authenticateToken = require('../middleware/authMiddleware');

router.get('/monthly', authenticateToken, reportController.getMonthlyReport);
router.get('/pending-dues', authenticateToken, reportController.getPendingDuesReport);
router.get('/loans-overview', authenticateToken, reportController.getLoansOverviewReport);

module.exports = router;
