import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { ROUTES } from '../../utils/constants';
import { normalizeImageUrl } from '../../utils/helpers';
import { enrichMarket } from '../../services/marketEnrichment';
import listingService from '../../services/listingService';
import { TokenAnalytics } from './TokenAnalytics';

interface PublicListing {
  id?: string;
  contractAddress: string;
  chain?: string;
  category?: string | null;
  symbol?: string | null;
  name?: string | null;
  priceUsd?: number | null;
  change24h?: number | null;
  liquidityUsd?: number | null;
  volume24h?: number | null;
  holders?: number | null;
  communityScore?: number | null;
  tier?: string | null;
  updatedAt?: string;
  // Possible enriched fields
  logoUrl?: string | null;
  bannerUrl?: string | null;
  metadata?: any;
  marketCap?: number | null;
}

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';

export const ListingDetail: React.FC = () => {
  const { contractAddress } = useParams<{ contractAddress: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState<PublicListing | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [smallBanner, setSmallBanner] = useState(false); // guard against over-zooming blurry banners
  const [isUpdated, setIsUpdated] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Function to ensure complete data with consistent fallbacks
  const ensureCompleteData = (original: PublicListing): Partial<PublicListing> => {
    if (!original) return {};
    
    return {
      // Keep existing values if they exist, otherwise use fallbacks
      priceUsd: original.priceUsd || 0,
      volume24h: original.volume24h || 0,
      liquidityUsd: original.liquidityUsd || 0,
      change24h: original.change24h || 0,
      holders: original.holders || 0,
      marketCap: original.marketCap || 0,
      tier: original.tier || 'Bronze',
      communityScore: original.communityScore || 0,
      updatedAt: original.updatedAt || new Date().toISOString()
    };
  };

  // Load initial data
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axios.get(`${backendUrl}/api/v1/listing/${contractAddress}`);
        const body: PublicListing = res.data?.data || res.data;

        // If critical market fields are missing, try to enrich from public sources
        const needsEnrichment = !Number.isFinite(Number(body?.holders)) || !Number.isFinite(Number(body?.priceUsd)) || !Number.isFinite(Number(body?.liquidityUsd)) || !Number.isFinite(Number(body?.volume24h)) || !Number.isFinite(Number(body?.marketCap));
        let enriched = {} as any;
        if (needsEnrichment && contractAddress) {
          try {
            enriched = await enrichMarket(contractAddress, body?.chain || 'SOLANA');
          } catch {}
        }

        const merged: PublicListing = {
          ...body,
          symbol: body.symbol ?? (enriched as any).symbol ?? null,
          name: body.name ?? (enriched as any).name ?? null,
          priceUsd: body.priceUsd ?? (enriched as any).priceUsd ?? null,
          change24h: body.change24h ?? (enriched as any).change24h ?? null,
          liquidityUsd: body.liquidityUsd ?? (enriched as any).liquidityUsd ?? null,
          volume24h: body.volume24h ?? (enriched as any).volume24h ?? null,
          holders: body.holders ?? (enriched as any).holders ?? null,
          marketCap: body.marketCap ?? (enriched as any).marketCap ?? null,
          tier: body.tier ?? (enriched as any).tier ?? 'Bronze',
          communityScore: body.communityScore ?? 0,
          metadata: {
            ...(body.metadata || {}),
            ...((enriched as any).metadata || {}),
          },
        };

        // If we have missing data, use consistent fallbacks
        if (!Number.isFinite(Number(merged.holders)) || 
            !Number.isFinite(Number(merged.marketCap)) || 
            !Number.isFinite(Number(merged.priceUsd)) ||
            merged.tier === null || merged.tier === '—') {
          const fallbacks = ensureCompleteData(merged);
          Object.assign(merged, {
            holders: merged.holders || fallbacks.holders,
            marketCap: merged.marketCap || fallbacks.marketCap,
            priceUsd: merged.priceUsd || fallbacks.priceUsd,
            tier: merged.tier && merged.tier !== '—' ? merged.tier : fallbacks.tier,
            communityScore: merged.communityScore || fallbacks.communityScore
          });
        }

        setData(merged);

        // Background try: if still missing holders/market cap, enrich once more without blocking UI
        if (!Number.isFinite(Number(merged.holders)) || !Number.isFinite(Number(merged.marketCap))) {
          try {
            const bg = await enrichMarket(contractAddress!, merged?.chain || 'SOLANA');
            setData(prev => prev ? ({
              ...prev,
              holders: prev.holders ?? (bg as any).holders ?? null,
              marketCap: prev.marketCap ?? (bg as any).marketCap ?? null,
              priceUsd: prev.priceUsd ?? (bg as any).priceUsd ?? null,
              change24h: prev.change24h ?? (bg as any).change24h ?? null,
              liquidityUsd: prev.liquidityUsd ?? (bg as any).liquidityUsd ?? null,
              volume24h: prev.volume24h ?? (bg as any).volume24h ?? null,
              metadata: { ...(prev.metadata || {}), ...((bg as any).metadata || {}) }
            }) : prev);
          } catch {}
        }
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || 'Failed to load listing');
      } finally {
        setLoading(false);
      }
    };
    if (contractAddress) load();
  }, [contractAddress]);

  // Setup WebSocket connection for real-time updates
  useEffect(() => {
    if (!contractAddress) return;
    
    // Create socket connection
    const socket = io(`${backendUrl}/ws`, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('Connected to WebSocket server for real-time updates');
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });
    
    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
    
    socket.on('listing.update', (updatedListing: any) => {
      if (updatedListing.contractAddress === contractAddress) {
        console.log('Received listing update for current token:', updatedListing);
        
        setData(prevData => {
          if (!prevData) return prevData;
          
          // Create a merged object with the updated data from WebSocket
          // Apply fallbacks for any missing data
          const merged = { 
            ...prevData,
            ...updatedListing
          };
          
          // Ensure all fields have proper values
          const completeData = ensureCompleteData(merged);
          const updatedItem = {
            ...merged,
            // Only use fallbacks for missing data
            holders: merged.holders || completeData.holders,
            marketCap: merged.marketCap || completeData.marketCap,
            priceUsd: merged.priceUsd || completeData.priceUsd,
            tier: (merged.tier && merged.tier !== '—') ? merged.tier : completeData.tier,
            communityScore: merged.communityScore || completeData.communityScore
          };
          
          // Show update animation
          setIsUpdated(true);
          setTimeout(() => setIsUpdated(false), 3000);
          
          return updatedItem;
        });
      }
    });
    
    // No simulation interval - we'll rely on actual WebSocket updates
    
    // Cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [contractAddress]);

  // Resolve logo and banner sources with fallbacks
  const logoSrc = useMemo(() => {
    const src = (data as any)?.logoUrl || (data as any)?.metadata?.market?.logoUrl || (data as any)?.metadata?.logoUrl;
    return typeof src === 'string' ? normalizeImageUrl(src) || src : undefined;
  }, [data]);
  const bannerSrc = useMemo(() => {
    const src = (data as any)?.bannerUrl || undefined; // public listings may not have banner
    return normalizeImageUrl(src) || src;
  }, [data]);

  // Friendly value formatters
  const fmtMoney = (v: any) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    
    // Format very small numbers better (avoid scientific notation)
    if (n < 0.000001 && n > 0) {
      return `$${n.toFixed(10).replace(/\.?0+$/, '')}`;
    }
    
    // Format small numbers with appropriate precision
    if (n < 0.01 && n > 0) {
      return `$${n.toFixed(6).replace(/\.?0+$/, '')}`;
    }
    
    // Format medium numbers
    if (n < 1000) {
      return `$${n.toFixed(2).replace(/\.?0+$/, '')}`;
    }
    
    // Format large numbers with K/M/B suffixes
    if (n >= 1000 && n < 1000000) {
      return `$${(n / 1000).toFixed(2).replace(/\.0+$/, '')}K`;
    }
    
    if (n >= 1000000 && n < 1000000000) {
      return `$${(n / 1000000).toFixed(2).replace(/\.0+$/, '')}M`;
    }
    
    if (n >= 1000000000) {
      return `$${(n / 1000000000).toFixed(2).replace(/\.0+$/, '')}B`;
    }
    
    return `$${n.toLocaleString()}`;
  };

  const marketCap = (data as any)?.marketCap ?? (data as any)?.metadata?.market_cap ?? (data as any)?.metadata?.market?.marketCap ?? (data as any)?.metadata?.market?.fdv ?? 0;
  const dexPair = (data as any)?.metadata?.pair_address ?? (data as any)?.metadata?.market?.pairAddress ?? null;
  const holders = (data as any)?.holders ?? (data as any)?.metadata?.holders ?? (data as any)?.metadata?.market?.holders ?? (data as any)?.metadata?.token?.holder_count ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl mx-auto p-4">
        <div className="mb-4">
          <button 
            onClick={() => {
              const fromMarket = (location.state as any)?.fromMarket;
              if (fromMarket) {
                navigate('/market');
              } else {
                navigate(ROUTES.home);
              }
            }}
            className="px-3 py-1 border rounded hover:bg-gray-100 transition-colors"
          >
            ← Back
          </button>
        </div>
        <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3 mb-4 text-sm">{error || 'Not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button 
            onClick={() => {
              const fromMarket = (location.state as any)?.fromMarket;
              if (fromMarket) {
                navigate('/market');
              } else {
                navigate(ROUTES.home);
              }
            }}
            className="px-3 py-1 border rounded hover:bg-gray-100 transition-colors"
          >
            ← Back
          </button>
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500">{data.chain}</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Facebook-like cover only on detail page */}
        {(bannerSrc || logoSrc) && (
          <div className="w-full h-48 md:h-64 bg-gray-100 rounded overflow-hidden mb-4 flex items-center justify-center relative">
            {bannerSrc ? (
              <img
                src={bannerSrc}
                alt={(data.symbol || data.name || 'banner') + ' banner'}
                className={`w-full h-full ${smallBanner ? 'object-contain' : 'object-cover'}`}
                onLoad={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  // If banner is smaller than container width, avoid scaling up too much
                  const containerWidth = (el.parentElement?.clientWidth || 0);
                  if (el.naturalWidth && containerWidth && el.naturalWidth < containerWidth) setSmallBanner(true);
                }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <img src={logoSrc} alt={(data.symbol || data.name || 'logo') + ' logo'} className="w-full h-full object-contain opacity-90" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            )}
            {logoSrc && (
              <div className="absolute -bottom-6 left-4 w-20 h-20 rounded-full ring-2 ring-white overflow-hidden bg-white">
                <img src={logoSrc} alt={(data.symbol || data.name || 'logo') + ' logo'} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
          </div>
        )}

        <div className={`bg-white rounded border p-4 pt-8 transition-all duration-500 ${isUpdated ? 'ring-2 ring-green-400 shadow-lg' : ''}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">{data.symbol || data.name || 'Unknown'}</h1>
              <div className="text-xs text-gray-500 break-all">{data.contractAddress}</div>
            </div>
            <div className={`text-right text-sm text-gray-700 transition-all duration-300 ${isUpdated ? 'scale-105' : ''}`}>
              {Number.isFinite(Number(data.priceUsd)) && <div>Price: {fmtMoney(data.priceUsd)}</div>}
              {Number.isFinite(Number(data.change24h)) && (
                <div className={Number(data.change24h) >= 0 ? 'text-green-600' : 'text-red-600'}>
                  24h: {Number(data.change24h).toFixed(2)}%
                </div>
              )}
              {Number.isFinite(Number(data.liquidityUsd)) && <div>Liquidity: {fmtMoney(data.liquidityUsd)}</div>}
              {Number.isFinite(Number(data.volume24h)) && <div>24h Vol: {fmtMoney(data.volume24h)}</div>}
            </div>
          </div>

          {/* Consolidated metadata with robust fallbacks */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className={`border rounded p-3 transition-all duration-300 ${isUpdated ? 'bg-green-50' : ''}`}>
              <div className="text-gray-500">Tier</div>
              <div className="font-semibold">
                {(() => {
                  const tier = (data as any)?.tier || (data as any)?.metadata?.tier;
                  if (!tier || tier === 'none' || tier === 'null' || tier === 'undefined' || tier === '' || tier === '—') {
                    return <span className="text-gray-400">—</span>;
                  }
                  const tierLower = String(tier).trim().toLowerCase();
                  const tierColors: Record<string, { bg: string; text: string }> = {
                    stellar: { bg: 'bg-purple-100', text: 'text-purple-800' },
                    bloom: { bg: 'bg-blue-100', text: 'text-blue-800' },
                    sprout: { bg: 'bg-green-100', text: 'text-green-800' },
                    seed: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
                  };
                  const colors = tierColors[tierLower] || { bg: 'bg-gray-100', text: 'text-gray-800' };
                  return (
                    <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${colors.bg} ${colors.text}`}>
                      {tierLower.toUpperCase()}
                    </span>
                  );
                })()}
              </div>
            </div>
            <div className={`border rounded p-3 transition-all duration-300 ${isUpdated ? 'bg-green-50' : ''}`}>
              <div className="text-gray-500">Holders</div>
              <div className="font-semibold">{Number(holders) > 0 ? Number(holders).toLocaleString() : <span className="text-gray-400 italic">N/A</span>}</div>
            </div>
            <div className={`border rounded p-3 transition-all duration-300 ${isUpdated ? 'bg-green-50' : ''}`}>
              <div className="text-gray-500">Market Cap</div>
              <div className="font-semibold">{fmtMoney(marketCap)}</div>
            </div>
            <div className={`border rounded p-3 transition-all duration-300 ${isUpdated ? 'bg-green-50' : ''}`}>
              <div className="text-gray-500">DEX Pair</div>
              <div className="font-semibold break-all">{dexPair ?? '—'}</div>
            </div>
          </div>
          
          {/* Last updated indicator */}
          {data.updatedAt && (
            <div className="mt-4 text-xs text-gray-500 text-right">
              Last updated: {new Date(data.updatedAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Token Analytics Section with Chart and Stats */}
        <div className="mt-6">
          <TokenAnalytics
            contractAddress={contractAddress || ''}
            chain={data.chain || 'SOLANA'}
            priceUsd={data.priceUsd || undefined}
            marketCap={marketCap}
            liquidityUsd={data.liquidityUsd || undefined}
            volume24h={data.volume24h || undefined}
          />
        </div>
      </main>
    </div>
  );
};

export default ListingDetail;