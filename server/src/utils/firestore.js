const { db } = require('../config/firebaseAdmin');

const DEFAULT_GROUP_ID = 'group_001';

function value(data, ...keys) {
  return keys.map((key) => data[key]).find((item) => item !== undefined && item !== null);
}

function serialize(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
}

async function getCollection(name, groupId = DEFAULT_GROUP_ID) {
  const snapshot = await db.collection(name).get();
  return snapshot.docs
    .map(serialize)
    .filter((item) => !groupId || !item.groupId || item.groupId === groupId);
}

async function writeActivity(groupId, userId, action, description) {
  await db.collection('activity_logs').add({
    groupId: groupId || DEFAULT_GROUP_ID,
    userId: userId || null,
    action,
    description,
    createdAt: new Date().toISOString(),
  });
}

async function writeNotification(userId, groupId, title, message, type = 'INFO') {
  await db.collection('notifications').add({
    userId: userId || null,
    groupId: groupId || DEFAULT_GROUP_ID,
    title,
    message,
    type,
    isRead: false,
    createdAt: new Date().toISOString(),
  });
}

module.exports = { DEFAULT_GROUP_ID, db, getCollection, serialize, value, writeActivity, writeNotification };