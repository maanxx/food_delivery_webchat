import axiosInstance from '@config/axiosInstance';

const profileService = {
  // Profile APIs
  getProfile: () => axiosInstance.get('/api/user/profile'),
  updateProfile: (formData) => axiosInstance.put('/api/user/profile', formData),
  changePassword: (data) => axiosInstance.put('/api/user/password', data),

  // Address APIs
  getAddresses: () => axiosInstance.get('/api/user/addresses'),
  addAddress: (data) => axiosInstance.post('/api/user/addresses', data),
  updateAddress: (id, data) => axiosInstance.put(`/api/user/addresses/${id}`, data),
  deleteAddress: (id) => axiosInstance.delete(`/api/user/addresses/${id}`),
  setDefaultAddress: (id) => axiosInstance.put(`/api/user/addresses/${id}/default`),

  // Order APIs
  getOrders: () => axiosInstance.get('/api/user/orders'),
  getOrderDetails: (id) => axiosInstance.get(`/api/user/orders/${id}`),
  reorder: (orderId) => axiosInstance.post(`/api/user/orders/${orderId}/reorder`),
};

export default profileService;

