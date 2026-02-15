import { getBackendUrl } from '../utils/apiConfig';

const backendUrl = getBackendUrl();

const notificationsService = {
  async list(unreadOnly?: boolean) {
    const token = localStorage.getItem('cto_auth_token');
    const query = unreadOnly ? '?unread=1' : '';
    const res = await fetch(`${backendUrl}/api/v1/notifications${query}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error('Failed to load notifications');
    return res.json();
  },

  async markRead(id: string) {
    const token = localStorage.getItem('cto_auth_token');
    const res = await fetch(`${backendUrl}/api/v1/notifications/${id}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error('Failed to mark notification read');
    return res.json();
  },
};

export default notificationsService;
