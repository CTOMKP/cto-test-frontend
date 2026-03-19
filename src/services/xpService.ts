import axios from 'axios';
import { getBackendUrl } from '../utils/apiConfig';
import { persistRewardData } from '../utils/rewardStorage';

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
    const payload = res.data?.data || res.data;
    persistRewardData(payload);
    return payload;
  },
  async getBalance() {
    const res = await axios.get(`${backendUrl}/api/v1/xp/me`, {
      headers: authHeaders(),
    });
    const payload = res.data?.data || res.data;
    persistRewardData(payload);
    return payload;
  },
};

export default xpService;
