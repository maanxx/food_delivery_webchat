// NEW
import axiosInstance from '@config/axiosInstance';

const addressService = {
  // Cache-bust to prevent stale 304 responses after mutations
  getAddresses: () => axiosInstance.get(`/api/user/addresses?_t=${Date.now()}`),
  createAddress: (data) => axiosInstance.post('/api/user/addresses', data),
  updateAddress: (id, data) => axiosInstance.put(`/api/user/addresses/${id}`, data),
  deleteAddress: (id) => axiosInstance.delete(`/api/user/addresses/${id}`),
  setDefaultAddress: (id) => axiosInstance.put(`/api/user/addresses/${id}/default`),
};

export default addressService;
