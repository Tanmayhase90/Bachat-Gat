import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';

export const notificationService = {
  /**
   * Get all notifications
   */
  getNotifications: async () => {
    try {
      const snap = await getDocs(collection(db, 'notifications'));
      const notifications = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          ...d,
          title: d.title || 'Notification',
          message: d.message || '',
          type: d.type || 'INFO',
          is_read: d.isRead ? 1 : 0,
          created_at: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : new Date().toISOString(),
        };
      });

      // Sort by date desc
      notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const unreadCount = notifications.filter((n) => !n.is_read).length;

      return {
        success: true,
        unreadCount,
        notifications,
      };
    } catch (err) {
      console.error('Failed to get notifications:', err);
      return { success: true, unreadCount: 0, notifications: [] };
    }
  },

  /**
   * Mark single notification as read
   */
  markAsRead: async (id) => {
    try {
      const docRef = doc(db, 'notifications', id);
      await updateDoc(docRef, { isRead: true, updatedAt: serverTimestamp() });
      return { success: true };
    } catch (err) {
      console.error('Failed to mark notification read:', err);
      return { success: true };
    }
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async () => {
    try {
      const snap = await getDocs(collection(db, 'notifications'));
      const promises = snap.docs.map((d) =>
        updateDoc(doc(db, 'notifications', d.id), { isRead: true, updatedAt: serverTimestamp() })
      );
      await Promise.all(promises);
      return { success: true };
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
      return { success: true };
    }
  },

  /**
   * Subscribe to notifications in real-time
   */
  subscribeToNotifications: (callback) => {
    return onSnapshot(collection(db, 'notifications'), () => {
      notificationService.getNotifications().then((res) => {
        if (res.success) callback(res);
      });
    });
  },
};
