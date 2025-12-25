import axios from 'axios';

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';

function authHeaders() {
  const token = localStorage.getItem('cto_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface DashboardStats {
  users: { total: number };
  listings: { total: number; pending: number; published: number; rejected: number };
  payments: { total: number; completed: number; pending: number; revenue: number; currency: string };
  adBoosts: { active: number };
}

export const adminService = {
  // Get dashboard statistics
  async getDashboardStats(): Promise<{ stats: DashboardStats }> {
    const res = await axios.get(`${backendUrl}/api/v1/admin/dashboard/stats`, {
      headers: authHeaders(),
    });
    return res.data;
  },

  // Get pending listings
  async getPendingListings() {
    const res = await axios.get(`${backendUrl}/api/v1/admin/listings/pending`, {
      headers: authHeaders(),
    });
    return res.data;
  },

  // Get published listings
  async getPublishedListings() {
    const res = await axios.get(`${backendUrl}/api/v1/admin/listings/published`, {
      headers: authHeaders(),
    });
    return res.data;
  },

  // Approve listing
  async approveListing(listingId: string, adminUserId: string, notes?: string) {
    const res = await axios.post(
      `${backendUrl}/api/v1/admin/listings/approve`,
      { listingId, adminUserId, notes },
      { headers: authHeaders() }
    );
    return res.data;
  },

  // Reject listing
  async rejectListing(listingId: string, adminUserId: string, reason: string, notes?: string) {
    const res = await axios.post(
      `${backendUrl}/api/v1/admin/listings/reject`,
      { listingId, adminUserId, reason, notes },
      { headers: authHeaders() }
    );
    return res.data;
  },

  // Get all payments
  async getAllPayments(paymentType?: string, status?: string) {
    const queryParams = new URLSearchParams();
    if (paymentType) queryParams.append('paymentType', paymentType);
    if (status) queryParams.append('status', status);
    
    const query = queryParams.toString();
    const res = await axios.get(
      `${backendUrl}/api/v1/admin/payments${query ? '?' + query : ''}`,
      { headers: authHeaders() }
    );
    return res.data;
  },

  // Get active ad boosts
  async getActiveAdBoosts() {
    const res = await axios.get(`${backendUrl}/api/v1/admin/ad-boosts/active`, {
      headers: authHeaders(),
    });
    return res.data;
  },

  // Update user role
  async updateUserRole(userId: string, role: 'USER' | 'ADMIN' | 'MODERATOR', adminUserId: string) {
    const res = await axios.post(
      `${backendUrl}/api/v1/admin/users/update-role`,
      { userId, role, adminUserId },
      { headers: authHeaders() }
    );
    return res.data;
  },
};

export default adminService;

