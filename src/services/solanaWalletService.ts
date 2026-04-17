import axios from 'axios';
import { getBackendUrl } from '../utils/apiConfig';
import { WalletTransaction } from './movementWalletService';

const backendUrl = getBackendUrl();
const getAuthHeaders = () => {
  const token = localStorage.getItem('cto_auth_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

export const solanaWalletService = {
  async getBalance(address: string) {
    const res = await axios.get(`${backendUrl}/api/v1/wallet/solana/balance/${address}`);
    // Handle both direct controller response and TransformInterceptor-wrapped response
    const payload =
      res.data?.data?.data || // wrapped + controller shape
      res.data?.data ||       // controller shape
      res.data;

    const solRaw = payload?.sol;
    const usdcRaw = payload?.usdc;
    const sol = typeof solRaw === 'number' ? solRaw : Number(solRaw || 0);
    const usdc = typeof usdcRaw === 'number' ? usdcRaw : Number(usdcRaw || 0);

    return {
      ...payload,
      sol: Number.isFinite(sol) ? sol : 0,
      usdc: Number.isFinite(usdc) ? usdc : 0,
    };
  },

  async getTransactions(walletId: string, limit: number = 20): Promise<WalletTransaction[]> {
    const res = await axios.get(`${backendUrl}/api/v1/wallet/solana/transactions/${walletId}?limit=${limit}`, {
      headers: getAuthHeaders(),
    });
    return res.data?.data?.transactions || res.data?.transactions || [];
  },

  async pollTransactions(
    walletId: string,
    limit: number = 15,
    address?: string,
  ): Promise<WalletTransaction[]> {
    const res = await axios.post(
      `${backendUrl}/api/v1/wallet/solana/poll/${walletId}`,
      { limit, address },
      { headers: getAuthHeaders() },
    );
    return res.data?.data?.transactions || res.data?.transactions || [];
  },
};

export default solanaWalletService;
