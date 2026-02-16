import { getBackendUrl } from '../utils/apiConfig';

const backendUrl = getBackendUrl();

const messagesService = {
  async listThreads() {
    const token = localStorage.getItem('cto_auth_token');
    const res = await fetch(`${backendUrl}/api/v1/messages/threads`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error('Failed to load threads');
    return res.json();
  },
};

export default messagesService;
