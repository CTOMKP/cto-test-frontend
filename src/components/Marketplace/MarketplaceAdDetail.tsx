import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import marketplaceService from '../../services/marketplaceService';
import { getCloudFrontUrl } from '../../utils/image-url-helper';
import MarketplaceTopNav from './MarketplaceTopNav';

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

  const heroImage = images[0] || '/marketplace/ads-thumbnail.png';
  const thumbs = images.length ? images.slice(0, 4) : [];

  return (
    <div className="min-h-screen bg-black text-white">
      <MarketplaceTopNav />
      <div className="px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link to="/market" className="text-sm text-amber-400 underline">
          Back to Marketplace
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8">
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-black/70 p-4">
              <img src={heroImage} alt="Ad hero" className="w-full rounded-2xl object-cover" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {thumbs.map((src, idx) => (
                <img key={`${src}-${idx}`} src={src} alt={`Thumb ${idx + 1}`} className="h-20 w-full rounded-2xl object-cover border border-white/10" />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/70 p-6 space-y-6">
            <div>
              <h1 className="text-2xl font-semibold">{ad.title}</h1>
              <p className="mt-2 text-sm text-zinc-400">{ad.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-zinc-400">Role</p>
                <p className="text-white">{ad.offerType || 'Designer'}</p>
              </div>
              <div>
                <p className="text-zinc-400">Payment</p>
                <p className="text-white">{ad.priceAmount ? `${ad.priceAmount} ${ad.priceCurrency || 'USDC'}` : 'Open'}</p>
              </div>
              <div>
                <p className="text-zinc-400">Chain</p>
                <p className="text-white">{ad.chain || 'Movement'}</p>
              </div>
              <div>
                <p className="text-zinc-400">Posted</p>
                <p className="text-white">{ad.createdAt ? new Date(ad.createdAt).toLocaleDateString() : 'Recently'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to={`/marketplace/ads/${ad.id}/apply`}
                className="rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-6 py-3 text-sm font-semibold text-black"
              >
                Send a message
              </Link>
              <button className="rounded-full border border-white/10 px-6 py-3 text-sm text-zinc-300">Save to watchlist</button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/70 p-6">
          <h2 className="text-lg font-semibold">Because you liked this ad</h2>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="rounded-2xl border border-white/10 bg-black/60 p-3">
                <div className="h-24 rounded-xl bg-white/5" />
                <div className="mt-3 text-sm font-semibold">Recommended Ad</div>
                <div className="text-xs text-zinc-400">View details</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/70 p-6">
          <h2 className="text-lg font-semibold">Comments</h2>
          <div className="mt-4 space-y-3">
            {['Looks solid', 'What is the budget?', 'Can you resume immediately?'].map((text, idx) => (
              <div key={idx} className="rounded-2xl border border-white/10 bg-black/60 p-3 text-sm text-zinc-300">
                {text}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <input className="flex-1 rounded-full bg-white/5 px-4 py-2 text-sm" placeholder="Write a comment..." />
            <button className="rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-4 py-2 text-sm font-semibold text-black">
              Send
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default MarketplaceAdDetail;
