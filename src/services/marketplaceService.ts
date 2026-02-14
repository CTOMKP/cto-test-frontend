import axios from 'axios';
import { getBackendUrl } from '../utils/apiConfig';

const backendUrl = getBackendUrl();

function authHeaders() {
  const token = localStorage.getItem('cto_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const marketplaceService = {
  async getPricing() {
    const res = await axios.get(`${backendUrl}/api/v1/marketplace/pricing`);
    const responseData = res.data?.data || res.data;
    return responseData?.items || responseData || [];
  },

  async createDraft(payload: any) {
    const res = await axios.post(`${backendUrl}/api/v1/marketplace/ads`, payload, {
      headers: authHeaders(),
    });
    return res.data?.data || res.data;
  },

  async updateDraft(adId: string, payload: any) {
    const res = await axios.put(`${backendUrl}/api/v1/marketplace/ads/${adId}`, payload, {
      headers: authHeaders(),
    });
    return res.data?.data || res.data;
  },

  async createPayment(adId: string) {
    const res = await axios.post(`${backendUrl}/api/v1/marketplace/ads/${adId}/pay`, {}, {
      headers: authHeaders(),
    });
    return res.data?.data || res.data;
  },

  async verifyPayment(paymentId: string, txHash: string) {
    const res = await axios.post(
      `${backendUrl}/api/v1/marketplace/ads/payments/${paymentId}/verify`,
      { txHash },
      { headers: authHeaders() }
    );
    return res.data?.data || res.data;
  },

  async listMine() {
    const res = await axios.get(`${backendUrl}/api/v1/marketplace/ads/mine`, {
      headers: authHeaders(),
    });
    const responseData = res.data?.data || res.data;
    return responseData?.items || responseData || [];
  },

  async listPublic(params?: { page?: number; limit?: number; category?: string; subCategory?: string }) {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.category) search.set('category', params.category);
    if (params?.subCategory) search.set('subCategory', params.subCategory);
    const qs = search.toString();
    const res = await axios.get(`${backendUrl}/api/v1/marketplace/ads${qs ? `?${qs}` : ''}`);
    const responseData = res.data?.data || res.data;
    return responseData?.items || responseData || [];
  },
};

export default marketplaceService;
