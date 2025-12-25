import axios from 'axios';

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';

function authHeaders() {
  const token = localStorage.getItem('cto_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface ScanResult {
  success: boolean;
  risk_score: number;
  tier: string;
  risk_level?: string;
  eligible: boolean;
  summary?: string;
  metadata?: {
    token_symbol?: string;
    token_name?: string;
    project_age_days?: number;
    age_display?: string;
    age_display_short?: string;
    creation_date?: string | Date;
    lp_amount_usd?: number;
    token_price?: number;
    volume_24h?: number;
    market_cap?: number;
    pool_count?: number;
    lp_lock_months?: number;
    lp_burned?: boolean;
    lp_locked?: boolean;
    lock_contract?: any;
    lock_analysis?: any;
    largest_lp_holder?: any;
    pair_address?: string;
    scan_timestamp?: string;
    verified?: boolean;
    holder_count?: number;
    creation_transaction?: string;
    distribution_metrics?: any;
    whale_analysis?: any;
    suspicious_activity_details?: any;
    activity_summary?: any;
    wallet_activity_data?: any;
    smart_contract_security?: any;
  };
  // Legacy fields for backward compatibility
  vettingScore?: number;
  vettingTier?: string;
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
  links?: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    [key: string]: any;
  };
  vettingTier: string;
  vettingScore: number;
}

export const userListingsService = {
  async scan(contractAddr: string, chain: string = 'SOLANA'): Promise<ScanResult> {
    // Accept non-2xx statuses (e.g., 400 ineligible) and normalize response so UI can proceed
    const res = await axios.post(
      `${backendUrl}/api/v1/user-listings/scan`,
      { contractAddr, chain },
      { headers: authHeaders(), validateStatus: () => true }
    );
    
    // Handle wrapped response from TransformInterceptor
    const responseData = res.data?.data || res.data;
    
    // Force re-auth if unauthorized
    if (res.status === 401) {
      throw new Error('Unauthorized');
    }
    
    if (res.status >= 200 && res.status < 300) {
      // Normalize response to match our interface
      return {
        success: true,
        risk_score: responseData?.risk_score ?? 0,
        tier: responseData?.tier ?? 'UNQUALIFIED',
        risk_level: responseData?.risk_level,
        eligible: responseData?.eligible ?? false,
        summary: responseData?.summary,
        metadata: responseData?.metadata,
        // Legacy fields for backward compatibility
        vettingScore: responseData?.risk_score ?? responseData?.vettingScore ?? 0,
        vettingTier: responseData?.tier ?? responseData?.vettingTier ?? 'UNQUALIFIED',
        details: responseData,
      } as ScanResult;
    }
    
    // For structured backend errors (HttpException with metadata), preserve details
    if (responseData && (responseData.metadata || typeof responseData.risk_score !== 'undefined')) {
      return {
        success: false,
        risk_score: responseData?.risk_score ?? 0,
        tier: responseData?.tier ?? 'UNQUALIFIED',
        risk_level: responseData?.risk_level,
        eligible: responseData?.eligible ?? false,
        summary: responseData?.summary,
        metadata: responseData?.metadata,
        // Legacy fields
        vettingScore: responseData?.risk_score ?? 0,
        vettingTier: responseData?.tier ?? 'UNQUALIFIED',
        details: responseData,
      } as ScanResult;
    }
    
    // Fallback normalization
    const message = (responseData && (responseData.message || responseData.error)) ||
      'Token does not meet minimum criteria for any tier';
    return {
      success: false,
      risk_score: responseData?.risk_score ?? 0,
      tier: responseData?.tier ?? 'UNQUALIFIED',
      eligible: false,
      // Legacy fields
      vettingScore: responseData?.risk_score ?? 0,
      vettingTier: responseData?.tier ?? 'UNQUALIFIED',
      details: { message, status: res.status, raw: responseData },
    } as ScanResult;
  },
  async create(payload: CreateUserListingPayload) {
    const res = await axios.post(`${backendUrl}/api/v1/user-listings`, payload, { headers: authHeaders() });
    // Handle wrapped response from TransformInterceptor
    const responseData = res.data?.data || res.data;
    return responseData;
  },
  async update(id: string, payload: Partial<CreateUserListingPayload>) {
    const res = await axios.put(`${backendUrl}/api/v1/user-listings/${id}`, payload, { headers: authHeaders() });
    // Handle wrapped response from TransformInterceptor
    const responseData = res.data?.data || res.data;
    return responseData;
  },
  async publish(id: string) {
    const res = await axios.post(`${backendUrl}/api/v1/user-listings/${id}/publish`, {}, { headers: authHeaders() });
    // Handle wrapped response from TransformInterceptor
    const responseData = res.data?.data || res.data;
    return responseData;
  },
  async mine() {
    const res = await axios.get(`${backendUrl}/api/v1/user-listings/mine/all`, { headers: authHeaders() });
    // Handle wrapped response from TransformInterceptor
    const responseData = res.data?.data || res.data;
    return responseData;
  },
  async listPublic(page = 1, limit = 20) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const res = await axios.get(`${backendUrl}/api/v1/user-listings?${params.toString()}`);
    // Handle wrapped response from TransformInterceptor
    const responseData = res.data?.data || res.data;
    return responseData;
  },
  async addAd(id: string, payload: { type: string; durationDays: number; startDate?: string }) {
    const res = await axios.post(`${backendUrl}/api/v1/user-listings/${id}/ads`, payload, { headers: authHeaders() });
    // Handle wrapped response from TransformInterceptor
    const responseData = res.data?.data || res.data;
    return responseData;
  },
  async delete(id: string) {
    const res = await axios.delete(`${backendUrl}/api/v1/user-listings/${id}`, { headers: authHeaders() });
    // Handle wrapped response from TransformInterceptor
    const responseData = res.data?.data || res.data;
    return responseData;
  },
  async getMyListing(id: string) {
    const res = await axios.get(`${backendUrl}/api/v1/user-listings/mine/${id}`, { headers: authHeaders() });
    // Handle wrapped response from TransformInterceptor
    const responseData = res.data?.data || res.data;
    return responseData;
  },
  async getPublicListing(id: string) {
    const res = await axios.get(`${backendUrl}/api/v1/user-listings/${id}`);
    // Handle wrapped response from TransformInterceptor
    const responseData = res.data?.data || res.data;
    return responseData;
  }
};

export default userListingsService;