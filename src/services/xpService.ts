import axios from 'axios';
import { getBackendUrl } from '../utils/apiConfig';

const backendUrl = getBackendUrl();

function authHeaders() {
  const token = localStorage.getItem('cto_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const xpService = {
  async getMe() {
    const res = await axios.get(`${backendUrl}/api/v1/xp/me`, {
      headers: authHeaders(),
    });
    return res.data?.data || res.data;
  },
};

export default xpService;
