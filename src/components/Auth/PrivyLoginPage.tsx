import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { useCreateWallet } from '@privy-io/react-auth/extended-chains';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ROUTES } from '../../utils/constants';
import { createMovementWallet, getMovementWallet } from '../../lib/movement-wallet';
import { getCloudFrontUrl } from '../../utils/image-url-helper';

// Module-level Set to track processing user IDs across ALL hook instances
const processingUserIds = new Set<string>();

export const PrivyLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, authenticated, user, ready, getAccessToken, logout } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreatingMovementWallet, setIsCreatingMovementWallet] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const syncAttemptedRef = useRef<string | null>(null);

  // Use a ref to always have the latest user object in async loops
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Sync with backend after Privy authentication
  useEffect(() => {
    if (authenticated && user && !isSyncing && !isCreatingMovementWallet) {
      const userId = user.id;
      
      // Prevent multiple parallel runs
      if (processingUserIds.has(userId)) return;
      
      // If already synced this session, skip
      if (syncAttemptedRef.current === userId) return;

      const token = localStorage.getItem('cto_auth_token');
      const storedId = localStorage.getItem('cto_user_id');
      if (token && storedId === userId) {
        syncAttemptedRef.current = userId;
        return;
      }

      processingUserIds.add(userId);
      syncAttemptedRef.current = userId;
      handleMovementWalletAndSync();
    }
  }, [authenticated, user?.id]);

  // Wait for Privy to fully load linkedAccounts (with retries)
  const waitForPrivyAccounts = async (maxRetries = 10, delayMs = 1000): Promise<boolean> => {
    for (let i = 0; i < maxRetries; i++) {
      const currentUser = userRef.current;
      if (currentUser?.linkedAccounts && currentUser.linkedAccounts.length > 0) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return false;
  };

  const waitForMovementWallet = async (maxRetries = 10, delayMs = 1000): Promise<boolean> => {
    for (let i = 0; i < maxRetries; i++) {
      const wallet = getMovementWallet(userRef.current);
      if (wallet) return true;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return false;
  };

  // Improved sync with fresh tokens and error handling (Matching main frontend logic)
  const syncWithBackend = async (isInitial = false) => {
    setIsSyncing(true);
    let lastError = null;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🔄 Sync attempt ${attempt}...`);
        const privyToken = await getAccessToken();
        if (!privyToken) throw new Error('No Privy token');

        const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';
        const response = await axios.post(
          `${backendUrl}/api/v1/auth/privy/sync`,
          { privyToken },
          { 
            headers: { 'Content-Type': 'application/json' }, 
            timeout: 30000,
            // Disable withCredentials for cross-origin if not using cookies
            withCredentials: false 
          }
        );

        const data = response.data.data || response.data;
        if (data.token) localStorage.setItem('cto_auth_token', data.token);
        if (data.user?.id) localStorage.setItem('cto_user_id', data.user.id.toString());
        if (data.user?.email) localStorage.setItem('cto_user_email', data.user.email);
        if (data.wallets) localStorage.setItem('cto_user_wallets', JSON.stringify(data.wallets));

        console.log('✅ Sync success');
        
        // If we found wallets, or if it's the final attempt, stop
        if ((data.wallets && data.wallets.length > 0) || attempt === 3) {
          setIsSyncing(false);
          return data;
        }
        
        console.warn('⚠️ No wallets found, retrying...');
        await new Promise(r => setTimeout(r, 2000));
      } catch (err: any) {
        lastError = err;
        console.error(`❌ Attempt ${attempt} failed:`, err.message);
        
        // If it's a CORS error, we might need to tell the user
        if (err.message?.includes('Network Error') || err.code === 'ERR_NETWORK') {
          console.error('Potential CORS issue or Backend down');
        }
        
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
      }
    }

    setIsSyncing(false);
    return null;
  };

  const handleMovementWalletAndSync = async () => {
    const userId = userRef.current?.id;
    try {
      setSyncProgress('Loading account...');
      await waitForPrivyAccounts();
      
      // STEP 1: Sync initial wallets (Ethereum/Social)
      setSyncProgress('Syncing with server...');
      const syncResult = await syncWithBackend(true);
      
      // STEP 2: Check for Movement wallet
      const wallets = syncResult?.wallets || [];
      const hasMovement = wallets.some((w: any) => 
        w.blockchain === 'MOVEMENT' || w.blockchain === 'APTOS' || w.chainType === 'aptos'
      );

      if (!hasMovement) {
        console.log('🔄 Creating Movement wallet...');
        setIsCreatingMovementWallet(true);
        setSyncProgress('Creating Movement wallet...');
        
        try {
          await createMovementWallet(userRef.current, createWallet);
          await waitForMovementWallet();
          
          setSyncProgress('Finalizing setup...');
          console.log('⏳ Waiting for Privy indexing (2s)...');
          await new Promise(r => setTimeout(r, 2000));
          
          // STEP 3: Final Sync
          await syncWithBackend(false);
        } catch (err) {
          console.error('❌ Wallet creation flow error:', err);
        } finally {
          setIsCreatingMovementWallet(false);
        }
      }
      
      console.log('🏁 Flow complete, navigating to profile');
      navigate(ROUTES.profile);
    } catch (error) {
      console.error('❌ Authentication flow failed:', error);
      navigate(ROUTES.profile);
    } finally {
      if (userId) processingUserIds.delete(userId);
      setIsSyncing(false);
      setIsCreatingMovementWallet(false);
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
