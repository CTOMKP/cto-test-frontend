import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { useCreateWallet } from '@privy-io/react-auth/extended-chains';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ROUTES } from '../../utils/constants';
import { createMovementWallet, getMovementWallet } from '../../lib/movement-wallet';

export const PrivyLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, authenticated, user, ready, getAccessToken, logout } = usePrivy();
  const { createWallet } = useCreateWallet();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreatingMovementWallet, setIsCreatingMovementWallet] = useState(false);

  // Sync with backend after Privy authentication and Movement wallet creation
  useEffect(() => {
    if (authenticated && user && !isSyncing && !isCreatingMovementWallet) {
      handleMovementWalletAndSync();
    }
  }, [authenticated, user]);

  // Wait for Privy to fully load linkedAccounts (with retries)
  const waitForPrivyAccounts = async (maxRetries = 5, delayMs = 500): Promise<boolean> => {
    for (let i = 0; i < maxRetries; i++) {
      // Check if linkedAccounts is loaded and has items
      if (user?.linkedAccounts && user.linkedAccounts.length > 0) {
        console.log(`✅ Privy accounts loaded after ${i + 1} attempt(s)`);
        return true;
      }
      
      if (i < maxRetries - 1) {
        console.log(`⏳ Waiting for Privy accounts to load... (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    
    console.warn('⚠️ Privy accounts not fully loaded, proceeding anyway...');
    return false;
  };

  // Handle Movement wallet creation and backend sync
  const handleMovementWalletAndSync = async () => {
    try {
      // Step 1: Wait for Privy to fully load linkedAccounts
      await waitForPrivyAccounts();
      
      // Step 2: First sync with backend to check if user already exists and has wallets
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
        (w: any) => w.chainType === 'movement' || w.blockchain === 'MOVEMENT'
      );

      // Step 4: Check if user has Movement wallet in Privy
      const movementWallet = getMovementWallet(user);
      const privyHasMovementWallet = !!movementWallet;

      console.log('📊 Wallet Status Check:');
      console.log(`  - Backend has Movement wallet: ${backendHasMovementWallet}`);
      console.log(`  - Privy has Movement wallet: ${privyHasMovementWallet}`);

      // Step 5: Only create wallet if BOTH backend and Privy don't have it
      if (!backendHasMovementWallet && !privyHasMovementWallet) {
        setIsCreatingMovementWallet(true);
        console.log('🔄 Creating Movement wallet (new user)...');
        
        try {
          // Create Movement wallet using Privy with shorter timeout
          const walletCreationPromise = createMovementWallet(user, createWallet);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Wallet creation timeout')), 10000)
          );
          
          const newWallet = await Promise.race([walletCreationPromise, timeoutPromise]);
          console.log('✅ Movement wallet created:', newWallet);
          
          // Give Privy a moment to finish internal setup
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Double-check wallet exists
          const verifyWallet = getMovementWallet(user);
          if (verifyWallet) {
            console.log('✅ Wallet verified:', verifyWallet.address);
            toast.success('Movement wallet created successfully!');
          } else {
            console.warn('⚠️ Wallet created but not immediately available, proceeding anyway...');
            toast.success('Wallet creation initiated!');
          }
        } catch (error: any) {
          console.error('❌ Wallet creation error:', error);
          
          // Check if wallet was actually created despite the error/timeout
          const checkWallet = getMovementWallet(user);
          if (checkWallet) {
            console.log('✅ Wallet exists despite error, proceeding...');
            toast.success('Wallet ready!');
          } else {
            console.warn('⚠️ Wallet creation may have timed out, but continuing...');
            toast('Wallet creation in progress, continuing...', { icon: '⏳', duration: 3000 });
          }
        } finally {
          setIsCreatingMovementWallet(false);
        }

        // Re-sync with backend after wallet creation to update backend
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
        console.log('✅ User already has Movement wallet, skipping creation');
        if (movementWallet) {
          console.log(`  - Privy wallet: ${movementWallet.address}`);
        }
        
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
          setTimeout(() => {
            navigate(ROUTES.profile);
          }, 100);
        }
      }
    } catch (error) {
      console.error('❌ Error in Movement wallet setup:', error);
      setIsCreatingMovementWallet(false);
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
            `${backendUrl}/api/auth/privy/sync`,
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

      // Store our JWT token and user info
      localStorage.setItem('cto_auth_token', response.data.token);
      localStorage.setItem('cto_user_email', response.data.user.email);
      localStorage.setItem('cto_user_id', response.data.user.id.toString());
      
      if (response.data.user.walletAddress) {
        localStorage.setItem('cto_wallet_address', response.data.user.walletAddress);
      }
      
      // Store avatarUrl if available (from database)
      if (response.data.user.avatarUrl) {
        console.log('✅ Storing avatarUrl from backend sync:', response.data.user.avatarUrl);
        localStorage.setItem('cto_user_avatar_url', response.data.user.avatarUrl);
        localStorage.setItem('profile_avatar_url', response.data.user.avatarUrl);
      } else {
        console.log('⚠️ No avatarUrl in sync response');
      }

      // Store ALL wallets (including Aptos) for profile display
      if (response.data.wallets && response.data.wallets.length > 0) {
        localStorage.setItem('cto_user_wallets', JSON.stringify(response.data.wallets));
        console.log('💼 Saved wallets to localStorage:', response.data.wallets);
      }

      toast.success(`✅ Welcome, ${response.data.user.email}!`);
      
      // Return sync result for wallet checking logic
      if (skipNavigation) {
        setIsSyncing(false);
        return response.data;
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-2xl font-bold text-gray-900 mb-2">
            {isCreatingMovementWallet ? 'Creating Movement wallet...' : 'Syncing your account...'}
          </p>
          <p className="text-gray-600">
            {isCreatingMovementWallet ? 'Setting up your Movement Network wallet' : 'Setting up your wallets and profile'}
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

