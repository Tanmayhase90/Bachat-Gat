const { writeActivity, writeNotification } = require('./firestore');

module.exports = {
  logActivity: writeActivity,
  createNotification: writeNotification,
};