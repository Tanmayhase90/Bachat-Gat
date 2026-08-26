import api from './api';

export const savingsService = {
  getAllSavings: async (params = {}) => {
    const res = await api.get('/savings', { params });
    return res.data;
  },

  recordSavings: async (data) => {
    const res = await api.post('/savings', data);
    return res.data;
  },

  updateSavings: async (id, data) => {
    const res = await api.put(`/savings/${id}`, data);
    return res.data;
  },
};
