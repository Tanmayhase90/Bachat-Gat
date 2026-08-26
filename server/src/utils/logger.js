const pool = require('../config/db');

/**
 * Creates an activity log entry in MySQL
 */
async function logActivity(groupId, userId, action, description, connection = null) {
  const db = connection || pool;
  try {
    await db.query(
      'INSERT INTO activity_logs (group_id, user_id, action, description) VALUES (?, ?, ?, ?)',
      [groupId || null, userId || null, action, description]
    );
  } catch (err) {
    console.error('Failed to write activity log:', err.message);
  }
}

/**
 * Creates a notification in MySQL
 */
async function createNotification(userId, groupId, title, message, type = 'INFO', connection = null) {
  const db = connection || pool;
  try {
    await db.query(
      'INSERT INTO notifications (user_id, group_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
      [userId || null, groupId || null, title, message, type]
    );
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
}

module.exports = {
  logActivity,
  createNotification,
};
