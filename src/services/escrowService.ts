import axios from 'axios';
import { getBackendUrl } from '../utils/apiConfig';

const backendUrl = getBackendUrl();

function authHeaders() {
  const token = localStorage.getItem('cto_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const escrowService = {
  async createOffer(payload: any) {
    const res = await axios.post(`${backendUrl}/api/v1/escrow/offer`, payload, {
      headers: authHeaders(),
    });
    return res.data?.data || res.data;
  },

  async getEscrow(id: string) {
    const res = await axios.get(`${backendUrl}/api/v1/escrow/${id}`, {
      headers: authHeaders(),
    });
    return res.data?.data || res.data;
  },

  async getLatestByConversation(conversationId: string) {
    const res = await axios.get(`${backendUrl}/api/v1/escrow/conversation/${conversationId}`, {
      headers: authHeaders(),
    });
    return res.data?.data || res.data;
  },

  async accept(id: string) {
    const res = await axios.post(`${backendUrl}/api/v1/escrow/${id}/accept`, {}, {
      headers: authHeaders(),
    });
    return res.data?.data || res.data;
  },

  async decline(id: string) {
    const res = await axios.post(`${backendUrl}/api/v1/escrow/${id}/decline`, {}, {
      headers: authHeaders(),
    });
    return res.data?.data || res.data;
  },

  async fund(id: string) {
    const res = await axios.post(`${backendUrl}/api/v1/escrow/${id}/fund`, {}, {
      headers: authHeaders(),
    });
    return res.data?.data || res.data;
  },

  async submitWork(id: string) {
    const res = await axios.post(`${backendUrl}/api/v1/escrow/${id}/submit`, {}, {
      headers: authHeaders(),
    });
    return res.data?.data || res.data;
  },

  async release(id: string) {
    const res = await axios.post(`${backendUrl}/api/v1/escrow/${id}/release`, {}, {
      headers: authHeaders(),
    });
    return res.data?.data || res.data;
  },

  async refund(id: string) {
    const res = await axios.post(`${backendUrl}/api/v1/escrow/${id}/refund`, {}, {
      headers: authHeaders(),
    });
    return res.data?.data || res.data;
  },
};

export default escrowService;
