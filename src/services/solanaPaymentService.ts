import axios from 'axios';
import { getBackendUrl } from '../utils/apiConfig';

const backendUrl = getBackendUrl();

function authHeaders() {
  const token = localStorage.getItem('cto_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const solanaPaymentService = {
  async createListingPayment(listingId: string) {
    const res = await axios.post(
      `${backendUrl}/api/v1/payment/solana/listing/${listingId}`,
      {},
      { headers: authHeaders() }
    );
    return res.data?.data || res.data;
  },

  async verifyPayment(paymentId: string, txHash: string) {
    const res = await axios.post(
      `${backendUrl}/api/v1/payment/solana/verify/${paymentId}`,
      { txHash },
      { headers: authHeaders() }
    );
    return res.data?.data || res.data;
  },

  async createMarketplaceAdPayment(adId: string, amountUsd: number) {
    const res = await axios.post(
      `${backendUrl}/api/v1/payment/solana/marketplace-ad/${adId}`,
      { amountUsd },
      { headers: authHeaders() }
    );
    return res.data?.data || res.data;
  },

  async verifyMarketplaceAdPayment(paymentId: string, txHash: string) {
    const res = await axios.post(
      `${backendUrl}/api/v1/payment/solana/verify-ad/${paymentId}`,
      { txHash },
      { headers: authHeaders() }
    );
    return res.data?.data || res.data;
  },
};

export default solanaPaymentService;
