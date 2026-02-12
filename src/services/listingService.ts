import axios from 'axios';
import { getBackendUrl } from '../utils/apiConfig';

export interface TradeEvent {
  type: 'BUY' | 'SELL' | 'buy' | 'sell';
  txHash?: string;
  transactionHash?: string;
  timestamp: string | number | Date;
  price?: number;
  amount?: number;
  totalValue?: number;
  makerAddress?: string;
  swapper?: string;
  amountMOVE?: number;
  amountToken?: number;
  priceUSD?: number | null;
}

export interface ListingQuery {
  q?: string;
  chain?: string;
  category?: string;
  tier?: string;
  minRisk?: number;
  maxRisk?: number;
  sort?: string; // e.g., 'updatedAt:desc'
  page?: number;
  limit?: number;
}

export const listingService = {
  async list(params: ListingQuery = {}) {
    const backendUrl = getBackendUrl();
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    const res = await axios.get(`${backendUrl}/api/v1/listing/listings?${qs.toString()}`);
    return res.data;
  },
  async getOne(contractAddress: string) {
    const backendUrl = getBackendUrl();
    const res = await axios.get(`${backendUrl}/api/v1/listing/${contractAddress}`);
    return res.data;
  },
  async scan(contractAddress: string, chain: string = 'SOLANA') {
    const backendUrl = getBackendUrl();
    const res = await axios.post(`${backendUrl}/api/v1/listing/scan`, { contractAddress, chain });
    return res.data;
  },
  async refresh(contractAddress: string, chain: string = 'SOLANA') {
    const backendUrl = getBackendUrl();
    const token = localStorage.getItem('cto_jwt_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await axios.post(`${backendUrl}/api/v1/listing/refresh`, { contractAddress, chain }, { headers });
    return res.data;
  },
  async getTokenTrades(
    contractAddress: string,
    limit: number = 50,
    chain?: string,
  ): Promise<TradeEvent[]> {
    const backendUrl = getBackendUrl();
    const qs = new URLSearchParams();
    qs.set('limit', String(limit));
    if (chain) qs.set('chain', chain);
    // Allow cache in production to reduce upstream API usage
    if (process.env.NODE_ENV !== 'production') {
      qs.set('nocache', '1');
    }
    const res = await axios.get(
      `${backendUrl}/api/v1/tokens/${contractAddress}/trades?${qs.toString()}`
    );
    const payload = res.data;
    return payload?.data?.data || payload?.data || payload || [];
  },
};

export default listingService;
