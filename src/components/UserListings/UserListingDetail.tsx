import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import userListingsService from '../../services/userListingsService';
import { ROUTES } from '../../utils/constants';
import { normalizeImageUrl } from '../../utils/helpers';
import { getCloudFrontUrl } from '../../utils/image-url-helper';
import { TokenAnalytics } from '../Listing/TokenAnalytics';

interface UserListing {
  id: string;
  userId: number;
  contractAddr: string;
  chain: string;
  title: string;
  description: string;
  bio?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  links?: Record<string, any> | null;
  status: string;
  vettingTier: string;
  vettingScore: number;
  createdAt: string;
  updatedAt: string;
}

export const UserListingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<UserListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [smallBanner, setSmallBanner] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Try to fetch as authenticated user's listing first
        const token = localStorage.getItem('cto_auth_token');
        let res;
        
        if (token) {
          try {
            res = await userListingsService.getMyListing(id!);
            setData(res?.data || res);
            setLoading(false);
            return;
          } catch (authError: any) {
            // If not user's listing or auth failed, try public endpoint
            if (authError?.response?.status !== 403 && authError?.response?.status !== 404) {
              throw authError;
            }
          }
        }
        
        // Fall back to public listing
        res = await userListingsService.getPublicListing(id!);
        setData(res?.data || res);
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || 'Failed to load listing');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  // Convert backend API URLs to CloudFront URLs to avoid CORS issues
  const logoSrc = useMemo(() => {
    const logoUrl = (data as any)?.logoUrl;
    if (!logoUrl) return undefined;
    
    // If it's a backend API URL, convert to CloudFront
    if (typeof logoUrl === 'string' && logoUrl.includes('/api/v1/images/view/')) {
      const pathMatch = logoUrl.match(/\/api\/v1\/images\/view\/(.+)$/);
      if (pathMatch) {
        return getCloudFrontUrl(pathMatch[1].split('?')[0]);
      }
    }
    // Otherwise use normalized URL (might already be CloudFront or external)
    return normalizeImageUrl(logoUrl) || logoUrl;
  }, [data]);
  
  const bannerSrc = useMemo(() => {
    const bannerUrl = (data as any)?.bannerUrl;
    if (!bannerUrl) return undefined;
    
    // If it's a backend API URL, convert to CloudFront
    if (typeof bannerUrl === 'string' && bannerUrl.includes('/api/v1/images/view/')) {
      const pathMatch = bannerUrl.match(/\/api\/v1\/images\/view\/(.+)$/);
      if (pathMatch) {
        return getCloudFrontUrl(pathMatch[1].split('?')[0]);
      }
    }
    // Otherwise use normalized URL (might already be CloudFront or external)
    return normalizeImageUrl(bannerUrl) || bannerUrl;
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-4"><Link className="px-3 py-1 border rounded" to={ROUTES.home}>Back</Link></div>
        <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3 mb-4 text-sm">{error || 'Not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link className="px-3 py-1 border rounded" to={ROUTES.home}>Back</Link>
          <div className="text-xs text-gray-500">{data.status}</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Facebook-style cover only on detail page */}
        {(bannerSrc || logoSrc) && (
          <div className="w-full h-48 md:h-64 bg-gray-100 rounded overflow-hidden mb-4 flex items-center justify-center relative">
            {bannerSrc ? (
              <img
                src={bannerSrc}
                alt={`${data.title} banner`}
                className={`w-full h-full ${smallBanner ? 'object-contain' : 'object-cover'}`}
                onLoad={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  const containerWidth = el.parentElement?.clientWidth || 0;
                  if (el.naturalWidth && containerWidth && el.naturalWidth < containerWidth) setSmallBanner(true);
                }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <img src={logoSrc} alt={`${data.title} logo`} className="w-full h-full object-contain opacity-90" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            )}
            {logoSrc && (
              <div className="absolute -bottom-6 left-4 w-20 h-20 rounded-full ring-2 ring-white overflow-hidden bg-white">
                <img src={logoSrc} alt={`${data.title} logo`} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded border p-4 pt-8">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">{data.title}</h1>
                <div className="text-xs px-2 py-0.5 rounded bg-gray-100 border">{data.chain}</div>
              </div>
              <div className="text-xs text-gray-500 break-all">{data.contractAddr}</div>
              <div className="mt-2 whitespace-pre-wrap text-sm">{data.description}</div>
              {data.bio && <div className="mt-2 text-sm text-gray-600">Bio: {data.bio}</div>}
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {data.links?.website && <a className="text-blue-600 underline" target="_blank" rel="noreferrer" href={data.links.website}>Website</a>}
                {data.links?.twitter && <a className="text-blue-600 underline" target="_blank" rel="noreferrer" href={data.links.twitter}>Twitter</a>}
                {data.links?.telegram && <a className="text-blue-600 underline" target="_blank" rel="noreferrer" href={data.links.telegram}>Telegram</a>}
                {data.links?.discord && <a className="text-blue-600 underline" target="_blank" rel="noreferrer" href={data.links.discord}>Discord</a>}
              </div>
              <div className="mt-3 text-xs text-gray-600">
                Vetting: {data.vettingTier} 
                <span className={`ml-1 px-1 py-0.5 rounded text-xs ${
                  (data.vettingScore || 0) >= 70 ? 'bg-green-100 text-green-800' :  // 70-100 = Low Risk (safe)
                  (data.vettingScore || 0) >= 40 ? 'bg-yellow-100 text-yellow-800' : // 40-69 = Medium Risk (moderate)
                  'bg-red-100 text-red-800'  // 0-39 = High Risk (dangerous)
                }`}>
                  {data.vettingScore?.toFixed(1) || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Token Analytics with Chart */}
        <div className="mt-6">
          <TokenAnalytics
            contractAddress={data.contractAddr}
            chain={data.chain}
          />
        </div>
      </main>
    </div>
  );
};

export default UserListingDetail;