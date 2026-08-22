import axios from 'axios';
import { getBackendUrl } from '../utils/apiConfig';

const backendUrl = getBackendUrl();

export type FavoriteTargetType = 'TOKEN' | 'USER_LISTING' | 'MARKETPLACE_AD';

export type FavoriteRecord = {
  id: string;
  targetType: FavoriteTargetType;
  targetId: string;
  targetKey: string;
  chain?: string | null;
};

function authHeaders() {
  const token = localStorage.getItem('cto_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function unwrap<T>(raw: any): T {
  return (raw?.data?.data || raw?.data || raw) as T;
}

export const favoritesService = {
  async list(targetType?: FavoriteTargetType) {
    const params = targetType ? { type: targetType } : undefined;
    const res = await axios.get(`${backendUrl}/api/v1/favorites`, {
      headers: authHeaders(),
      params,
    });
    return unwrap<{ success: boolean; items: FavoriteRecord[]; total: number }>(res);
  },

  async add(payload: {
    targetType: FavoriteTargetType;
    targetId: string;
    chain?: string;
  }) {
    const res = await axios.post(`${backendUrl}/api/v1/favorites`, payload, {
      headers: authHeaders(),
    });
    return unwrap<{ success: boolean; favorite: FavoriteRecord }>(res);
  },

  async remove(favoriteId: string) {
    const res = await axios.delete(
      `${backendUrl}/api/v1/favorites/${encodeURIComponent(favoriteId)}`,
      { headers: authHeaders() },
    );
    return unwrap<{ success: boolean; deletedId: string }>(res);
  },
};

export default favoritesService;
