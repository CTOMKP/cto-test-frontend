import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { useCreateWallet } from '@privy-io/react-auth/extended-chains';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ROUTES } from '../../utils/constants';
import { createMovementWallet, getMovementWallet } from '../../lib/movement-wallet';
import { getCloudFrontUrl } from '../../utils/image-url-helper';

// Module-level Set to track processing user IDs
const processingUserIds = new Set<string>();

export const PrivyLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, authenticated, user, ready, getAccessToken, logout } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreatingMovementWallet, setIsCreatingMovementWallet] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');

  // Use a ref to always have the latest user object
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Sync with backend after Privy authentication
  useEffect(() => {
    if (!authenticated || !user || isSyncing || isCreatingMovementWallet) {
      return;
    }

    const userId = user.id;
    
    // Prevent parallel runs
    if (processingUserIds.has(userId)) {
      return;
    }

    // Check if we already have a token
    const existingToken = localStorage.getItem('cto_auth_token');
    if (existingToken && localStorage.getItem('cto_user_id') === userId) {
      // If we already have a Movement wallet in storage, we can navigate
      if (localStorage.getItem('cto_wallet_id')) {
        navigate(ROUTES.profile);
        return;
      }
    }

    processingUserIds.add(userId);
    handleMovementWalletAndSync(userId);
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, user?.id]);

  // Wait for Privy accounts to load
  const waitForPrivyAccounts = async (maxRetries = 5, delayMs = 500): Promise<boolean> => {
    for (let i = 0; i < maxRetries; i++) {
      if (userRef.current?.linkedAccounts && userRef.current.linkedAccounts.length > 0) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return false;
  };

  // Handle Movement wallet creation and backend sync
  const handleMovementWalletAndSync = async (userId: string) => {
    try {
      setIsSyncing(true);
      setSyncProgress('Initializing...');
      
      // Step 1: Wait for Privy accounts
      await waitForPrivyAccounts();
      
      // Step 2: Initial Sync with backend
      setSyncProgress('Checking account...');
      console.log('🔄 Initial sync with backend...');
      const syncResult = await syncWithBackend();
      
      if (!syncResult) {
        throw new Error('Initial sync failed');
      }

      // Step 3: Check for Movement wallet
      const hasMoveWallet = syncResult.wallets?.some(
        (w: any) => w.blockchain === 'MOVEMENT' || w.blockchain === 'APTOS'
      ) || !!getMovementWallet(userRef.current);

      if (!hasMoveWallet) {
        setSyncProgress('Creating Movement wallet...');
        setIsCreatingMovementWallet(true);
        console.log('🔄 Creating Movement wallet...');
        
        try {
          await createMovementWallet(userRef.current, createWallet);
          console.log('✅ Movement wallet created on Privy');
          
          // CRITICAL: Delay to let Privy index the new wallet
          setSyncProgress('Finalizing...');
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Final sync to save the new wallet
          console.log('🔄 Final sync after wallet creation...');
          await syncWithBackend();
          toast.success('Wallet ready!');
        } catch (error) {
          console.error('❌ Wallet creation/sync error:', error);
          // Try one last sync anyway
          await syncWithBackend();
        } finally {
          setIsCreatingMovementWallet(false);
        }
      }

      // Step 4: Navigation
      setSyncProgress('Redirecting...');
      setTimeout(() => {
        processingUserIds.delete(userId);
        navigate(ROUTES.profile);
      }, 100);

    } catch (error: any) {
      console.error('❌ Authentication flow failed:', error);
      toast.error('Setup failed. Please try again.');
      setIsSyncing(false);
      setIsCreatingMovementWallet(false);
      processingUserIds.delete(userId);
    }
  };

  const syncWithBackend = async () => {
    try {
      const privyToken = await getAccessToken();
      if (!privyToken) throw new Error('No Privy token');

      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';
      
      const response = await axios.post(
        `${backendUrl}/api/v1/auth/privy/sync`,
        { privyToken },
        { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
      );

      const responseData = response.data.data || response.data;
      if (!responseData?.user) throw new Error('Invalid response');

      // Store auth data
      localStorage.setItem('cto_auth_token', responseData.token);
      localStorage.setItem('cto_user_id', responseData.user.id.toString());
      localStorage.setItem('cto_user_email', responseData.user.email);
      
      if (responseData.user.avatarUrl) {
        const cloudfrontUrl = getCloudFrontUrl(responseData.user.avatarUrl);
        localStorage.setItem('cto_user_avatar_url', cloudfrontUrl);
        localStorage.setItem('profile_avatar_url', cloudfrontUrl);
      }

      if (responseData.wallets) {
        localStorage.setItem('cto_user_wallets', JSON.stringify(responseData.wallets));
        const moveWallet = responseData.wallets.find((w: any) => 
          w.blockchain === 'MOVEMENT' || w.chainType === 'aptos'
        );
        if (moveWallet) {
          localStorage.setItem('cto_wallet_id', moveWallet.id);
          localStorage.setItem('cto_wallet_address', moveWallet.address);
        }
      }

      return responseData;
    } catch (error) {
      console.error('Backend sync call failed:', error);
      return null;
    }
  };

  const handleLogin = async () => {
    try {
      console.log('🔄 Starting OAuth login...');
      
      // Add timeout wrapper for OAuth
      const loginPromise = login();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OAuth timeout - please try again')), 30000)
      );
      
      await Promise.race([loginPromise, timeoutPromise]);
    } catch (error: any) {
      console.error('❌ Login failed:', error);
      
      if (error.message?.includes('timeout')) {
        toast.error('Login timed out. Please try again.');
      } else if (error.message?.includes('oauth') || error.message?.includes('TimeoutError')) {
        toast.error('OAuth error. Please refresh and try again.');
      } else {
        toast.error('Login failed. Please try again.');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      localStorage.clear();
      toast.success('Logged out successfully');
      navigate(ROUTES.login);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-xl text-gray-700">Loading Privy...</p>
        </div>
      </div>
    );
  }

  if (isSyncing || isCreatingMovementWallet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center p-8 max-w-md w-full bg-white rounded-2xl shadow-xl">
          <div className="animate-spin rounded-full h-24 w-24 border-b-2 border-purple-600 mx-auto mb-6"></div>
          <p className="text-2xl font-bold text-gray-900 mb-2">
            {isCreatingMovementWallet ? 'Creating Wallet...' : 'Syncing Profile...'}
          </p>
          <p className="text-gray-600 mb-4">
            {isCreatingMovementWallet 
              ? 'Setting up your Movement Network wallet. Please do not close this window.' 
              : 'Syncing your wallets and profile with our servers.'}
          </p>
          {syncProgress && (
            <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium animate-pulse">
              {syncProgress}
            </div>
          )}
          <p className="mt-6 text-xs text-gray-400">
            This usually takes 10-15 seconds for new users.
          </p>
        </div>
      </div>
    );
  }

  if (authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You're Logged In!</h2>
            <p className="text-gray-600">{user?.email?.address || 'Privy User'}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate(ROUTES.profile)}
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-purple-700 transition-colors"
            >
              Go to Profile
            </button>
            
            <button
              onClick={handleLogout}
              className="w-full bg-gray-200 text-gray-700 py-3 px-4 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Login Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4 transform hover:scale-110 transition-transform">
            <span className="text-4xl">🚀</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to CTO Marketplace</h1>
          <p className="text-gray-600">Secure authentication powered by Privy</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 shadow-lg"
          >
            🔐 Login with Privy
          </button>

          <div className="mt-6 p-4 bg-blue-50 rounded-xl">
            <h3 className="font-semibold text-blue-900 mb-2">✨ What is Privy?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>✅ Secure wallet-based authentication</li>
              <li>✅ Email & social login options</li>
              <li>✅ Embedded wallets (no extension needed)</li>
              <li>✅ Connect external wallets (MetaMask, Phantom, etc.)</li>
            </ul>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          By logging in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
};
