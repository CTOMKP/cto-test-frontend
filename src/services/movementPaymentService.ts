import axios from 'axios';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';

/**
 * Movement Payment Service
 * Handles payments using Movement test tokens (MOVE) via Privy Movement wallets
 */
export const movementPaymentService = {
  /**
   * Create a Movement payment for listing
   * @param listingId - The listing ID to pay for
   * @returns Payment data including transaction data for Privy signing
   */
  async createListingPayment(listingId: string) {
    const token = localStorage.getItem('cto_auth_token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await axios.post(
      `${API_BASE}/api/v1/payment/movement/listing/${listingId}`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    // Handle wrapped response from TransformInterceptor
    const responseData = response.data?.data || response.data;
    return responseData;
  },

  /**
   * Verify a Movement payment after transaction is submitted
   * @param paymentId - The payment ID to verify
   * @param txHash - The transaction hash from the blockchain
   * @returns Verification result
   */
  async verifyPayment(paymentId: string, txHash: string) {
    const token = localStorage.getItem('cto_auth_token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await axios.post(
      `${API_BASE}/api/v1/payment/movement/verify/${paymentId}`,
      { txHash },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    // Handle wrapped response from TransformInterceptor
    const responseData = response.data?.data || response.data;
    return responseData;
  },
};
