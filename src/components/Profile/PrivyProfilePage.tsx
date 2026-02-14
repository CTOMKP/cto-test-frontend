import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ROUTES } from '../../utils/constants';
import { MovementWalletActivity, MovementWalletRecentActivity } from '../UserListings/MovementWalletActivity';
import userListingsService from '../../services/userListingsService';
import marketplaceService from '../../services/marketplaceService';
import { getCloudFrontUrl } from '../../utils/image-url-helper';

export const PrivyProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, authenticated, ready, getAccessToken } = usePrivy();
  const [movementWallet, setMovementWallet] = useState<string | null>(null);
  const [isCreatingMovement, setIsCreatingMovement] = useState(false);
  const [isSyncingWallets, setIsSyncingWallets] = useState(false);
  const [allWallets, setAllWallets] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'listings' | 'ads' | 'tx'>('listings');
  const [myListings, setMyListings] = useState<any[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState<string | null>(null);
  const [myAds, setMyAds] = useState<any[]>([]);
  const [adsLoading, setAdsLoading] = useState(false);
  const [adsError, setAdsError] = useState<string | null>(null);
  const [activityState, setActivityState] = useState({
    transactions: [] as any[],
    loading: true,
    syncing: false,
  });
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    // Check both localStorage keys (pfpService saves to cto_user_avatar_url)
    return localStorage.getItem('cto_user_avatar_url') || 
           localStorage.getItem('profile_avatar_url') || 
           '';
  });

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';

  // Get Movement wallet on mount
  useEffect(() => {
    if (authenticated && user) {
      checkMovementWallet();
      loadBackendWallets();
      loadAvatarFromBackend();
      loadMyListings();
      loadMyAds();
    }
  }, [authenticated, user]);

  // Load avatar from backend
  const loadAvatarFromBackend = async () => {
    try {
      const token = localStorage.getItem('cto_auth_token');
      
      if (!token) return;

      // Try to get user profile from backend
      const response = await axios.get(
        `${backendUrl}/api/v1/auth/profile`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
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

  // Listen for localStorage changes (when PFP is auto-saved)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cto_user_avatar_url' && e.newValue) {
        setAvatarUrl(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Also check localStorage periodically (for same-tab updates)
    const checkAvatar = () => {
      const storedAvatar = localStorage.getItem('cto_user_avatar_url') || 
                          localStorage.getItem('profile_avatar_url');
      if (storedAvatar && storedAvatar !== avatarUrl) {
        setAvatarUrl(storedAvatar);
      }
    };
    
    const interval = setInterval(checkAvatar, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [avatarUrl]);

  const loadBackendWallets = async () => {
    // First, try to load from localStorage (faster and more reliable)
    const walletsJson = localStorage.getItem('cto_user_wallets');
    if (walletsJson) {
      try {
        const wallets = JSON.parse(walletsJson);
        console.log('💼 Loading wallets from localStorage:', wallets);
        setAllWallets(wallets);
        
        // Check if Movement wallet exists (Movement wallets are detected as 'aptos' chainType or 'MOVEMENT' blockchain)
        const movementWallet = wallets.find((w: any) => 
          w.blockchain === 'MOVEMENT' || 
          w.blockchain === 'APTOS' || 
          w.chainType === 'aptos' || 
          w.walletClient === 'APTOS_EMBEDDED'
        );
        if (movementWallet) {
          setMovementWallet(movementWallet.address);
        }
        
        // If we have wallets in localStorage, we're done
        if (wallets.length > 0) {
          console.log('✅ Loaded wallets from localStorage successfully');
          return;
        }
      } catch (parseError) {
        console.error('Failed to parse wallets from localStorage:', parseError);
      }
    }
    
    // Fallback: Try to fetch from backend if localStorage is empty or invalid
    try {
      const userId = localStorage.getItem('cto_user_id');
      const token = localStorage.getItem('cto_auth_token');
      
      if (!userId || !token) {
        console.warn('No user ID or token found');
        return;
      }

      console.log('🔄 Fetching wallets from backend...');
      const response = await axios.get(
        `${backendUrl}/api/v1/auth/privy/wallets`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success && response.data.wallets) {
        const wallets = response.data.wallets;
        console.log('💼 Loaded wallets from backend:', wallets);
        setAllWallets(wallets);
        
        // Check if Movement wallet exists (Movement wallets are detected as 'aptos' chainType or 'MOVEMENT' blockchain)
        const movementWallet = wallets.find((w: any) => 
          w.blockchain === 'MOVEMENT' || 
          w.blockchain === 'APTOS' || 
          w.chainType === 'aptos' || 
          w.walletClient === 'APTOS_EMBEDDED'
        );
        if (movementWallet) {
          setMovementWallet(movementWallet.address);
        }
        
        // Update localStorage with fresh data
        localStorage.setItem('cto_user_wallets', JSON.stringify(wallets));
      }
    } catch (error) {
      console.error('Failed to load wallets from backend:', error);
    }
  };

  // Add safety check - if user ID doesn't exist, clear localStorage
  useEffect(() => {
    const userId = localStorage.getItem('cto_user_id');
    if (authenticated && !userId) {
      console.warn('No user ID in localStorage, clearing cache...');
      localStorage.clear();
      toast.error('Session expired. Please login again.');
      navigate(ROUTES.login);
    }
  }, [authenticated]);

  const checkMovementWallet = () => {
    // Check if user has Movement wallet in their linked accounts (Movement wallets are detected as 'aptos' chainType)
    const movementWalletAccount = user?.linkedAccounts?.find(
      (account: any) => account.type === 'wallet' && account.chainType === 'aptos'
    );
    
    if (movementWalletAccount) {
      setMovementWallet((movementWalletAccount as any).address);
    }
  };

  const handleCreateMovementWallet = async () => {
    setIsCreatingMovement(true);
    try {
      if (!authenticated) {
        toast.error('Not authenticated. Please login again.');
        navigate(ROUTES.login);
        return;
      }

      const userId = localStorage.getItem('cto_user_id');
      if (!userId) {
        toast.error('User ID not found. Please login again.');
        return;
      }

      console.log('Creating Movement wallet for user ID:', userId);
      
      // Note: Movement wallets are created automatically via Privy's createWallet with chainType 'aptos'
      // This happens during login, so we just inform the user
      toast('Movement wallets are created automatically via Privy. Please use the login flow.', {
        icon: 'ℹ️',
        duration: 4000,
      });
    } catch (error: any) {
      console.error('Failed to create Movement wallet:', error);
      toast.error(`Failed to create Movement wallet: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsCreatingMovement(false);
    }
  };

  const handleSyncWallets = async () => {
    setIsSyncingWallets(true);
    try {
      const token = localStorage.getItem('cto_auth_token');
      if (!token) {
        toast.error('Not authenticated. Please login again.');
        return;
      }

      console.log('🔄 Syncing wallets from Privy...');
      
      const response = await axios.post(
        `${backendUrl}/api/v1/auth/privy/sync-wallets`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      console.log('Wallet sync response:', response.data);

      if (response.data.success) {
        toast.success(`✅ Synced ${response.data.syncedCount} wallets successfully!`);
        // Refresh wallets from backend
        await loadBackendWallets();
      } else {
        toast.error(response.data.message || 'Failed to sync wallets');
      }
    } catch (error: any) {
      console.error('Failed to sync wallets:', error);
      toast.error(`Failed to sync wallets: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsSyncingWallets(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    localStorage.clear();
    toast.success('Logged out successfully');
    navigate(ROUTES.login);
  };

  const loadMyListings = async () => {
    try {
      setListingsLoading(true);
      setListingsError(null);
      const res = await userListingsService.mine();
      setMyListings(res?.items || []);
    } catch (error: any) {
      setListingsError(error?.response?.data?.message || error?.message || 'Failed to load listings');
    } finally {
      setListingsLoading(false);
    }
  };

  const loadMyAds = async () => {
    try {
      setAdsLoading(true);
      setAdsError(null);
      const res = await marketplaceService.listMine();
      const items = res?.data || res || [];
      setMyAds(Array.isArray(items) ? items : []);
    } catch (error: any) {
      setAdsError(error?.response?.data?.message || error?.message || 'Failed to load ads');
    } finally {
      setAdsLoading(false);
    }
  };

  const formatCompactNumber = (value?: number | null) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
    const num = Number(value);
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
    return num.toFixed(2);
  };

  const formatPrice = (value?: number | null) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
    return `$${Number(value).toFixed(6)}`;
  };

  const formatUsdCompact = (value?: number | null) => {
    const compact = formatCompactNumber(value);
    return compact === '--' ? '--' : `$${compact}`;
  };

  const toCloudFrontUrl = (url?: string | null) => {
    if (!url || typeof url !== 'string') return undefined;
    if (url.includes('cloudfront.net')) return url;
    if (url.includes('/api/v1/images/view/')) {
      const match = url.match(/\/api\/v1\/images\/view\/(.+)$/);
      if (match) {
        const imagePath = match[1].split('?')[0];
        return getCloudFrontUrl(imagePath);
      }
    }
    if (url.includes('user-uploads/')) return getCloudFrontUrl(url);
    return url;
  };

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  // Combine Privy wallets with backend wallets and de-duplicate by address
  const privyWallets = user?.linkedAccounts?.filter((account: any) => account.type === 'wallet') || [];
  
  // Create a map to de-duplicate wallets by address (case-insensitive)
  const walletMap = new Map();
  
  // Add privy wallets first (they are usually the source of truth for the frontend)
  privyWallets.forEach((w: any) => {
    if (w.address) {
      walletMap.set(w.address.toLowerCase(), {
        ...w,
        source: 'privy'
      });
    }
  });
  
  // Add backend wallets, but don't overwrite privy ones (to keep primary status/labels)
  allWallets.forEach((w: any) => {
    if (w.address && !walletMap.has(w.address.toLowerCase())) {
      walletMap.set(w.address.toLowerCase(), {
        ...w,
        source: 'backend'
      });
    }
  });
  
  const displayWallets = Array.from(walletMap.values());
  const email = user?.email?.address || user?.wallet?.address || 'Privy User';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-between items-start">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="Profile Avatar" 
                    className="w-24 h-24 rounded-full object-cover border-4 border-purple-500 shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center border-4 border-purple-500 shadow-lg">
                    <span className="text-4xl">👤</span>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  🎉 Welcome to CTO Marketplace!
                </h1>
                <p className="text-gray-600">{email}</p>
                <p className="text-sm text-gray-400 mt-1">Privy ID: {user?.id}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* PROFESSIONAL ADDITION: Movement Wallet Dashboard */}
        <MovementWalletActivity onActivityUpdate={setActivityState} />

        {/* Profile Tabs */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 mb-4">
            <button
              type="button"
              onClick={() => setActiveTab('listings')}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                activeTab === 'listings' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              My Listings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ads')}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                activeTab === 'ads' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              My Ads
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tx')}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                activeTab === 'tx' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Tx History
            </button>
          </div>

          {activeTab === 'listings' && (
            <div className="overflow-x-auto">
              {listingsError && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3 mb-4 text-sm">
                  {listingsError}
                </div>
              )}
              {listingsLoading ? (
                <div className="text-sm text-gray-500">Loading listings...</div>
              ) : myListings.length === 0 ? (
                <div className="text-sm text-gray-500">No listings yet.</div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-3 pr-4">Name</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">MC/Liq</th>
                      <th className="py-3 pr-4">Holders</th>
                      <th className="py-3 pr-4">Age</th>
                      <th className="py-3 pr-4">Price/24h</th>
                      <th className="py-3 pr-4">Community score</th>
                      <th className="py-3">Risk score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myListings.map((listing) => {
                      const scan = listing.scanMetadata || {};
                      const logo = toCloudFrontUrl(listing.logoUrl);
                      const statusBadge =
                        listing.status === 'PUBLISHED'
                          ? 'bg-green-100 text-green-800'
                          : listing.status === 'PENDING_APPROVAL'
                          ? 'bg-yellow-100 text-yellow-800'
                          : listing.status === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800';
                      return (
                        <tr key={listing.id} className="border-b hover:bg-gray-50">
                          <td className="py-4 pr-4">
                            <Link to={`/user-listings/${listing.id}`} className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                                {logo ? (
                                  <img src={logo} alt={listing.title} className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-xs text-gray-400">N/A</span>
                                )}
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{listing.title}</div>
                                <div className="text-xs text-gray-500">{listing.chain}</div>
                              </div>
                            </Link>
                          </td>
                          <td className="py-4 pr-4">
                            <span className={`text-xs px-2 py-1 rounded ${statusBadge}`}>
                              {listing.status}
                            </span>
                          </td>
                          <td className="py-4 pr-4 text-gray-900 whitespace-nowrap">
                            {formatUsdCompact(scan.market_cap)} / {formatUsdCompact(scan.lp_amount_usd)}
                          </td>
                          <td className="py-4 pr-4">{scan.holder_count ?? '--'}</td>
                          <td className="py-4 pr-4">{scan.age_display_short || '--'}</td>
                          <td className="py-4 pr-4 text-gray-900 whitespace-nowrap">
                            {formatPrice(scan.token_price)} / {formatUsdCompact(scan.volume_24h)}
                          </td>
                          <td className="py-4 pr-4">{scan.community_score ?? '--'}</td>
                          <td className="py-4">
                            <span className="font-semibold text-gray-900">
                              {listing.vettingScore ?? listing.scanRiskScore ?? '--'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'ads' && (
            <div className="overflow-x-auto">
              {adsError && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3 mb-4 text-sm">
                  {adsError}
                </div>
              )}
              {adsLoading ? (
                <div className="text-sm text-gray-500">Loading ads...</div>
              ) : myAds.length === 0 ? (
                <div className="text-sm text-gray-500">No ads yet.</div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="py-3 pr-4">Title</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Category</th>
                      <th className="py-3 pr-4">Tier</th>
                      <th className="py-3 pr-4">Created</th>
                      <th className="py-3">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myAds.map((ad: any) => {
                      const statusBadge =
                        ad.status === 'PUBLISHED'
                          ? 'bg-green-100 text-green-800'
                          : ad.status === 'PENDING_APPROVAL'
                          ? 'bg-yellow-100 text-yellow-800'
                          : ad.status === 'REJECTED'
                          ? 'bg-red-100 text-red-800'
                          : ad.status === 'EXPIRED'
                          ? 'bg-gray-200 text-gray-700'
                          : 'bg-gray-100 text-gray-800';
                      return (
                        <tr key={ad.id} className="border-b hover:bg-gray-50">
                          <td className="py-4 pr-4">
                            <div className="font-semibold text-gray-900">{ad.title}</div>
                            <div className="text-xs text-gray-500">{ad.subCategory || ad.category}</div>
                          </td>
                          <td className="py-4 pr-4">
                            <span className={`text-xs px-2 py-1 rounded ${statusBadge}`}>
                              {ad.status}
                            </span>
                          </td>
                          <td className="py-4 pr-4">{ad.category}</td>
                          <td className="py-4 pr-4">{ad.tier}</td>
                          <td className="py-4 pr-4">
                            {ad.createdAt ? new Date(ad.createdAt).toLocaleDateString() : '--'}
                          </td>
                          <td className="py-4">
                            {ad.expiresAt ? new Date(ad.expiresAt).toLocaleDateString() : '--'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'tx' && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <MovementWalletRecentActivity
                transactions={activityState.transactions}
                loading={activityState.loading}
                syncing={activityState.syncing}
              />
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">🚀 Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={() => navigate(ROUTES.home)}
              className="bg-blue-500 text-white px-4 py-3 rounded-lg hover:bg-blue-600 transition-colors font-semibold text-sm"
            >
              🏠 Listings
            </button>
            <button
              onClick={() => navigate(ROUTES.createUserListing)}
              className="bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600 transition-colors font-semibold text-sm"
            >
              ➕ Create Listing
            </button>
            <button
              onClick={() => navigate(ROUTES.myUserListings)}
              className="bg-indigo-500 text-white px-4 py-3 rounded-lg hover:bg-indigo-600 transition-colors font-semibold text-sm"
            >
              📝 My Listings
            </button>
            <button
              onClick={() => navigate('/market')}
              className="bg-purple-500 text-white px-4 py-3 rounded-lg hover:bg-purple-600 transition-colors font-semibold text-sm"
            >
              📊 Market
            </button>
            <button
              onClick={() => navigate('/bridge')}
              className="bg-cyan-500 text-white px-4 py-3 rounded-lg hover:bg-cyan-600 transition-colors font-semibold text-sm"
            >
              🌉 Bridge
            </button>
            <button
              onClick={() => navigate('/swap')}
              className="bg-orange-500 text-white px-4 py-3 rounded-lg hover:bg-orange-600 transition-colors font-semibold text-sm"
            >
              🔄 Swap
            </button>
            <button
              onClick={() => navigate('/pfp')}
              className="bg-pink-500 text-white px-4 py-3 rounded-lg hover:bg-pink-600 transition-colors font-semibold text-sm"
            >
              🎴 Get PFP
            </button>
          </div>
        </div>

        {/* Wallets Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">💼 Your Wallets</h2>
          
          {displayWallets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No wallets found</p>
              <p className="text-sm text-gray-400">Wallets should be created automatically on login</p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayWallets.map((wallet: any, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:border-purple-500 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">
                          {(wallet.chainType === 'ethereum' || wallet.blockchain === 'ETHEREUM') && '⟠'}
                          {(wallet.chainType === 'solana' || wallet.blockchain === 'SOLANA') && '◎'}
                          {(wallet.chainType === 'base' || wallet.blockchain === 'BASE') && '🔵'}
                          {(wallet.chainType === 'polygon' || wallet.blockchain === 'POLYGON') && '🟣'}
                          {(wallet.chainType === 'aptos' || wallet.blockchain === 'APTOS' || wallet.blockchain === 'MOVEMENT') && '🅰️'}
                        </span>
                        <span className="font-semibold text-gray-900 capitalize">
                          {wallet.blockchain === 'MOVEMENT' || wallet.chainType === 'aptos'
                            ? 'Movement Wallet' 
                            : (wallet.chainType || wallet.blockchain || 'Unknown').toLowerCase() + ' Wallet'}
                        </span>
                        {(index === 0 || wallet.isPrimary) && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                            Primary
                          </span>
                        )}
                        {wallet.walletClient && (
                          <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                            wallet.walletClient === 'metamask' 
                              ? 'bg-orange-100 text-orange-800' 
                              : wallet.walletClient === 'privy'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {wallet.walletClient === 'metamask' ? '🦊 MetaMask' : 
                             wallet.walletClient === 'privy' ? '🔐 Privy Embedded' :
                             wallet.walletClient}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-sm text-gray-600 break-all">
                        {wallet.address}
                      </div>
                      {wallet.walletClient === 'privy' && (
                        <p className="text-xs text-gray-400 mt-1">🔐 Privy Embedded Wallet (Managed by Privy)</p>
                      )}
                      {wallet.walletClient === 'metamask' && (
                        <p className="text-xs text-gray-400 mt-1">🦊 MetaMask Wallet (You control the keys)</p>
                      )}
                      {!wallet.walletClient && (
                        <p className="text-xs text-gray-400 mt-1">Embedded Wallet (Managed by Privy)</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(wallet.address);
                        toast.success('Address copied!');
                      }}
                      className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm ml-4"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Movement Wallet Info - Only show if no Movement wallet in main list */}
          {!displayWallets.some(w => 
            w.chainType === 'aptos' || 
            w.blockchain === 'APTOS' || 
            w.blockchain === 'MOVEMENT' || 
            w.walletClient === 'APTOS_EMBEDDED'
          ) && (
            <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                <span className="text-2xl">🅰️</span>
                <span>Movement Wallet Status</span>
              </h3>
              {movementWallet ? (
                <div>
                  <p className="text-sm text-green-700 mb-2">
                    ✅ Your Movement wallet is ready for hackathon payments!
                  </p>
                  <p className="text-xs text-green-600 font-mono break-all bg-white p-2 rounded">
                    {movementWallet}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-purple-700 mb-3">
                    Movement wallet will be created automatically on your next login, or click below to create one now.
                  </p>
                  <button
                    onClick={handleCreateMovementWallet}
                    disabled={isCreatingMovement}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                  >
                    {isCreatingMovement ? '⏳ Creating...' : '🅰️ Create Movement Wallet Now'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 rounded-2xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2">💡 About Your Wallets</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>✅ All wallets are managed securely by Privy</li>
            <li>✅ Embedded wallets work across all devices</li>
            <li>✅ You can also connect external wallets (MetaMask, Phantom, etc.)</li>
            <li>✅ Private keys are never stored on our servers</li>
            <li>✅ Multi-chain support: Ethereum, Solana, Base, Polygon, Movement</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

