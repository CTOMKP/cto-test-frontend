import axios from 'axios';
import { getBackendUrl } from '../utils/apiConfig';

const getAuthHeaders = () => {
  const token =
    localStorage.getItem('cto_auth_token') ||
    localStorage.getItem('cto_jwt_token');
  return token
    ? {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      }
    : { 'Content-Type': 'application/json' };
};

export const marketplaceService = {
  async getPricing() {
    const backendUrl = getBackendUrl();
    const res = await axios.get(`${backendUrl}/api/v1/marketplace/pricing`);
    return res.data?.items || res.data?.data || res.data || [];
  },

  async createDraft(payload: any) {
    const backendUrl = getBackendUrl();
    const res = await axios.post(`${backendUrl}/api/v1/marketplace/ads`, payload, {
      headers: getAuthHeaders(),
    });
    return res.data?.data || res.data;
  },

  async updateDraft(adId: string, payload: any) {
    const backendUrl = getBackendUrl();
    const res = await axios.put(`${backendUrl}/api/v1/marketplace/ads/${adId}`, payload, {
      headers: getAuthHeaders(),
    });
    return res.data?.data || res.data;
  },

  async createPayment(adId: string) {
    const backendUrl = getBackendUrl();
    const res = await axios.post(`${backendUrl}/api/v1/marketplace/ads/${adId}/pay`, {}, {
      headers: getAuthHeaders(),
    });
    return res.data?.data || res.data;
  },

  async verifyPayment(paymentId: string, txHash: string) {
    const backendUrl = getBackendUrl();
    const res = await axios.post(
      `${backendUrl}/api/v1/marketplace/ads/payments/${paymentId}/verify`,
      { txHash },
      { headers: getAuthHeaders() }
    );
    return res.data?.data || res.data;
  },

  async listMine() {
    const backendUrl = getBackendUrl();
    const res = await axios.get(`${backendUrl}/api/v1/marketplace/ads/mine`, {
      headers: getAuthHeaders(),
    });
    return res.data?.items || res.data?.data || res.data || [];
  },
};

export default marketplaceService;
