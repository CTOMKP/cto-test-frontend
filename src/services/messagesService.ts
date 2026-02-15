import axios from 'axios';
import { getBackendUrl } from '../utils/apiConfig';

const backendUrl = getBackendUrl();

function authHeaders() {
  const token = localStorage.getItem('cto_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const messagesService = {
  async apply(adId: string, coverLetter: string) {
    const res = await axios.post(
      `${backendUrl}/api/v1/messages/apply/${adId}`,
      { coverLetter },
      { headers: authHeaders() }
    );
    return res.data?.data || res.data;
  },

  async listThreads() {
    const res = await axios.get(`${backendUrl}/api/v1/messages/threads`, {
      headers: authHeaders(),
    });
    return res.data?.data || res.data;
  },

  async getThread(id: string) {
    const res = await axios.get(`${backendUrl}/api/v1/messages/threads/${id}`, {
      headers: authHeaders(),
    });
    return res.data?.data || res.data;
  },

  async sendMessage(threadId: string, body: string) {
    const res = await axios.post(
      `${backendUrl}/api/v1/messages/threads/${threadId}/messages`,
      { body },
      { headers: authHeaders() }
    );
    return res.data?.data || res.data;
  },

  async markRead(threadId: string) {
    const res = await axios.post(
      `${backendUrl}/api/v1/messages/threads/${threadId}/read`,
      {},
      { headers: authHeaders() }
    );
    return res.data?.data || res.data;
  },
};

export default messagesService;
