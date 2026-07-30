import axios from 'axios';
import { getBackendUrl } from '../utils/apiConfig';

const backendUrl = getBackendUrl();

export interface WalletPaidOutTokenTotal {
  tokenSymbol: string;
  rawAmount: string;
  decimals: number | null;
  amount: number | null;
  formattedAmount: string | null;
  transactionCount: number;
}

export interface WalletPaidOutSummary {
  totalPaidOut: number;
  totalPaidOutUsd: number;
  currency: string;
  tokenSymbol: string;
  transactionCount: number;
  byToken: WalletPaidOutTokenTotal[];
  calculatedAt: string;
}

function authHeaders() {
  const token = localStorage.getItem('cto_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const walletSummaryService = {
  async getTotalPaidOut(): Promise<WalletPaidOutSummary> {
    const response = await axios.get(
      `${backendUrl}/api/v1/wallet/summary/total-paid-out`,
      { headers: authHeaders() },
    );
    return response.data?.data ?? response.data;
  },
};

export default walletSummaryService;
