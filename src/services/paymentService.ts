import axios from 'axios';

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';

function authHeaders() {
  const token = localStorage.getItem('cto_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface PaymentPricing {
  listing: number;
  adBoosts: {
    top: number;
    priority: number;
    bump: number;
    spotlight: number;
    homepage: number;
    urgent: number;
  };
}

export interface Payment {
  id: string;
  userId: number;
  paymentType: 'LISTING' | 'AD_BOOST' | 'ESCROW' | 'WITHDRAWAL' | 'OTHER';
  listingId?: string;
  adBoostId?: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  transferId?: string;
  txHash?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ListingPaymentPayload {
  userId: string;
  listingId: string;
  walletId?: string;
}

export interface AdBoostPaymentPayload {
  userId: string;
  listingId: string;
  boostType: 'top' | 'priority' | 'bump' | 'spotlight' | 'homepage' | 'urgent';
  durationDays: number;
  walletId?: string;
}

export const paymentService = {
  // Get pricing information
  async getPricing(): Promise<{ pricing: PaymentPricing; currency: string }> {
    const res = await axios.get(`${backendUrl}/api/payment/pricing`, {
      headers: authHeaders(),
    });
    return res.data;
  },

  // Pay for listing
  async payForListing(payload: ListingPaymentPayload) {
    const res = await axios.post(
      `${backendUrl}/api/payment/listing`,
      payload,
      { headers: authHeaders() }
    );
    return res.data;
  },

  // Pay for ad boost
  async payForAdBoost(payload: AdBoostPaymentPayload) {
    const res = await axios.post(
      `${backendUrl}/api/payment/ad-boost`,
      payload,
      { headers: authHeaders() }
    );
    return res.data;
  },

  // Verify payment status
  async verifyPayment(paymentId: string, userId: string) {
    const res = await axios.get(
      `${backendUrl}/api/payment/verify/${paymentId}?userId=${userId}`,
      { headers: authHeaders() }
    );
    return res.data;
  },

  // Get payment history
  async getPaymentHistory(userId: string, paymentType?: string) {
    const queryParams = paymentType ? `?paymentType=${paymentType}` : '';
    const res = await axios.get(
      `${backendUrl}/api/payment/history/${userId}${queryParams}`,
      { headers: authHeaders() }
    );
    return res.data;
  },
};

export default paymentService;

