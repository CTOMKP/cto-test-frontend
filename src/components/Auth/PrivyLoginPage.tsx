import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { useCreateWallet } from '@privy-io/react-auth/extended-chains';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ROUTES } from '../../utils/constants';
import { createMovementWallet, getMovementWallet } from '../../lib/movement-wallet';
import { getCloudFrontUrl } from '../../utils/image-url-helper';

export const PrivyLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, authenticated, user, ready, getAccessToken, logout } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreatingMovementWallet, setIsCreatingMovementWallet] = useState(false);
  const [hasStartedSync, setHasStartedSync] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');

  // Use a ref to always have the latest user object in async loops
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Sync with backend after Privy authentication and Movement wallet creation
  useEffect(() => {
    if (authenticated && user && !isSyncing && !isCreatingMovementWallet && !hasStartedSync) {
      setHasStartedSync(true);
      handleMovementWalletAndSync();
    }
  }, [authenticated, user, isSyncing, isCreatingMovementWallet, hasStartedSync]);

  // Wait for Privy to fully load linkedAccounts (with retries)
  const waitForPrivyAccounts = async (maxRetries = 15, delayMs = 1000): Promise<boolean> => {
    console.log('⏳ Waiting for Privy accounts to settle...');
    for (let i = 0; i < maxRetries; i++) {
      const currentUser = userRef.current;
      // Check if linkedAccounts is loaded and has items
      if (currentUser?.linkedAccounts && currentUser.linkedAccounts.length > 0) {
        // Also check if we have any wallet (at least Ethereum is usually there)
        const hasAnyWallet = currentUser.linkedAccounts.some(acc => acc.type === 'wallet');
        if (hasAnyWallet) {
          console.log(`✅ Privy wallets loaded after ${i + 1} attempt(s)`);
          return true;
        }
      }
      
      console.log(`⏳ Waiting for Privy wallets to load... (attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    console.warn('⚠️ Privy accounts not fully loaded, proceeding anyway...');
    return false;
  };

  // Wait specifically for Movement wallet to appear in user object
  const waitForMovementWallet = async (maxRetries = 15, delayMs = 1000): Promise<boolean> => {
    console.log('⏳ Waiting for Movement wallet to appear in Privy user object...');
    for (let i = 0; i < maxRetries; i++) {
      const wallet = getMovementWallet(userRef.current);
      if (wallet) {
        console.log(`✅ Movement wallet appeared after ${i + 1} attempt(s):`, wallet.address);
        return true;
      }
      
      console.log(`⏳ Still waiting for Movement wallet... (attempt ${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    return false;
  };

  // Handle Movement wallet creation and backend sync
  const handleMovementWalletAndSync = async () => {
    try {
      setSyncProgress('Loading Privy data...');
      // Step 1: Wait for Privy to fully load linkedAccounts
      await waitForPrivyAccounts();
      
      // Step 2: First sync with backend to check if user already exists and has wallets
      setSyncProgress('Checking existing account...');
      console.log('🔄 Step 1: Syncing with backend to check existing wallets...');
      let backendSyncResult;
      try {
        backendSyncResult = await syncWithBackend(true); // Pass flag to skip navigation
      } catch (syncError) {
        console.error('❌ Backend sync failed:', syncError);
        // If sync fails, we'll still try to check Privy wallets
        backendSyncResult = null;
      }

      // Step 3: Check if user has Movement wallet in backend
      const backendHasMovementWallet = backendSyncResult?.wallets?.some(
        (w: any) => w.blockchain === 'MOVEMENT'
      );

      // Step 4: Check if user has Movement wallet in Privy
      let movementWallet = getMovementWallet(userRef.current);
      const privyHasMovementWallet = !!movementWallet;

      console.log('📊 Wallet Status Check:');
      console.log(`  - Backend has Movement wallet: ${backendHasMovementWallet}`);
      console.log(`  - Privy has Movement wallet: ${privyHasMovementWallet}`);

      // Step 5: Only create wallet if BOTH backend and Privy don't have it
      if (!backendHasMovementWallet && !privyHasMovementWallet) {
        setIsCreatingMovementWallet(true);
        setSyncProgress('Creating Movement wallet...');
        console.log('🔄 Creating Movement wallet (new user)...');
        
        try {
          // Create Movement wallet using Privy with shorter timeout
          const walletCreationPromise = createMovementWallet(userRef.current, createWallet);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Wallet creation timeout')), 30000)
          );
          
          const newWallet = await Promise.race([walletCreationPromise, timeoutPromise]);
          console.log('✅ Movement wallet created:', newWallet);
          
          // CRITICAL: Wait for the new wallet to appear in the local user object
          // before we attempt to sync with backend. If we sync too early,
          // the backend might not see the new wallet from Privy API yet.
          setSyncProgress('Verifying wallet...');
          await waitForMovementWallet();
          
          toast.success('Movement wallet ready!');
        } catch (error: any) {
          console.error('❌ Wallet creation error:', error);
          
          // Check if wallet was actually created despite the error/timeout
          const checkWallet = getMovementWallet(userRef.current);
          if (checkWallet) {
            console.log('✅ Wallet exists despite error, proceeding...');
            toast.success('Wallet ready!');
          } else {
            console.warn('⚠️ Wallet creation error, but continuing to sync...');
            toast('Continuing setup...', { icon: '⏳', duration: 3000 });
          }
        } finally {
          setIsCreatingMovementWallet(false);
        }

        // Re-sync with backend after wallet creation to update backend
        setSyncProgress('Syncing with servers...');
        console.log('🔄 Re-syncing with backend after wallet creation...');
        try {
          await syncWithBackend();
        } catch (syncError) {
          console.error('❌ Backend re-sync failed:', syncError);
          // Navigate anyway
          setTimeout(() => {
            navigate(ROUTES.profile);
          }, 1000);
        }
      } else {
        // User already has wallet - just sync and navigate
        setSyncProgress('Synchronizing account...');
        console.log('✅ User already has Movement wallet, skipping creation');
        
        // Final sync to ensure backend is up to date (skip if we already synced)
        if (!backendSyncResult) {
          try {
            await syncWithBackend();
          } catch (syncError) {
            console.error('❌ Final backend sync failed:', syncError);
            // Navigate anyway
            setTimeout(() => {
              navigate(ROUTES.profile);
            }, 1000);
          }
        } else {
          // Already synced, just navigate
          setSyncProgress('Redirecting...');
          setTimeout(() => {
            navigate(ROUTES.profile);
          }, 100);
        }
      }
    } catch (error) {
      console.error('❌ Error in Movement wallet setup:', error);
      setIsCreatingMovementWallet(false);
      setIsSyncing(false);
      // Try to navigate anyway
      setTimeout(() => {
        navigate(ROUTES.profile);
      }, 1000);
    }
  };

  const syncWithBackend = async (skipNavigation = false) => {
    setIsSyncing(true);
    try {
      console.log('🔄 Syncing Privy user with backend...', user);
      console.log('📧 User email:', user?.email);
      console.log('📱 Linked accounts:', user?.linkedAccounts);

      // Get fresh Privy access token (tokens expire quickly) with retry
      console.log('🔄 Getting fresh Privy token...');
      let privyToken;
      let tokenRetries = 0;
      const maxTokenRetries = 3;
      
      while (tokenRetries < maxTokenRetries) {
        try {
          privyToken = await getAccessToken();
          if (privyToken) break;
        } catch (error) {
          console.log(`❌ Token attempt ${tokenRetries + 1} failed:`, error);
          if (tokenRetries === maxTokenRetries - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000));
          tokenRetries++;
        }
      }
      
      if (!privyToken) {
        throw new Error('No Privy token available');
      }

      console.log('✅ Got fresh Privy token:', privyToken.substring(0, 50) + '...');
      console.log('🔗 Calling backend sync...');

      // Call our backend to sync user and wallets with retry logic
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';
      
      let response;
      let retryCount = 0;
      const maxRetries = 2; // Reduced retries since backend now handles retries
      
      while (retryCount <= maxRetries) {
        try {
          // Get a fresh token for each retry
          const freshToken = retryCount > 0 ? await getAccessToken() : privyToken;
          
          if (!freshToken) {
            throw new Error('No fresh token available');
          }
          
          console.log(`🔄 Attempt ${retryCount + 1}: Using token: ${freshToken.substring(0, 20)}...`);
          
          response = await axios.post(
            `${backendUrl}/api/v1/auth/privy/sync`,
            { privyToken: freshToken },
            { 
              headers: { 'Content-Type': 'application/json' },
              timeout: 30000 // 30 second timeout
            }
          );
          
          // If we get here, the request succeeded
          break;
        } catch (error: any) {
          console.log(`❌ Attempt ${retryCount + 1} failed:`, error.message);
          
          if (retryCount === maxRetries) {
            throw error; // Re-throw the last error
          }
          
          // Wait a bit before retrying (longer delay since backend handles main retries)
          await new Promise(resolve => setTimeout(resolve, 2000));
          retryCount++;
        }
      }

      if (!response) {
        throw new Error('No response received from backend');
      }

      console.log('✅ Backend sync successful:', response.data);

      // Unwrap response from TransformInterceptor: { data: {...}, statusCode, timestamp }
      const responseData = response.data.data || response.data;
      
      if (!responseData || !responseData.user) {
        throw new Error('Invalid response structure from backend');
      }

      const userData = responseData.user;
      const token = responseData.token;
      const wallets = responseData.wallets || [];

      // Store our JWT token and user info
      if (token) {
        localStorage.setItem('cto_auth_token', token);
      }
      
      // Handle email - may be undefined for Google sign-in users
      const userEmail = userData.email || userData.walletAddress || 'User';
      if (userData.email) {
        localStorage.setItem('cto_user_email', userData.email);
      } else if (userData.walletAddress) {
        // Fallback: use wallet address if no email
        localStorage.setItem('cto_user_email', `${userData.walletAddress}@wallet.privy`);
      }
      
      if (userData.id) {
        localStorage.setItem('cto_user_id', userData.id.toString());
      }
      
      if (userData.walletAddress) {
        localStorage.setItem('cto_wallet_address', userData.walletAddress);
      }
      
      // Store avatarUrl if available (from database) - transform to CloudFront URL
      if (userData.avatarUrl) {
        const cloudfrontUrl = getCloudFrontUrl(userData.avatarUrl);
        console.log('✅ Storing avatarUrl from backend sync (CloudFront):', cloudfrontUrl);
        localStorage.setItem('cto_user_avatar_url', cloudfrontUrl);
        localStorage.setItem('profile_avatar_url', cloudfrontUrl);
      } else {
        console.log('⚠️ No avatarUrl in sync response');
      }

      // Store ALL wallets (including Aptos) for profile display
      if (wallets && wallets.length > 0) {
        localStorage.setItem('cto_user_wallets', JSON.stringify(wallets));
        console.log('💼 Saved wallets to localStorage:', wallets);
      }

      toast.success(`✅ Welcome, ${userEmail}!`);
      
      // Return sync result for wallet checking logic
      if (skipNavigation) {
        setIsSyncing(false);
        return responseData;
      }
      
      // Force close Privy modal and navigate immediately
      // Use setTimeout to ensure navigation happens even if Privy is still processing
      setTimeout(() => {
        navigate(ROUTES.profile);
        // Force reload if navigation doesn't work (fallback)
        setTimeout(() => {
          if (window.location.pathname.includes('/login')) {
            window.location.href = ROUTES.profile;
          }
        }, 500);
      }, 100);

      return response.data;

    } catch (error: any) {
      console.error('❌ Backend sync failed:', error);
      toast.error(`Sync failed: ${error.response?.data?.message || error.message}`);
      setIsSyncing(false);
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
