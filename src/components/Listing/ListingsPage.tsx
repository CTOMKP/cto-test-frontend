import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import { ROUTES } from '../../utils/constants';
import { normalizeImageUrl } from '../../utils/helpers';
import FallbackImage from '../FallbackImage';

// Minimal type matching backend list response
interface ListingItem {
  id: string;
  contractAddress: string;
  chain: string;
  category?: string;
  symbol?: string | null;
  name?: string | null;
  priceUsd?: number | null;
  change24h?: number | null;
  change1h?: number | null;
  change5m?: number | null;
  change1m?: number | null;
  liquidityUsd?: number | null;
  marketCap?: number | null;
  volume24h?: number | null;
  holders?: number | null;
  riskScore?: number | null;
  communityScore?: number | null;
  tier?: string | null;
  updatedAt?: string;
  age?: string | null; // Token age from backend (e.g., "14d", "30d", "2h")
  logoUrl?: string | null;
  bannerUrl?: string | null;
  // New filter fields
  lpBurnedPercentage?: number | null;
  top10HoldersPercentage?: number | null;
  mintAuthDisabled?: boolean | null;
  raidingDetected?: boolean | null;
  metadata?: {
    market?: {
      logoUrl?: string | null;
      priceChange?: {
        m5?: number;
        h1?: number;
        h24?: number;
      };
      fdv?: number;
    };
  };
}

interface PaginatedResponse {
  page: number;
  limit: number;
  total: number;
  items: ListingItem[];
}

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';

export const ListingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [userListData, setUserListData] = useState<{ items: any[]; total: number; page: number; limit: number } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  
  // Filter state
  const [filters, setFilters] = useState({
    minLpBurned: 0,
    maxTop10Holders: 100,
    mintAuthDisabled: false,
    noRaiding: false,
  });
  const [showFilters, setShowFilters] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updatedItems, setUpdatedItems] = useState<Set<string>>(new Set());
  const [priceChanges, setPriceChanges] = useState<Map<string, 'up' | 'down'>>(new Map());
  const [volumeChanges, setVolumeChanges] = useState<Map<string, 'up' | 'down'>>(new Map());
  const previousPrices = useRef<Map<string, number>>(new Map());
  const previousVolumes = useRef<Map<string, number>>(new Map());

  const fetchListings = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true); // Show subtle refresh indicator
      }
      setError(null);
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      params.set('page', String(page));
      params.set('limit', String(limit));
      
      // Add filter parameters
      if (filters.minLpBurned > 0) params.set('minLpBurned', String(filters.minLpBurned));
      if (filters.maxTop10Holders < 100) params.set('maxTop10Holders', String(filters.maxTop10Holders));
      if (filters.mintAuthDisabled) params.set('mintAuthDisabled', 'true');
      if (filters.noRaiding) params.set('noRaiding', 'true');
      
      const url = `${backendUrl}/api/v1/listing/listings?${params.toString()}`;
      const res = await axios.get(url);
      // Handle wrapped response from TransformInterceptor: { data: {...}, statusCode, timestamp }
      const responseData = res.data?.data || res.data || {};
      setData({
        page: responseData.page || 1,
        limit: responseData.limit || 20,
        total: responseData.total || 0,
        items: Array.isArray(responseData.items) ? responseData.items : [],
      });

      // fetch public user listings in parallel (simple pagination 1..)
      try {
        const userRes = await axios.get(`${backendUrl}/api/v1/user-listings?page=1&limit=12`);
        // Handle wrapped response from TransformInterceptor
        const userData = userRes.data?.data || userRes.data || {};
        setUserListData({
          page: userData.page || 1,
          limit: userData.limit || 12,
          total: userData.total || 0,
          items: Array.isArray(userData.items) ? userData.items : [],
        });
      } catch (e) {
        // ignore user listings error to not break main feed
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load listings');
    } finally {
      if (showLoading) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  // Initial load
  useEffect(() => {
    fetchListings(true); // Show loading on initial load
  }, [page, limit]);

  // Refetch when filters change
  useEffect(() => {
    fetchListings(true);
  }, [filters]);

  // Separate effect for auto-refresh (like gmgn.ai)
  useEffect(() => {
    // Auto-refresh public listings every 30 seconds (silent updates like gmgn.ai)
    const interval = setInterval(() => {
      fetchListings(false); // Silent update - no loading spinner
    }, 30000);

    return () => clearInterval(interval); // Cleanup on unmount
  }, []); // Empty dependency array - runs once on mount
  
  // Helper function to ensure we have complete data for display
  // This doesn't simulate values but provides consistent fallbacks for missing data
  const ensureCompleteData = (listing: any) => {
    return {
      // Keep existing values if they exist, otherwise use fallbacks
      priceUsd: listing.priceUsd || 0,
      volume24h: listing.volume24h || 0,
      change24h: listing.change24h || 0,
      holders: listing.holders || 0,
      riskScore: listing.riskScore || null,
      communityScore: listing.communityScore || 0,
      tier: listing.tier || '—',
      marketCap: listing.marketCap || 0,
      updatedAt: listing.updatedAt || new Date().toISOString()
    };
  };

  // Setup WebSocket connection for real-time updates
  useEffect(() => {
    // Create socket connection
    const socket = io(`${backendUrl}/ws`, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
    });
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server for real-time updates');
      setLastUpdate(new Date()); // Update connection status
    });
    
    socket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket server');
    });
    
    socket.on('connect_error', (error) => {
      console.error('⚠️ WebSocket connection error:', error);
    });
    
    socket.on('listing.update', (updatedListing: any) => {
      console.log('📊 Received listing update:', updatedListing);
      setLastUpdate(new Date());
      
      // Track price changes for visual feedback
      const contractAddress = updatedListing.contractAddress;
      const newPrice = updatedListing.priceUsd;
      const oldPrice = previousPrices.current.get(contractAddress);
      
      if (oldPrice !== undefined && newPrice !== undefined && oldPrice !== newPrice) {
        const direction = newPrice > oldPrice ? 'up' : 'down';
        setPriceChanges(prev => {
          const newMap = new Map(prev);
          newMap.set(contractAddress, direction);
          return newMap;
        });
        
        // Remove price change indicator after 2 seconds
        setTimeout(() => {
          setPriceChanges(current => {
            const updated = new Map(current);
            updated.delete(contractAddress);
            return updated;
          });
        }, 2000);
      }
      
      // Update previous price
      if (newPrice !== undefined) {
        previousPrices.current.set(contractAddress, newPrice);
      }
      
      // Track volume changes
      const newVolume = updatedListing.volume24h ? parseFloat(updatedListing.volume24h) : undefined;
      const prevVolume = previousVolumes.current.get(contractAddress);
      
      if (prevVolume !== undefined && newVolume !== undefined && prevVolume !== newVolume) {
        const direction: 'up' | 'down' = newVolume > prevVolume ? 'up' : 'down';
        console.log(`📊 Volume ${direction === 'up' ? '📈' : '📉'} for ${updatedListing.symbol}: ${prevVolume} → ${newVolume}`);
        
        setVolumeChanges(current => {
          const newMap = new Map(current);
          newMap.set(contractAddress, direction);
          return newMap;
        });
        
        // Remove volume change indicator after 2 seconds
        setTimeout(() => {
          setVolumeChanges(current => {
            const updated = new Map(current);
            updated.delete(contractAddress);
            return updated;
          });
        }, 2000);
      }
      
      // Update previous volume
      if (newVolume !== undefined) {
        previousVolumes.current.set(contractAddress, newVolume);
      }
      
      // Add to updated items set to highlight
      setUpdatedItems(prev => {
        const newSet = new Set(prev);
        newSet.add(updatedListing.contractAddress);
        // Remove highlight after 3 seconds
        setTimeout(() => {
          setUpdatedItems(current => {
            const updated = new Set(current);
            updated.delete(updatedListing.contractAddress);
            return updated;
          });
        }, 3000);
        return newSet;
      });
      
      setData(prevData => {
        if (!prevData) return prevData;
        
        // Update the item in the current page if it exists
        const updatedItems = prevData.items.map(item => {
          if (item.contractAddress === updatedListing.contractAddress) {
            // Merge existing data with update from WebSocket
            // Ensure all required fields have values (use existing or fallbacks)
            const updatedItem = { 
              ...item,
              ...updatedListing,
              ...ensureCompleteData({...item, ...updatedListing}), // Ensure complete data
              id: item.id || updatedListing.id,
            };
            
            console.log('🔄 Updated item:', updatedItem.symbol, 'Price:', updatedItem.priceUsd);
            return updatedItem;
          }
          return item;
        });
        
        return { ...prevData, items: updatedItems };
      });
    });
    
    socket.on('listing.new', (newListing: any) => {
      console.log('🆕 Received new listing:', newListing);
      setLastUpdate(new Date());
      
      // Add to updated items set to highlight
      setUpdatedItems(prev => {
        const newSet = new Set(prev);
        newSet.add(newListing.contractAddress);
        // Remove highlight after 3 seconds
        setTimeout(() => {
          setUpdatedItems(current => {
            const updated = new Set(current);
            updated.delete(newListing.contractAddress);
            return updated;
          });
        }, 3000);
        return newSet;
      });
      
      setData(prevData => {
        if (!prevData) return prevData;
        
        // Only add if we're on the first page and it's not already in the list
        if (page === 1) {
          const exists = prevData.items.some(item => 
            item.contractAddress === newListing.contractAddress
          );
          
          if (!exists) {
            // Ensure the new listing has all required fields with fallbacks for missing data
            const formattedNewListing: ListingItem = {
              id: newListing.id || newListing.contractAddress,
              contractAddress: newListing.contractAddress,
              chain: newListing.chain || 'UNKNOWN',
              symbol: newListing.symbol || 'TOKEN',
              name: newListing.name || 'New Token',
              ...ensureCompleteData(newListing) // Ensure all required fields have values
            };
            
            return { 
              ...prevData, 
              items: [formattedNewListing, ...prevData.items].slice(0, prevData.limit),
              total: prevData.total + 1
            };
          }
        }
        
        return prevData;
      });
    });
    
    // Clean up on unmount
    return () => {
      console.log('🧹 Cleaning up WebSocket connection');
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('listing.update');
      socket.off('listing.new');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [backendUrl, page]);

  const isAuthenticated = useMemo(() => !!localStorage.getItem('cto_auth_token'), []);
  
  // Preload images for the next page to improve navigation experience
  const preloadNextPageImages = async () => {
    if (!data) return;
    
    try {
      // Calculate next page
      const nextPage = page + 1;
      if (nextPage * limit >= data.total) return; // No more pages
      
      // Fetch next page data without updating state
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      params.set('page', String(nextPage));
      params.set('limit', String(limit));
      const url = `${backendUrl}/api/v1/listing/listings?${params.toString()}`;
      const res = await axios.get(url);
      
      // Preload images - handle wrapped response from TransformInterceptor
      const responseData = res.data?.data || res.data || {};
      const items = Array.isArray(responseData.items) ? responseData.items : [];
      if (items.length > 0) {
        items.forEach((item: ListingItem) => {
          const src = (item?.logoUrl) || (item as any)?.metadata?.market?.logoUrl || (item as any)?.bannerUrl;
          if (src) {
            const img = new Image();
            img.src = src;
          }
        });
      }
    } catch (error) {
      console.error('Error preloading next page images:', error);
    }
  };
  
  // Call preload function when current page data is loaded
  useEffect(() => {
    if (data) {
      preloadNextPageImages();
    }
  }, [data, page]);
  
  // We've removed the simulation useEffect as we want to use real data from the backend

  const renderPublicThumb = (it: any) => {
    const src = (it?.logoUrl) || (it?.metadata?.market?.logoUrl) || (it?.bannerUrl) || undefined;
    return (
      <div className="w-full h-28 bg-gray-900 flex items-center justify-center">
        <FallbackImage
          src={src}
          alt={(it.symbol || it.name || 'thumb') + ' image'}
          className="max-h-28 object-contain"
        />
      </div>
    );
  };

  const renderUserThumb = (ul: any) => {
    const src = normalizeImageUrl(ul.bannerUrl) || normalizeImageUrl(ul.logoUrl);
    return (
      <div className="w-full h-24 bg-gray-900 flex items-center justify-center rounded mb-3">
        <FallbackImage
          src={src}
          alt={ul.title}
          className="max-h-24 object-contain"
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="sticky top-0 z-10 bg-black border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-white">CTO Listings</h1>
            {lastUpdate && (
              <div className="ml-3 text-xs text-green-400 flex items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse"></span>
                <span>Live updates active</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white placeholder-gray-400"
              placeholder="Search name / symbol / address"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchListings(true); } }}
            />
            <button
              className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm flex items-center gap-1"
              onClick={() => setShowFilters(!showFilters)}
            >
              🔍 Filters
            </button>
            {!isAuthenticated ? (
              <button
                className="px-3 py-1 rounded bg-purple-600 text-white hover:bg-purple-700 text-sm"
                onClick={() => navigate(ROUTES.login)}
              >Login</button>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  className="px-3 py-1 rounded bg-purple-600 text-white hover:bg-purple-700 text-sm"
                  to={ROUTES.createUserListing}
                >Create Listing</Link>
                <Link
                  className="px-3 py-1 rounded bg-gray-700 text-white hover:bg-gray-600 text-sm"
                  to={ROUTES.myUserListings}
                >My Listings</Link>
                <Link
                  className="px-3 py-1 rounded border border-gray-600 text-gray-300 hover:bg-gray-800 text-sm"
                  to={ROUTES.profile}
                >Profile</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-white font-semibold mb-4">🔍 Advanced Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* LP Burned Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  LP Burned (≥%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.minLpBurned}
                  onChange={(e) => setFilters(prev => ({ ...prev, minLpBurned: Number(e.target.value) }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  placeholder="0"
                />
                <div className="text-xs text-gray-400">
                  Higher = more secure
                </div>
              </div>

              {/* Top 10 Holders Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Top 10 Holders (&lt;%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.maxTop10Holders}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxTop10Holders: Number(e.target.value) }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  placeholder="100"
                />
                <div className="text-xs text-gray-400">
                  Lower = more decentralized
                </div>
              </div>

              {/* Mint Auth Filter */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Security Filters
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.mintAuthDisabled}
                      onChange={(e) => setFilters(prev => ({ ...prev, mintAuthDisabled: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-300">Mint Auth Disabled</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={filters.noRaiding}
                      onChange={(e) => setFilters(prev => ({ ...prev, noRaiding: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-300">No Raiding</span>
                  </label>
                </div>
              </div>

              {/* Filter Actions */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Actions
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => setFilters({ minLpBurned: 0, maxTop10Holders: 100, mintAuthDisabled: false, noRaiding: false })}
                    className="w-full px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 text-sm"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 text-sm"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500" />
          </div>
        )}
        {error && (
          <div className="bg-red-900 bg-opacity-20 text-red-400 border border-red-800 rounded p-3 mb-4 text-sm">{error}</div>
        )}
        {data && data.items && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600">
                Showing {data.items.length} of {data.total} listings
              </div>
              {lastUpdate && (
                <div className="text-xs text-gray-600 flex items-center">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1 animate-pulse"></span>
                  <span>Last update: {lastUpdate.toLocaleTimeString()}</span>
                  {refreshing && (
                    <span className="ml-2 text-blue-400 flex items-center">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1 animate-spin"></span>
                      <span>Refreshing...</span>
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="overflow-x-auto bg-black rounded-lg shadow">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-900">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">MC / Liq</th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Holders</th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Age</th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Price / 24%</th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">1m%</th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">5m%</th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">1h%</th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Community score</th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Risk score</th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Tier</th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {(data.items || []).map((it) => {
                    // Format price with appropriate precision
                    const formatPrice = (price: number | null | undefined) => {
                      if (price === null || price === undefined) return '--';
                      
                      // Handle very small numbers better than scientific notation
                      if (price < 0.000001) {
                        // For extremely small numbers, use a special format with significant digits
                        const priceStr = price.toString();
                        
                        // If it's in scientific notation, convert to a more readable format
                        if (priceStr.includes('e-')) {
                          const [base, exponent] = priceStr.split('e-');
                          const baseNum = parseFloat(base);
                          const exp = parseInt(exponent);
                          
                          // Format with 2-3 significant digits
                          const baseFormatted = baseNum.toFixed(2);
                          return `$${baseFormatted}e-${exp}`;
                        }
                        
                        // Count leading zeros after decimal point
                        const decimalPart = priceStr.split('.')[1] || '';
                        let leadingZeros = 0;
                        for (let i = 0; i < decimalPart.length; i++) {
                          if (decimalPart[i] === '0') {
                            leadingZeros++;
                          } else {
                            break;
                          }
                        }
                        
                        // Show at least 2 significant digits
                        return '$' + price.toFixed(leadingZeros + 2);
                      }
                      
                      if (price < 0.001) return '$' + price.toFixed(6);
                      if (price < 1) return '$' + price.toFixed(4);
                      if (price < 1000) return '$' + price.toFixed(2);
                      return '$' + price.toLocaleString(undefined, { maximumFractionDigits: 2 });
                    };
                    
                    // Format volume with K, M, B suffixes
                    const formatVolume = (volume: number | null | undefined) => {
                      if (volume === null || volume === undefined) return '--';
                      if (volume === 0) return '0';
                      if (volume < 1000) return volume.toFixed(0);
                      if (volume < 1000000) return (volume / 1000).toFixed(1) + 'K';
                      if (volume < 1000000000) return (volume / 1000000).toFixed(1) + 'M';
                      return (volume / 1000000000).toFixed(1) + 'B';
                    };
                    
                    // Format age into d / mo / y for better readability
                    const formatAge = (days: number) => {
                      if (!isFinite(days) || days < 0) return '--';
                      if (days < 30) return `${Math.floor(days)}d`;
                      if (days < 365) return `${Math.floor(days / 30)}mo`;
                      return `${(days / 365).toFixed(1)}y`;
                    };

                    // Get age from backend (actual token age) or fallback to updatedAt calculation
                    const getAge = (item: ListingItem) => {
                      // Priority 1: Use backend-provided age (actual token age from creation)
                      if (item.age) {
                        // Accept number or strings like "633", "633d", "633 days"
                        const raw = typeof item.age === 'number'
                          ? item.age
                          : parseFloat(item.age);
                        if (isFinite(raw)) {
                          return formatAge(raw);
                        }
                        return item.age; // fallback to whatever string was provided
                      }
                      
                      // Priority 2: Fallback to calculating from updatedAt (time since last update)
                      // This is less accurate but better than nothing
                      if (item.updatedAt) {
                        try {
                          const timestamp = new Date(item.updatedAt).getTime();
                          if (isNaN(timestamp)) return '--';
                          
                          const diff = Date.now() - timestamp;
                          if (diff < 0) return '--';
                          
                          const days = diff / (1000 * 60 * 60 * 24);
                          const hours = diff / (1000 * 60 * 60);
                          
                          if (days >= 1) {
                            return formatAge(days);
                          } else if (hours >= 1) {
                            return Math.floor(hours) + 'h';
                          } else {
                            const minutes = Math.floor(diff / (1000 * 60));
                            return Math.max(1, minutes) + 'm';
                          }
                        } catch (e) {
                          return '--';
                        }
                      }
                      
                      return '--';
                    };
                    
                    // Format risk score (0-100, higher = safer - matches repoanalyzer.io)
                    const formatRiskScore = (score: number | null | undefined) => {
                      if (score === null || score === undefined) return '--';
                      return score.toFixed(1);
                    };
                    
                    // Format community score (0-100, higher = better)
                    const formatCommunityScore = (score: number | null | undefined) => {
                      if (score === null || score === undefined) return '--';
                      return score.toFixed(1);
                    };
                    
                    return (
                      <tr 
                        key={it.id || it.contractAddress}
                        className={`group ${updatedItems.has(it.contractAddress) ? 'border-2 border-green-500 animate-pulse-light' : 'hover:bg-gray-700 border border-transparent'} cursor-pointer transition-all duration-300`}
                        onClick={() => navigate(`/listing/${it.contractAddress}`)}
                      >
                        <td className="px-3 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 mr-3">
                              <FallbackImage
                                src={(it?.logoUrl) || (it?.metadata?.market?.logoUrl) || (it?.bannerUrl) || undefined}
                                alt={(it.symbol || it.name || 'token') + ' logo'}
                                className="h-10 w-10 rounded-full"
                              />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-white uppercase">{it.symbol || 'Unknown'}</span>
                              <span className="text-[10px] text-gray-500 font-medium truncate max-w-[150px]">{it.name || it.contractAddress}</span>
                            </div>
                          </div>
                        </td>
                        {/* MC / Liq */}
                        <td className="px-3 py-4 whitespace-nowrap text-right text-sm text-gray-300">
                          <div className="flex flex-col items-end">
                            <div className="font-medium text-white">
                              {it.marketCap ? formatVolume(it.marketCap) : '--'}
                            </div>
                            <div className="text-xs text-gray-400">
                              {it.liquidityUsd ? formatVolume(it.liquidityUsd) : '--'}
                            </div>
                          </div>
                        </td>
                        {/* Holders */}
                        <td className="px-3 py-4 whitespace-nowrap text-right text-sm text-gray-300">
                          {(() => {
                            // Try multiple possible field names for holders
                            const holderCount = it.holders ?? (it?.metadata as any)?.market?.holders ?? (it?.metadata as any)?.token?.holder_count ?? null;
                            if (holderCount !== null && holderCount !== undefined && Number.isFinite(Number(holderCount)) && Number(holderCount) > 0) {
                              return Number(holderCount).toLocaleString();
                            }
                            return <span className="text-gray-500">--</span>;
                          })()}
                        </td>
                        {/* Age */}
                        <td className="px-3 py-4 whitespace-nowrap text-right text-sm text-gray-300">
                          {getAge(it)}
                        </td>
                        {/* Price / 24% */}
                        <td className="px-3 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex flex-col items-end">
                            <div className={`font-mono font-medium transition-all duration-300 ${
                              priceChanges.get(it.contractAddress) === 'up' 
                                ? 'text-green-400 font-bold animate-pulse' 
                                : priceChanges.get(it.contractAddress) === 'down' 
                                ? 'text-red-400 font-bold animate-pulse' 
                                : 'text-white'
                            }`}>
                              {formatPrice(it.priceUsd)}
                            </div>
                            <div className={`text-xs font-medium ${
                              Number(it.change24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {it.change24h ? (Number(it.change24h) >= 0 ? '+' : '') + it.change24h.toFixed(2) + '%' : '--'}
                            </div>
                          </div>
                        </td>
                        {/* 1m% */}
                        <td className="px-3 py-4 whitespace-nowrap text-right text-sm">
                          <span className={Number(it.change1m || it?.metadata?.market?.priceChange?.m5 || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {it.change1m !== null && it.change1m !== undefined 
                              ? (Number(it.change1m) >= 0 ? '+' : '') + it.change1m.toFixed(2) + '%'
                              : it?.metadata?.market?.priceChange?.m5 !== null && it?.metadata?.market?.priceChange?.m5 !== undefined
                              ? (Number(it.metadata.market.priceChange.m5) >= 0 ? '+' : '') + it.metadata.market.priceChange.m5.toFixed(2) + '%'
                              : '0%'}
                          </span>
                        </td>
                        {/* 5m% */}
                        <td className="px-3 py-4 whitespace-nowrap text-right text-sm">
                          <span className={Number(it.change5m || it?.metadata?.market?.priceChange?.m5 || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {it.change5m !== null && it.change5m !== undefined 
                              ? (Number(it.change5m) >= 0 ? '+' : '') + it.change5m.toFixed(2) + '%'
                              : it?.metadata?.market?.priceChange?.m5 !== null && it?.metadata?.market?.priceChange?.m5 !== undefined
                              ? (Number(it.metadata.market.priceChange.m5) >= 0 ? '+' : '') + it.metadata.market.priceChange.m5.toFixed(2) + '%'
                              : '0%'}
                          </span>
                        </td>
                        {/* 1h% */}
                        <td className="px-3 py-4 whitespace-nowrap text-right text-sm">
                          <span className={Number(it.change1h || it?.metadata?.market?.priceChange?.h1 || 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {it.change1h !== null && it.change1h !== undefined 
                              ? (Number(it.change1h) >= 0 ? '+' : '') + it.change1h.toFixed(2) + '%'
                              : it?.metadata?.market?.priceChange?.h1 !== null && it?.metadata?.market?.priceChange?.h1 !== undefined
                              ? (Number(it.metadata.market.priceChange.h1) >= 0 ? '+' : '') + it.metadata.market.priceChange.h1.toFixed(2) + '%'
                              : '0%'}
                          </span>
                        </td>
                        {/* Community score - Gauge 0 as requested by user with opacity for "COMING SOON" status */}
                        <td className="px-3 py-4 whitespace-nowrap text-right">
                          <div className="flex flex-col items-end opacity-30 group-hover:opacity-100 transition-opacity" title="Community voting system launching soon">
                            <div className="flex items-center gap-1">
                              <div className="w-12 h-1 bg-gray-800 rounded-full overflow-hidden">
                                <div className="w-0 h-full bg-blue-500"></div>
                              </div>
                              <span className="text-[10px] text-gray-500">0</span>
                            </div>
                            <span className="text-[8px] text-gray-600 uppercase tracking-widest mt-0.5">COMING SOON</span>
                          </div>
                        </td>
                        {/* Risk score */}
                        <td className="px-3 py-4 whitespace-nowrap text-right">
                          {(() => {
                            // Handle null riskScore (not scanned yet)
                            if (it.riskScore === null || it.riskScore === undefined) {
                              return (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-700 text-gray-300">
                                  Not Scanned
                                </span>
                              );
                            }
                            
                            const score = Number(it.riskScore);
                            
                            return (
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                score >= 70 ? 'bg-green-900 text-green-200' :  // 70-100 = Low Risk (safe)
                                score >= 40 ? 'bg-yellow-900 text-yellow-200' : // 40-69 = Medium Risk (moderate)
                                'bg-red-900 text-red-200'  // 0-39 = High Risk (dangerous)
                              }`}>
                                {formatRiskScore(score)}
                              </span>
                            );
                          })()}
                        </td>
                        {/* Tier badge */}
                        <td className="px-3 py-4 whitespace-nowrap text-right">
                          {(() => {
                            // Get tier value and normalize it
                            const rawTier = it.tier;
                            if (!rawTier || rawTier === null || rawTier === undefined) {
                              return (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-700 text-gray-400">
                                  —
                                </span>
                              );
                            }
                            
                            const tier = String(rawTier).trim().toLowerCase();
                            
                            // Check for invalid tier values
                            if (!tier || tier === 'none' || tier === 'null' || tier === 'undefined' || tier === '' || tier === '—' || tier === '----') {
                              return (
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-700 text-gray-400">
                                  —
                                </span>
                              );
                            }
                            
                            // Tier badge colors
                            const tierColors: Record<string, { bg: string; text: string }> = {
                              stellar: { bg: 'bg-purple-900', text: 'text-purple-200' },
                              bloom: { bg: 'bg-blue-900', text: 'text-blue-200' },
                              sprout: { bg: 'bg-green-900', text: 'text-green-200' },
                              seed: { bg: 'bg-yellow-900', text: 'text-yellow-200' },
                              new: { bg: 'bg-teal-900', text: 'text-teal-200' },
                            };
                            
                            const colors = tierColors[tier] || { bg: 'bg-gray-700', text: 'text-gray-300' };
                            
                            return (
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colors.bg} ${colors.text}`}>
                                {tier.toUpperCase()}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {userListData && userListData.items?.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-white">User Listings</h2>
                  <div className="text-xs text-gray-400">Showing {userListData.items.length} of {userListData.total}</div>
                </div>
                <div className="grid grid-cols-1 md-grid-cols-2 lg-grid-cols-3 gap-4 md:grid-cols-2">
                  {userListData.items.map((ul: any) => (
                    <Link key={ul.id} to={`/user-listings/${ul.id}`} className="block bg-gray-800 border border-gray-700 rounded p-4 shadow-sm hover:shadow-lg hover:bg-gray-750 transition">
                      {renderUserThumb(ul)}
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-white truncate">{ul.title}</div>
                        <div className="text-[10px] px-2 py-0.5 rounded bg-purple-900 text-purple-200 border border-purple-700">User Listing</div>
                      </div>
                      <div className="text-xs text-gray-400 truncate">{ul.contractAddr}</div>
                      <div className="text-xs text-gray-400">Chain: {ul.chain}</div>
                      <div className="mt-2 text-sm text-gray-300 line-clamp-3">{ul.description}</div>
                      <div className="mt-2 text-xs text-gray-400">Vetting: {ul.vettingTier} ({ul.vettingScore})</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-400">
                Page {data.page} of {Math.max(1, Math.ceil(data.total / data.limit))} • {data.total} items
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 border border-gray-700 bg-gray-800 text-white rounded disabled:opacity-50 hover:bg-gray-700"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >Prev</button>
                <button
                  className="px-3 py-1 border border-gray-700 bg-gray-800 text-white rounded disabled:opacity-50 hover:bg-gray-700"
                  disabled={data.page * data.limit >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >Next</button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};
