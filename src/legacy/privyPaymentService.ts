import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';

export const privyPaymentService = {
  /**
   * Create a listing payment for Privy user
   */
  async payForListing(data: { userId: number; listingId: string; chain?: string }) {
    const token = localStorage.getItem('cto_auth_token');
    if (!token) {
      throw new Error('No authentication token');
    }
    const response = await axios.post(
      `${API_BASE}/api/v1/payment/privy/listing`,
      {
        userId: data.userId,
        listingId: data.listingId,
        chain: data.chain || 'base', // Default to Base
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  },

  /**
   * Verify a payment after transaction is submitted
   */
  async verifyPayment(paymentId: string, txHash?: string) {
    const token = localStorage.getItem('cto_auth_token');
    if (!token) {
      throw new Error('No authentication token');
    }
    const response = await axios.post(
      `${API_BASE}/api/v1/payment/privy/verify/${paymentId}`,
      { txHash },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  },

  /**
   * Get pricing information
   */
  async getPricing() {
    const response = await axios.get(`${API_BASE}/api/v1/payment/pricing`);
    return response.data;
  },
};
