import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Zap } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import userListingsService from '../../services/userListingsService';
import { ROUTES } from '../../utils/constants';
import { compactNumber, formatCompactUsd, formatNumber, getRiskScoreColor, getTierColor } from '../../utils/listingHelpers';

type ListingLike = {
  id: string;
  contractAddr: string;
  chain: string;
  title: string;
  description: string;
  status: string;
  vettingTier?: string;
  vettingScore?: number;
  scanMetadata?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  scanSummary?: string | null;
};

const toDateLabel = (value?: string | Date | null) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
};

const getRiskLabel = (score?: number) => {
  if (typeof score !== 'number') return 'N/A';
  if (score >= 70) return 'LOW';
  if (score >= 50) return 'MEDIUM';
  return 'HIGH';
};

const getCompletion = (score?: number) => {
  if (typeof score !== 'number') return 0;
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
};

export const UserListingLivePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState<ListingLike | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('cto_auth_token');
        let res: any = null;

        if (token) {
          try {
            res = await userListingsService.getMyListing(id);
          } catch {
            // fall through to public listing lookup
          }
        }

        if (!res) {
          res = await userListingsService.getPublicListing(id);
        }

        setListing((res?.data || res) as ListingLike);
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || 'Failed to load approved listing');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const metadata = useMemo(() => {
    if (!listing) return {};
    return (listing.scanMetadata || listing.metadata || {}) as Record<string, any>;
  }, [listing]);

  const summary = useMemo(() => {
    if (!listing) return '';
    return (
      listing.scanSummary ||
      metadata.summary ||
      listing.description ||
      'Your project has been approved and published successfully.'
    );
  }, [listing, metadata]);

  const ageDisplay = metadata.age_display || metadata.age_display_short || 'N/A';
  const createdAt = toDateLabel(metadata.creation_date);
  const price = formatNumber(metadata.token_price);
  const marketCap = compactNumber(metadata.market_cap);
  const volume24h = compactNumber(metadata.volume_24h);
  const liquidity = formatCompactUsd(metadata.lp_amount_usd);
  const holders = metadata.holder_count ? Number(metadata.holder_count).toLocaleString() : 'N/A';
  const score = listing?.vettingScore ?? metadata.vetting_results?.overallScore ?? undefined;
  const tier = listing?.vettingTier || metadata.vetting_results?.eligibleTier || 'SEED';
  const riskLabel = getRiskLabel(score);
  const progress = getCompletion(score);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#010101] text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-[#16C784]" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-[#010101] text-white p-6">
        <div className="max-w-4xl mx-auto">
          <Link to={ROUTES.myUserListings} className="text-sm text-white/70 underline">
            Back
          </Link>
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error || 'Listing not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#010101] text-white px-4 py-6">
      <div className="max-w-5xl mx-auto border border-white/10 rounded-2xl px-4 md:px-8 py-8">
        <div className="border-b border-white/10 pb-6" />

        <div className="mt-10 flex justify-center">
          <div className="w-24 h-24 rounded-full bg-[#16C784]/20 flex items-center justify-center">
            <CheckCircle2 size={44} color="#16C784" />
          </div>
        </div>

        <h1 className="text-center text-4xl font-bold mt-6">Your Project Is Now Live!</h1>
        <p className="text-center text-white/70 mt-3 max-w-2xl mx-auto text-lg">
          Congratulations! Your project has been approved and published. You can now share your listing with the community.
        </p>

        <div className="mt-10 border border-white/15 rounded-xl p-4 md:p-6">
          <h2 className="font-bold text-xl border-b border-white/10 pb-3">Project Summary</h2>

          <div className="mt-4">
            <h3 className="font-bold text-2xl">Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-lg mt-3">
              <p><span className="text-white/70">Name:</span> {metadata.token_name || listing.title || 'N/A'}</p>
              <p><span className="text-white/70">Price:</span> {price}</p>
              <p><span className="text-white/70">Ticker:</span> ${metadata.token_symbol || 'N/A'}</p>
              <p><span className="text-white/70">Market cap:</span> {marketCap}</p>
              <p><span className="text-white/70">Age:</span> {ageDisplay}</p>
              <p><span className="text-white/70">24h volume:</span> {volume24h}</p>
              <p><span className="text-white/70">Created:</span> {createdAt}</p>
              <p><span className="text-white/70">Chain:</span> {listing.chain || 'N/A'}</p>
            </div>
          </div>

          <div className="mt-4 border border-white/15 rounded-lg p-4 bg-white/[0.02]">
            <h4 className="font-semibold text-xl flex items-center gap-2">
              <Zap size={16} color="#FFCB45" /> Summary
            </h4>
            <p className="text-white/75 mt-2 text-lg leading-relaxed">{summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <div className="border border-white/15 rounded-lg p-4 text-center">
              <p className="text-white/60 text-sm">LP security</p>
              <p className="text-2xl font-bold mt-1">{liquidity}</p>
            </div>
            <div className="border border-white/15 rounded-lg p-4 text-center">
              <p className="text-white/60 text-sm">Holders</p>
              <p className="text-2xl font-bold mt-1">{holders}</p>
            </div>
            <div className="border border-white/15 rounded-lg p-4 text-center">
              <p className="text-white/60 text-sm">Security</p>
              <p className="text-2xl font-bold mt-1" style={{ color: getRiskScoreColor(score ?? 0) }}>
                {riskLabel}
              </p>
            </div>
          </div>

          <div className="mt-4 border border-white/15 rounded-lg p-4">
            <div className="flex justify-between text-sm text-white/80 mb-2">
              <span>Tier: <span style={{ color: getTierColor(tier) }}>{tier}</span></span>
              <span>{typeof score === 'number' ? `${score}/100` : 'N/A'}</span>
            </div>
            <div className="w-full h-3 rounded-full bg-[#2A2A2A] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#FF0075] via-[#FF4A15] to-[#16C784]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(`/user-listings/${listing.id}`)}
            className="h-11 px-5 rounded-lg bg-gradient-to-r from-[#FF0075] via-[#FF4A15] to-[#FFCB45] font-semibold"
          >
            View Listing Page
          </button>
          <button
            onClick={() => navigate(ROUTES.home)}
            className="h-11 px-5 rounded-lg border border-white/20 font-semibold hover:bg-white/5"
          >
            Go To Public Listings
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserListingLivePage;
