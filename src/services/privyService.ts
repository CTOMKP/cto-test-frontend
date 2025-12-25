import axios from 'axios';
import { API_ENDPOINTS } from '../utils/constants';

/**
 * Privy Authentication Service
 * Handles Privy authentication and syncs with CTO backend
 */
class PrivyService {
  /**
   * Sync Privy user with CTO backend
   * @param privyToken - Privy authentication token from frontend
   * @returns User data and CTO JWT token
   */
  async syncUser(privyToken: string) {
    try {
      const response = await axios.post(
        `${API_ENDPOINTS.auth.base}/privy/sync`,
        { privyToken },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        // Store CTO JWT token
        localStorage.setItem('cto_token', response.data.token);
        localStorage.setItem('cto_user_email', response.data.user.email);
        localStorage.setItem('cto_user_id', response.data.user.id);
        
        if (response.data.user.walletAddress) {
          localStorage.setItem('cto_wallet_address', response.data.user.walletAddress);
        }

        console.log('✅ Privy user synced with CTO backend');
        return response.data;
      }

      throw new Error('Failed to sync user');
    } catch (error: any) {
      console.error('❌ Privy sync error:', error);
      throw new Error(error.response?.data?.message || 'Failed to sync with backend');
    }
  }

  /**
   * Verify Privy token
   * @param token - Privy token to verify
   * @returns Verification result
   */
  async verifyToken(token: string) {
    try {
      const response = await axios.post(
        `${API_ENDPOINTS.auth.base}/privy/verify`,
        { token },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Token verification error:', error);
      return { valid: false };
    }
  }

  /**
   * Get current Privy user info from backend
   * @returns User info
   */
  async getMe() {
    try {
      const token = localStorage.getItem('cto_token');
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await axios.get(
        `${API_ENDPOINTS.auth.base}/api/v1/auth/privy/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Get user error:', error);
      throw error;
    }
  }

  /**
   * Get user wallets from backend
   */
  async getUserWallets() {
    try {
      const token = localStorage.getItem('cto_token');
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await axios.get(
        `${API_ENDPOINTS.auth.base}/api/v1/auth/privy/wallets`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Get wallets error:', error);
      throw error;
    }
  }

  /**
   * Logout user (clear tokens)
   */
  logout() {
    localStorage.removeItem('cto_token');
    localStorage.removeItem('cto_user_email');
    localStorage.removeItem('cto_user_id');
    localStorage.removeItem('cto_wallet_address');
    console.log('✅ User logged out');
  }
}

export const privyService = new PrivyService();


