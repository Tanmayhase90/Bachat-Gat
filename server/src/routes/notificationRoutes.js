const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authenticateToken = require('../middleware/authMiddleware');

router.get('/', authenticateToken, notificationController.getNotifications);
router.put('/read-all', authenticateToken, notificationController.markAllNotificationsAsRead);
router.put('/:id/read', authenticateToken, notificationController.markNotificationAsRead);

module.exports = router;
