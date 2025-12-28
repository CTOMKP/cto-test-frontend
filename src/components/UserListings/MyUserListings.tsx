import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';
import userListingsService from '../../services/userListingsService';
// Note: Not using FallbackImage here because it calls buildImageCandidates 
// which converts CloudFront URLs back to backend API URLs, causing CORS errors
import { getCloudFrontUrl } from '../../utils/image-url-helper';
import { ListingPayment } from '../Payment/ListingPayment';
import { MovementWalletActivity } from './MovementWalletActivity';
import { paymentService } from '../../services/paymentService';
import toast from 'react-hot-toast';

export const MyUserListings: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState<{listingId: string; title: string} | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [listingPrice, setListingPrice] = useState<number>(50); // Default to 50, will be updated from backend

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await userListingsService.mine();
      setItems(res?.items || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const loadPricing = async () => {
    try {
      const data = await paymentService.getPricing();
      // Response type: { pricing: PaymentPricing; currency: string }
      // PaymentPricing has: { listing: number; adBoosts: {...} }
      if (data?.pricing?.listing !== undefined) {
      setListingPrice(data.pricing.listing);
      }
      // Keep default price if fetch fails or structure is unexpected
    } catch (error) {
      console.error('Failed to load pricing:', error);
      // Keep default price if fetch fails
    }
  };

  const handleDelete = async (listingId: string, listingTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${listingTitle}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(listingId);
    try {
      await userListingsService.delete(listingId);
      toast.success('Listing deleted successfully');
      load(); // Refresh list
    } catch (e: any) {
      const errorMsg = e?.response?.data?.message || e?.message || 'Failed to delete';
      toast.error(errorMsg);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => { 
    load(); 
    loadPricing();

    // Auto-refresh listings every 30 seconds (like gmgn.ai)
    // Reduced frequency to avoid excessive API calls and page refreshes
    const interval = setInterval(() => {
      load();
    }, 30000);

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">My Listings</h1>
        <div className="flex items-center gap-2">
          <Link className="px-3 py-1 border rounded" to={ROUTES.home}>Back to Listings</Link>
          <button className="px-3 py-1 border rounded" onClick={load}>Refresh</button>
        </div>
      </div>
      {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3 mb-4 text-sm">{error}</div>}
      
      {/* PROFESSIONAL ADDITION: Movement Wallet Activity & Balance */}
      <MovementWalletActivity />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((it) => {
            // Convert backend API URLs to CloudFront URLs to avoid CORS issues
            const convertImageUrl = (url: string | null | undefined): string | undefined => {
              if (!url || typeof url !== 'string') return undefined;
              
              // If already CloudFront, return as-is
              if (url.includes('cloudfront.net')) return url;
              
              // Extract path from backend API URL: https://api.ctomarketplace.com/api/v1/images/view/user-uploads/...
              if (url.includes('/api/v1/images/view/')) {
                const pathMatch = url.match(/\/api\/v1\/images\/view\/(.+)$/);
                if (pathMatch) {
                  const imagePath = pathMatch[1].split('?')[0]; // Remove query params
                  return getCloudFrontUrl(imagePath);
                }
              }
              
              // If it's already a path like "user-uploads/...", convert directly
              if (url.includes('user-uploads/')) {
                return getCloudFrontUrl(url);
              }
              
              // Otherwise return as-is (might be external URL)
              return url;
            };
            
            const logo = convertImageUrl(it.logoUrl);
            const banner = convertImageUrl(it.bannerUrl);
            const thumb = logo || banner; // prefer logo for crisp thumbnail
            return (
              <div key={it.id} className="bg-white border rounded shadow-sm hover:shadow transition overflow-hidden">
                <Link to={`/user-listings/${it.id}`} className="block">
                {/* Simple thumbnail (no cover/avatar) */}
                <div className="w-full h-40 bg-gray-50 flex items-center justify-center overflow-hidden">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={`${it.title} thumbnail`}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        // Fallback to placeholder if image fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                        const placeholder = (e.target as HTMLImageElement).nextElementSibling;
                        if (placeholder) {
                          (placeholder as HTMLElement).style.display = 'flex';
                        }
                      }}
                    />
                  ) : (
                    <div className="text-xs text-gray-400">No image</div>
                  )}
                  {thumb && (
                    <div className="text-xs text-gray-400" style={{ display: 'none' }}>
                      Image failed to load
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-gray-900 truncate">{it.title}</div>
                      <div className={`text-xs px-2 py-0.5 rounded ${
                        it.status === 'PUBLISHED' ? 'bg-green-100 text-green-800' :
                        it.status === 'PENDING_APPROVAL' ? 'bg-yellow-100 text-yellow-800' :
                        it.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {it.status === 'PENDING_APPROVAL' ? '⏳ Pending Approval' : it.status}
                      </div>
                  </div>
                  <div className="text-xs text-gray-500 truncate">{it.contractAddr}</div>
                  <div className="text-xs text-gray-500">Chain: {it.chain}</div>
                  <div className="mt-2 text-sm line-clamp-3 whitespace-pre-wrap">{it.description}</div>
                  <div className="mt-2 text-xs text-gray-600">
                    Vetting: {it.vettingTier} 
                    <span className={`ml-1 px-1 py-0.5 rounded text-xs ${
                      (it.vettingScore || 0) >= 70 ? 'bg-green-100 text-green-800' :  // 70-100 = Low Risk (safe)
                      (it.vettingScore || 0) >= 40 ? 'bg-yellow-100 text-yellow-800' : // 40-69 = Medium Risk (moderate)
                      'bg-red-100 text-red-800'  // 0-39 = High Risk (dangerous)
                    }`}>
                      {it.vettingScore?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                </div>
              </Link>
                
                {/* Payment and Delete buttons for DRAFT listings */}
                {it.status === 'DRAFT' && (
                  <div className="px-4 pb-4 space-y-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setShowPayment({listingId: it.id, title: it.title});
                      }}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
                    >
                      💳 Pay 1 USDC to Publish
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleDelete(it.id, it.title);
                      }}
                      disabled={deletingId === it.id}
                      className="w-full bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingId === it.id ? '🗑️ Deleting...' : '🗑️ Delete Listing'}
                    </button>
                  </div>
                )}

                {/* Status message for PENDING listings */}
                {it.status === 'PENDING_APPROVAL' && (
                  <div className="px-4 pb-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                      <p className="text-sm text-yellow-800 font-semibold">⏳ Awaiting Admin Approval</p>
                      <p className="text-xs text-yellow-600 mt-1">Your listing is being reviewed by our team</p>
                    </div>
                  </div>
                )}

                {/* Boost button ONLY for PUBLISHED listings */}
                {it.status === 'PUBLISHED' && (
                  <div className="px-4 pb-4 space-y-2">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                      <p className="text-xs text-green-700">✅ Live on Marketplace</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        alert('Boost feature coming soon! Choose from: Top ($100/day), Priority ($75/day), Spotlight ($150/day)');
                      }}
                      className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:from-orange-700 hover:to-red-700 transition-all"
                    >
                      🚀 Boost This Listing
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="text-center text-gray-500 col-span-full">No listings yet.</div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <ListingPayment
          listingId={showPayment.listingId}
          listingTitle={showPayment.title}
          onPaymentComplete={() => {
            setShowPayment(null);
            load(); // Refresh listings
          }}
          onCancel={() => setShowPayment(null)}
        />
      )}
    </div>
  );
};

export default MyUserListings;