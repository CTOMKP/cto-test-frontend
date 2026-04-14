import axios from 'axios';
import { getBackendUrl } from '../utils/apiConfig';

const backendUrl = getBackendUrl();

export const solanaWalletService = {
  async getBalance(address: string) {
    const res = await axios.get(`${backendUrl}/api/v1/wallet/solana/balance/${address}`);
    return res.data?.data || res.data;
  },
};

export default solanaWalletService;
