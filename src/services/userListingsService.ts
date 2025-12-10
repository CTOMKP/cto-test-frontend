import axios from 'axios';

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';

function authHeaders() {
  const token = localStorage.getItem('cto_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ScanResult {
  success: boolean;
  vettingScore: number;
  vettingTier: string;
  eligible: boolean;
  details?: any;
}

export interface CreateUserListingPayload {
  contractAddr: string;
  chain: string;
  title: string;
  description: string;
  bio?: string;
  logoUrl?: string;
  bannerUrl?: string;
  links?: Record<string, any>;
  vettingTier: string;
  vettingScore: number;
}

export const userListingsService = {
  async scan(contractAddr: string, chain: string = 'SOLANA') {
    // Accept non-2xx statuses (e.g., 400 ineligible) and normalize response so UI can proceed
    const res = await axios.post(
      `${backendUrl}/api/user-listings/scan`,
      { contractAddr, chain },
      { headers: authHeaders(), validateStatus: () => true }
    );
    // Force re-auth if unauthorized
    if (res.status === 401) {
      throw new Error('Unauthorized');
    }
    if (res.status >= 200 && res.status < 300) {
      return res.data as ScanResult;
    }
    // For structured backend errors (HttpException with metadata), preserve details
    if (res.data && (res.data.metadata || typeof res.data.risk_score !== 'undefined')) {
      return {
        success: false,
        vettingScore: res.data?.risk_score ?? 0,
        vettingTier: res.data?.tier ?? 'UNQUALIFIED',
        eligible: res.data?.eligible ?? false,
        details: res.data,
      } as ScanResult;
    }
    // Fallback normalization
    const message = (res.data && (res.data.message || res.data.error)) ||
      'Token does not meet minimum criteria for any tier';
    return {
      success: false,
      vettingScore: res.data?.vettingScore ?? 0,
      vettingTier: res.data?.vettingTier ?? 'UNQUALIFIED',
      eligible: false,
      details: { message, status: res.status, raw: res.data },
    } as ScanResult;
  },
  async create(payload: CreateUserListingPayload) {
    const res = await axios.post(`${backendUrl}/api/user-listings`, payload, { headers: authHeaders() });
    return res.data;
  },
  async update(id: string, payload: Partial<CreateUserListingPayload>) {
    const res = await axios.put(`${backendUrl}/api/user-listings/${id}`, payload, { headers: authHeaders() });
    return res.data;
  },
  async publish(id: string) {
    const res = await axios.post(`${backendUrl}/api/user-listings/${id}/publish`, {}, { headers: authHeaders() });
    return res.data;
  },
  async mine() {
    const res = await axios.get(`${backendUrl}/api/user-listings/mine/all`, { headers: authHeaders() });
    return res.data;
  },
  async listPublic(page = 1, limit = 20) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const res = await axios.get(`${backendUrl}/api/user-listings?${params.toString()}`);
    return res.data;
  },
  async addAd(id: string, payload: { type: string; durationDays: number; startDate?: string }) {
    const res = await axios.post(`${backendUrl}/api/user-listings/${id}/ads`, payload, { headers: authHeaders() });
    return res.data;
  },
  async delete(id: string) {
    const res = await axios.delete(`${backendUrl}/api/user-listings/${id}`, { headers: authHeaders() });
    return res.data;
  },
  async getMyListing(id: string) {
    const res = await axios.get(`${backendUrl}/api/user-listings/mine/${id}`, { headers: authHeaders() });
    return res.data;
  },
  async getPublicListing(id: string) {
    const res = await axios.get(`${backendUrl}/api/user-listings/${id}`);
    return res.data;
  }
};

export default userListingsService;