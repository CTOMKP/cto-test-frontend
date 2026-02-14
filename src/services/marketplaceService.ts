import axios from 'axios';
import { getBackendUrl } from '../utils/apiConfig';

const marketplaceApi = axios.create();

marketplaceApi.interceptors.request.use((config) => {
  const token =
    localStorage.getItem('cto_auth_token') ||
    localStorage.getItem('cto_jwt_token');
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  config.headers = {
    ...config.headers,
    'Content-Type': 'application/json',
  };
  return config;
});

export const marketplaceService = {
  async getPricing() {
    const backendUrl = getBackendUrl();
    const res = await marketplaceApi.get(`${backendUrl}/api/v1/marketplace/pricing`);
    return res.data?.items || res.data?.data || res.data || [];
  },

  async createDraft(payload: any) {
    const backendUrl = getBackendUrl();
    const res = await marketplaceApi.post(`${backendUrl}/api/v1/marketplace/ads`, payload);
    return res.data?.data || res.data;
  },

  async updateDraft(adId: string, payload: any) {
    const backendUrl = getBackendUrl();
    const res = await marketplaceApi.put(`${backendUrl}/api/v1/marketplace/ads/${adId}`, payload);
    return res.data?.data || res.data;
  },

  async createPayment(adId: string) {
    const backendUrl = getBackendUrl();
    const res = await marketplaceApi.post(`${backendUrl}/api/v1/marketplace/ads/${adId}/pay`, {});
    return res.data?.data || res.data;
  },

  async verifyPayment(paymentId: string, txHash: string) {
    const backendUrl = getBackendUrl();
    const res = await marketplaceApi.post(
      `${backendUrl}/api/v1/marketplace/ads/payments/${paymentId}/verify`,
      { txHash }
    );
    return res.data?.data || res.data;
  },

  async listMine() {
    const backendUrl = getBackendUrl();
    const res = await marketplaceApi.get(`${backendUrl}/api/v1/marketplace/ads/mine`);
    return res.data?.items || res.data?.data || res.data || [];
  },

  async listPublic(params?: { page?: number; limit?: number; category?: string; subCategory?: string }) {
    const backendUrl = getBackendUrl();
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.category) search.set('category', params.category);
    if (params?.subCategory) search.set('subCategory', params.subCategory);
    const qs = search.toString();
    const res = await marketplaceApi.get(`${backendUrl}/api/v1/marketplace/ads${qs ? `?${qs}` : ''}`);
    return res.data?.items || res.data?.data || res.data || [];
  },
};

export default marketplaceService;
