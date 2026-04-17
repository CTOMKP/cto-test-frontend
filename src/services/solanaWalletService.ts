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
    return res.data?.data || res.data;
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
