import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCircleWallet } from '../../hooks/useCircleWallet';
import { BalanceSection } from './BalanceSection';
import { WalletInfo } from './WalletInfo';
import { QRCodeDisplay } from '../Wallet/QRCodeDisplay';
import { TopUpSection } from './TopUpSection';
import { WithdrawSection } from './WithdrawSection';
import { ActivitiesSection } from './ActivitiesSection';
import { formatAddress } from '../../utils/helpers';
import { authService } from '../../services/authService';
import { circleWalletService } from '../../services/circleWallet';
import toast from 'react-hot-toast';
import axios from 'axios';
import FundingModal from '../Funding/FundingModal';
import { HarvestGrape } from '../PFP/HarvestGrape';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, isLoading: authLoading, isAuthenticated } = useAuth();
  const { 
    wallet, 
    balances, 
    isLoading: walletLoading, 
    refreshBalances,
    error: walletError,
    clearError
  } = useCircleWallet(user?.id);

  const [showQRModal, setShowQRModal] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showFundingModal, setShowFundingModal] = useState(false);

  // Profile images - check both localStorage keys and backend
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    // Check both localStorage keys (pfpService saves to cto_user_avatar_url)
    return localStorage.getItem('cto_user_avatar_url') || 
           localStorage.getItem('profile_avatar_url') || 
           '';
  });
  const [profileBannerUrl, setProfileBannerUrl] = useState<string>(() => localStorage.getItem('profile_banner_url') || '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileBannerUploading, setProfileBannerUploading] = useState(false);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';
  const authHeaders = () => {
    const token = localStorage.getItem('cto_auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Presigned upload flow: request presign from backend, PUT directly to storage, then use /api/images/view/* for reads
  const uploadProfileImage = async (
    kind: 'profile' | 'banner',
    file: File
  ): Promise<{ viewUrl: string; key: string; metadata: any }> => {
    if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed');
    if (file.size > 10 * 1024 * 1024) throw new Error('Image must be 10MB or less');

    // 1) Ask backend for presigned upload URL
    const presignRes = await axios.post(
      `${backendUrl}/api/v1/images/presign`,
      {
        type: kind,
        userId: user?.id,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      },
      { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
    );

    const { uploadUrl, key, metadata } = presignRes.data || {};
    if (!uploadUrl || !key) throw new Error('Failed to get presigned upload URL');

    // 2) Upload directly to storage (S3) via presigned PUT
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!putRes.ok) {
      throw new Error(`Upload failed with status ${putRes.status}`);
    }

    // 3) Always use server redirect endpoint for stable reads (avoid exposing presigned GETs)
    const viewUrl = `${backendUrl}/api/v1/images/view/${key}`;
    return { viewUrl, key, metadata };
  };

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAvatarUploading(true);
      const { viewUrl, key, metadata } = await uploadProfileImage('profile', file);
      setAvatarUrl(viewUrl);
      // store metadata for debugging/consistency
      localStorage.setItem('profile_avatar_meta', JSON.stringify({ key, metadata }));
      toast.success('Avatar uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const onProfileBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setProfileBannerUploading(true);
      const { viewUrl, key, metadata } = await uploadProfileImage('banner', file);
      setProfileBannerUrl(viewUrl);
      // store metadata for debugging/consistency
      localStorage.setItem('profile_banner_meta', JSON.stringify({ key, metadata }));
      toast.success('Banner uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload banner');
    } finally {
      setProfileBannerUploading(false);
      e.target.value = '';
    }
  };

  // Load avatarUrl from backend if not in localStorage
  useEffect(() => {
    const loadAvatarFromBackend = async () => {
      // Only fetch from backend if we don't have it in localStorage
      const storedAvatar = localStorage.getItem('cto_user_avatar_url') || 
                          localStorage.getItem('profile_avatar_url');
      if (storedAvatar) {
        return; // Already have it, no need to fetch
      }

      if (!user?.id || !isAuthenticated) {
        return; // Can't fetch without user
      }

      try {
        const token = localStorage.getItem('cto_auth_token');
        if (!token) return;

        const response = await axios.get(
          `${backendUrl}/api/v1/auth/profile`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.data?.avatarUrl) {
          setAvatarUrl(response.data.avatarUrl);
          localStorage.setItem('cto_user_avatar_url', response.data.avatarUrl);
          localStorage.setItem('profile_avatar_url', response.data.avatarUrl);
        }
      } catch (error) {
        console.error('Failed to load avatar from backend:', error);
      }
    };

    if (isAuthenticated && user?.id) {
      loadAvatarFromBackend();
    }
  }, [isAuthenticated, user?.id, backendUrl]);

  // Persist to localStorage for temporary durability (until backend profile update exists)
  useEffect(() => {
    if (avatarUrl) {
      localStorage.setItem('profile_avatar_url', avatarUrl);
      localStorage.setItem('cto_user_avatar_url', avatarUrl);
    }
    if (profileBannerUrl) localStorage.setItem('profile_banner_url', profileBannerUrl);
  }, [avatarUrl, profileBannerUrl]);

  // Listen for localStorage changes (when PFP is auto-saved)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cto_user_avatar_url' && e.newValue) {
        setAvatarUrl(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Also check localStorage on mount/update (for same-tab updates)
    const checkAvatar = () => {
      const storedAvatar = localStorage.getItem('cto_user_avatar_url') || 
                          localStorage.getItem('profile_avatar_url');
      if (storedAvatar && storedAvatar !== avatarUrl) {
        setAvatarUrl(storedAvatar);
      }
    };
    
    // Check periodically (in case PFP was saved in same tab)
    const interval = setInterval(checkAvatar, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [avatarUrl]);

  // Debug logging
  useEffect(() => {
    console.log('🔄 ProfilePage mounted');
    console.log('🔄 User:', user);
    console.log('🔄 Is Authenticated:', isAuthenticated);
    console.log('🔄 Wallet:', wallet);
    console.log('🔄 Balances:', balances);
    console.log('🔄 Wallet Error:', walletError);
    console.log('🔄 Auth Loading:', authLoading);
    console.log('🔄 Wallet Loading:', walletLoading);
  }, [user, isAuthenticated, wallet, balances, walletError, authLoading, walletLoading]);



  // Check if user is actually authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log('🔄 User not authenticated, redirecting to login');
      // Force redirect to login if not authenticated
      window.location.href = '/login';
    }
  }, [authLoading, isAuthenticated]);

  const handleRefreshBalances = async () => {
    try {
      await refreshBalances();
      toast.success('Balances refreshed!');
    } catch (error) {
      console.error('Failed to refresh balances:', error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cto-purple mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cto-purple mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const hasCircleAppId = !!process.env.REACT_APP_CIRCLE_APP_ID;
  const hasCircleApiKey = !!process.env.REACT_APP_CIRCLE_API_KEY;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Service Mode Indicator */}
      <div className="bg-gradient-to-r from-cto-purple to-primary-600 text-white py-2 px-4 text-center text-sm">
        <div className="flex items-center justify-center space-x-4">
          <span>🆔 Circle App ID: {hasCircleAppId ? '✅' : '❌'}</span>
          <span>🔑 Circle API Key: {hasCircleApiKey ? '✅' : '❌'}</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
              <p className="text-gray-600">Welcome back, {user.email}</p>
            </div>
            <div className="flex space-x-3">
              <a href="/" className="btn-secondary">Back to Listings</a>
              <button
                onClick={() => navigate('/bridge')}
                className="btn-secondary bg-green-600 hover:bg-green-700 text-white"
              >
                🌉 Cross-Chain Bridge
              </button>
              <button
                onClick={() => navigate('/swap')}
                className="btn-secondary bg-blue-600 hover:bg-blue-700 text-white"
              >
                🔄 Token Swap
              </button>
              <button
                onClick={() => navigate('/pfp')}
                className="btn-secondary bg-purple-600 hover:bg-purple-700 text-white"
              >
                🎨 My PFP
              </button>
              <button
                onClick={() => navigate('/market')}
                className="btn-secondary bg-orange-600 hover:bg-orange-700 text-white"
              >
                📊 Market Dashboard
              </button>
              <button
                onClick={() => setShowFundingModal(true)}
                className="btn-secondary bg-green-600 hover:bg-green-700 text-white"
              >
                💰 Fund Wallet
              </button>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="btn-secondary"
              >
                {showDebug ? 'Hide Debug' : 'Show Debug'}
              </button>
              <button
                onClick={() => setShowQRModal(true)}
                className="btn-secondary"
              >
                Show QR Code
              </button>
              <button
                onClick={handleRefreshBalances}
                disabled={walletLoading}
                className="btn-secondary"
              >
                {walletLoading ? 'Refreshing...' : 'Refresh Balances'}
              </button>
              <button
                onClick={logout}
                className="btn-primary"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Profile Images Uploader */}
          <div className="py-4">
            <div className="bg-white border rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm mb-1" htmlFor="profile-avatar-upload">Avatar</label>
                <div className="flex items-center gap-3">
                  <input
                    id="profile-avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={onAvatarChange}
                    disabled={avatarUploading}
                    aria-label="Upload avatar image"
                  />
                  {avatarUploading && <span className="text-xs text-gray-500">Uploading...</span>}
                  <div className="relative inline-block" style={{ zIndex: 10 }}>
                    <HarvestGrape />
                  </div>
                  <button
                    onClick={() => {
                      console.log('Test button clicked - HarvestGrape should work too');
                      alert('If you see this, buttons work. Check HarvestGrape button.');
                    }}
                    className="ml-2 px-3 py-1 bg-blue-500 text-white rounded text-sm"
                  >
                    Test
                  </button>
                </div>
                {avatarUrl && (
                  <div className="mt-3 flex items-center gap-3">
                    <img src={avatarUrl} alt="Avatar preview" className="w-16 h-16 rounded-full object-cover border" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm mb-1" htmlFor="profile-banner-upload">Banner (3:1)</label>
                <div className="flex items-center gap-3">
                  <input
                    id="profile-banner-upload"
                    type="file"
                    accept="image/*"
                    onChange={onProfileBannerChange}
                    disabled={profileBannerUploading}
                    aria-label="Upload profile banner image (3:1 ratio)"
                  />
                  {profileBannerUploading && <span className="text-xs text-gray-500">Uploading...</span>}
                </div>
                {profileBannerUrl && (
                  <div className="mt-3">
                    <img src={profileBannerUrl} alt="Banner preview" className="w-full max-w-lg h-28 object-cover rounded border" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Information */}
      {showDebug && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Debug Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-yellow-700">User Data:</h4>
                <pre className="bg-white p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(user, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="font-medium text-yellow-700">Wallet Data:</h4>
                <pre className="bg-white p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(wallet, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="font-medium text-yellow-700">Balances:</h4>
                <pre className="bg-white p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(balances, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="font-medium text-yellow-700">Errors:</h4>
                <pre className="bg-white p-2 rounded text-xs overflow-auto">
                  {JSON.stringify({ walletError, authLoading, walletLoading }, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Wallet Info & QR Code */}
          <div className="lg:col-span-1 space-y-6">
            <WalletInfo wallet={wallet} onShowQR={() => setShowQRModal(true)} />
            
            {/* QR Code Button */}
            {wallet && (
              <div className="bg-white rounded-lg shadow p-6">
                <button
                  onClick={() => setShowQRModal(true)}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
                >
                  Show QR Code
                </button>
              </div>
            )}
          </div>

          {/* Right Column - Balances & Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Balance Section */}
            <BalanceSection 
              balances={balances} 
              isLoading={walletLoading}
              onRefresh={handleRefreshBalances}
              walletError={walletError}
              clearError={clearError}
            />

            {/* Top Up Section */}
            {wallet && <TopUpSection wallet={wallet} />}

            {/* Withdraw Section */}
            {wallet && <WithdrawSection wallet={wallet} balances={balances} />}

            {/* Activities Section */}
            {wallet && <ActivitiesSection wallet={wallet} />}
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && wallet && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Fund Your Wallet
                </h3>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Close modal"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <QRCodeDisplay
                data={{ address: wallet.address }}
                title="Your Wallet Address"
                description="Scan this QR code or copy the address to send funds to your wallet"
              />
            </div>
          </div>
        </div>
      )}
      
      {showFundingModal && (
        <FundingModal
          isOpen={showFundingModal}
          onClose={() => setShowFundingModal(false)}
          userId={user?.email || ''}
        />
      )}
    </div>
  );
};
