const pool = require('../config/db');

/**
 * GET /api/notifications
 */
async function getNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const groupId = req.user.groupId || 1;

    const [notifications] = await pool.query(
      `SELECT * FROM notifications 
       WHERE (user_id = ? OR user_id IS NULL) AND (group_id = ? OR group_id IS NULL) 
       ORDER BY created_at DESC 
       LIMIT 30`,
      [userId, groupId]
    );

    const unreadCount = notifications.filter((n) => !n.is_read).length;

    res.json({
      success: true,
      unreadCount,
      notifications,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/notifications/:id/read
 */
async function markNotificationAsRead(req, res, next) {
  try {
    const notifId = req.params.id;
    await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [notifId]);
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/notifications/read-all
 */
async function markAllNotificationsAsRead(req, res, next) {
  try {
    const userId = req.user.id;
    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
