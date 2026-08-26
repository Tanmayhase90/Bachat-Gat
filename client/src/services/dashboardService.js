import api from './api';

export const dashboardService = {
  getSummary: async () => {
    const res = await api.get('/dashboard/summary');
    return res.data;
  },

  getMonthlyProgress: async (month, year) => {
    const res = await api.get('/dashboard/monthly-progress', { params: { month, year } });
    return res.data;
  },

  getRecentActivities: async (limit = 10) => {
    const res = await api.get('/dashboard/recent-activities', { params: { limit } });
    return res.data;
  },
};

export const reportService = {
  getMonthlyReport: async (month, year) => {
    const res = await api.get('/reports/monthly', { params: { month, year } });
    return res.data;
  },

  getPendingDuesReport: async (month, year, search = '') => {
    const res = await api.get('/reports/pending-dues', { params: { month, year, search } });
    return res.data;
  },

  getLoansOverviewReport: async () => {
    const res = await api.get('/reports/loans-overview');
    return res.data;
  },
};

export const groupService = {
  getGroupDetails: async () => {
    const res = await api.get('/group');
    return res.data;
  },

  updateGroupDetails: async (data) => {
    const res = await api.put('/group', data);
    return res.data;
  },
};

export const notificationService = {
  getNotifications: async () => {
    const res = await api.get('/notifications');
    return res.data;
  },

  markAsRead: async (id) => {
    const res = await api.put(`/notifications/${id}/read`);
    return res.data;
  },

  markAllAsRead: async () => {
    const res = await api.put('/notifications/read-all');
    return res.data;
  },
};
