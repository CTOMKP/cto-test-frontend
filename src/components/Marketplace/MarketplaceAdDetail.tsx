import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import marketplaceService from '../../services/marketplaceService';
import { getCloudFrontUrl } from '../../utils/image-url-helper';

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

export const MarketplaceAdDetail: React.FC = () => {
  const { id } = useParams();
  const [ad, setAd] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!id) return;
    setLoading(true);
    setError(null);
    marketplaceService
      .getPublicAd(id)
      .then((data) => {
        if (mounted) setAd(data);
      })
      .catch((err) => {
        if (mounted) setError(err?.response?.data?.message || err?.message || 'Failed to load ad');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  const images = useMemo(() => {
    const list = Array.isArray(ad?.images) ? ad.images : [];
    return list.map((url: string) => toCloudFrontUrl(url)).filter(Boolean) as string[];
  }, [ad]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading ad...
      </div>
    );
  }

  if (error || !ad) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-lg font-semibold">{error || 'Ad not found'}</div>
          <Link to="/market" className="text-sm text-amber-400 underline">
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <Link to="/market" className="text-sm text-amber-400 underline">
          Back to Marketplace
        </Link>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                {ad.category} · {ad.subCategory || 'General'}
              </p>
              <h1 className="mt-2 text-3xl font-semibold">{ad.title}</h1>
              <p className="mt-2 text-sm text-zinc-400">{ad.description}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm">
              <div className="text-zinc-400">Tier</div>
              <div className="text-lg font-semibold">{ad.tier}</div>
            </div>
          </div>

          {images.length > 0 && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((url, index) => (
                <div key={`${url}-${index}`} className="overflow-hidden rounded-2xl border border-white/10">
                  <img src={url} alt={`Ad ${index + 1}`} className="h-48 w-full object-cover" />
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm">
              <div className="text-zinc-400">Role / Offer</div>
              <div className="text-base font-semibold">{ad.offerType || 'Not specified'}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm">
              <div className="text-zinc-400">Payment</div>
              <div className="text-base font-semibold">
                {ad.priceAmount ? `${ad.priceAmount} ${ad.priceCurrency || 'USDC'}` : 'Open'}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm">
              <div className="text-zinc-400">Blockchain Focus</div>
              <div className="text-base font-semibold">{ad.chain || 'Not specified'}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm">
              <div className="text-zinc-400">Status</div>
              <div className="text-base font-semibold">{ad.status}</div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm">
            <div className="text-zinc-400">Contact</div>
            <div className="mt-1 text-base font-semibold">
              {ad.contactInfo || 'Contact info not provided'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceAdDetail;
