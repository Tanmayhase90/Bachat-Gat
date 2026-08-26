import api from './api';

export const memberService = {
  getAllMembers: async (params = {}) => {
    const res = await api.get('/members', { params });
    return res.data;
  },

  getMemberById: async (id) => {
    const res = await api.get(`/members/${id}`);
    return res.data;
  },

  createMember: async (data) => {
    const res = await api.post('/members', data);
    return res.data;
  },

  updateMember: async (id, data) => {
    const res = await api.put(`/members/${id}`, data);
    return res.data;
  },

  deleteMember: async (id) => {
    const res = await api.delete(`/members/${id}`);
    return res.data;
  },
};
