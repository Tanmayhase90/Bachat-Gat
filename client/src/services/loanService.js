import api from './api';

export const loanService = {
  getAllLoans: async (params = {}) => {
    const res = await api.get('/loans', { params });
    return res.data;
  },

  getLoanById: async (id) => {
    const res = await api.get(`/loans/${id}`);
    return res.data;
  },

  createLoan: async (data) => {
    const res = await api.post('/loans', data);
    return res.data;
  },

  recordRepayment: async (loanId, data) => {
    const res = await api.post(`/loans/${loanId}/repayments`, data);
    return res.data;
  },

  getLoanRepayments: async (loanId) => {
    const res = await api.get(`/loans/${loanId}/repayments`);
    return res.data;
  },
};
