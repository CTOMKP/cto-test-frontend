import axios from 'axios';
import { API_ENDPOINTS } from '../utils/constants';

export type CreatorTier = 'STARTER' | 'BUILDER' | 'PARTNER';
export type CreatorEarningType = 'LISTING_FEE' | 'MARKETPLACE_AD' | 'ESCROW_FEE' | 'REVENUE_SHARE';
export type CreatorPayoutStatus = 'REQUESTED' | 'APPROVED' | 'PROCESSING' | 'PAID' | 'REJECTED' | 'ON_HOLD';
export type CreatorReferralStatus = 'SIGNED_UP' | 'ACTIVE' | 'FRAUD_HOLD';
export type CreatorEarningStatus = 'PENDING' | 'AVAILABLE' | 'HELD' | 'PAID' | 'REVERSED';

export interface CreatorDashboardAccount {
  id: string;
  userId: number;
  referralCode: string;
  referralLink: string;
  tier: CreatorTier;
  activeReferralsCount: number;
  totalReferralsCount: number;
  totalEarned: number;
  pendingBalance: number;
  reservedBalance: number;
  paidBalance: number;
  heldBalance: number;
  payoutWalletAddress?: string | null;
  fraudStatus: string;
  fraudReason?: string | null;
  lastReviewedAt?: string | null;
}

export interface CreatorDashboardStats {
  totalReferrals: number;
  activeReferrals: number;
  tier: CreatorTier;
  referralsNeededForNextTier: number;
  thisMonthEarnings: number;
  pendingPayoutBalance: number;
  reservedPayoutBalance: number;
  allTimeTotalEarned: number;
  creatorCutPercent: number;
  nextTierTarget: number | null;
}

export interface CreatorDashboardReferral {
  id: string;
  referredUserId: number;
  referredUser?: {
    id: number;
    email: string;
    name?: string | null;
  };
  status: CreatorReferralStatus;
  isActive: boolean;
  isFraudFlagged: boolean;
  signedUpAt: string;
  activatedAt?: string | null;
  totalEarned: number;
  firstQualifyingActionType?: string | null;
}

export interface CreatorDashboardEarning {
  id: string;
  sourceType: CreatorEarningType;
  sourceId: string;
  amountGross: number;
  platformFeeAmount: number;
  creatorCutPercent: number;
  amountEarned: number;
  status: CreatorEarningStatus;
  createdAt: string;
  paymentId?: string | null;
  escrowId?: string | null;
}

export interface CreatorDashboardPayout {
  id: string;
  status: CreatorPayoutStatus;
  amountRequested: number;
  amountApproved: number;
  walletAddress: string;
  txHash?: string | null;
  requestNote?: string | null;
  createdAt: string;
  processedAt?: string | null;
  reviewedAt?: string | null;
  failureReason?: string | null;
}

export interface CreatorDashboardResponse {
  success: boolean;
  account: CreatorDashboardAccount;
  stats: CreatorDashboardStats;
  earningsBreakdown: { type: CreatorEarningType; amount: number }[];
  dailyEarnings: { date: string; amount: number }[];
  referrals: CreatorDashboardReferral[];
  earnings: CreatorDashboardEarning[];
  payouts: CreatorDashboardPayout[];
}

export interface CreatorPayoutRequest {
  walletAddress?: string;
  amount?: number;
  note?: string;
}

class CreatorProgramService {
  private get authHeaders() {
    const token = localStorage.getItem('cto_auth_token');
    if (!token) {
      throw new Error('No authentication token');
    }
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getDashboard(limit = 12): Promise<CreatorDashboardResponse> {
    const response = await axios.get(
      `${API_ENDPOINTS.auth.base}/api/v1/creator/me?limit=${limit}`,
      { headers: this.authHeaders },
    );
    return response.data;
  }

  async getReferrals(limit = 50) {
    const response = await axios.get(
      `${API_ENDPOINTS.auth.base}/api/v1/creator/referrals?limit=${limit}`,
      { headers: this.authHeaders },
    );
    return response.data;
  }

  async getEarnings(limit = 50) {
    const response = await axios.get(
      `${API_ENDPOINTS.auth.base}/api/v1/creator/earnings?limit=${limit}`,
      { headers: this.authHeaders },
    );
    return response.data;
  }

  async getPayouts(limit = 20) {
    const response = await axios.get(
      `${API_ENDPOINTS.auth.base}/api/v1/creator/payouts?limit=${limit}`,
      { headers: this.authHeaders },
    );
    return response.data;
  }

  async requestPayout(payload: CreatorPayoutRequest) {
    const response = await axios.post(
      `${API_ENDPOINTS.auth.base}/api/v1/creator/payouts/request`,
      payload,
      { headers: this.authHeaders },
    );
    return response.data;
  }
}

export const creatorProgramService = new CreatorProgramService();
