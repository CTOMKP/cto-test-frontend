import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import marketplaceService from '../../services/marketplaceService';
import messagesService from '../../services/messagesService';
import xpService from '../../services/xpService';
import MarketplaceTopNav from './MarketplaceTopNav';
import toast from 'react-hot-toast';

export default function MarketplaceApply() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ad, setAd] = useState<any>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [xpBalance, setXpBalance] = useState(0);

  useEffect(() => {
    let mounted = true;
    if (!id) return;
    setLoading(true);
    marketplaceService
      .getPublicAd(id)
      .then((data) => mounted && setAd(data))
      .finally(() => mounted && setLoading(false));
    xpService.getMe().then((data) => {
      if (mounted) setXpBalance(data?.balance ?? 0);
    });
    return () => {
      mounted = false;
    };
  }, [id]);

  const minChars = 500;
  const remaining = Math.max(minChars - coverLetter.trim().length, 0);
  const canSubmit = coverLetter.trim().length >= minChars && xpBalance >= 8;

  const handleSubmit = async () => {
    if (!id || !canSubmit) return;
    try {
      setSubmitting(true);
      const res = await messagesService.apply(id, coverLetter.trim());
      setSent(true);
      if (res?.conversation?.id) {
        setTimeout(() => {
          navigate(`/messages/${res.conversation.id}`);
        }, 1200);
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Failed to send application';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-black text-white">
        <MarketplaceTopNav />
        <div className="px-6 py-14">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-black/70 p-10 text-center">
          <h2 className="text-2xl font-semibold">Message Sent</h2>
          <div className="mt-10 rounded-2xl border border-white/10 bg-black/60 p-10">
            <div className="text-3xl">🎉</div>
            <h3 className="mt-4 text-xl font-semibold">Message Delivered</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Your message has been sent to the poster. Watch your inbox for a reply.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <button
                onClick={() => navigate('/market')}
                className="rounded-full border border-white/10 px-6 py-3 text-sm text-zinc-300"
              >
                Browse more listing
              </button>
              <button
                onClick={() => navigate('/messages')}
                className="rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-6 py-3 text-sm font-semibold text-black"
              >
                View message
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <MarketplaceTopNav />
      <div className="px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <Link to={`/marketplace/ads/${id}`} className="text-sm text-zinc-400">
          ← Back
        </Link>
        <h1 className="mt-6 text-center text-2xl font-semibold">Reply to {ad?.title || 'Ad'}</h1>
        <div className="mt-8 rounded-3xl border border-white/10 bg-black/70 p-8">
          <p className="text-sm text-amber-400">You're responding to</p>
          <div className="mt-4 text-sm text-zinc-300 space-y-1">
            <p className="font-semibold">"{ad?.title || 'Listing'}"</p>
            <p>Payment: {ad?.priceAmount ? `${ad.priceAmount} ${ad.priceCurrency || 'USDC'}` : 'Open'}</p>
            <p>Chain: {ad?.chain || 'Movement'}</p>
            <p>Posted: {ad?.createdAt ? new Date(ad.createdAt).toLocaleDateString() : 'Recently'}</p>
          </div>

          <div className="mt-6">
            <label className="block text-sm text-zinc-400 mb-2">Cover Letter</label>
            <textarea
              className="w-full min-h-[180px] rounded-2xl border border-white/10 bg-black/60 p-4 text-sm"
              placeholder="Why are you a good fit for this role?"
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
            />
            <div className="mt-2 text-right text-xs text-amber-400">
              Minimum of {minChars} characters required
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-xs text-zinc-400">
            <span>Your XP Balance: {xpBalance}</span>
            <span>{remaining} characters remaining</span>
          </div>

          {xpBalance < 8 && (
            <div className="mt-3 text-xs text-red-400">
              You need 8 XP to start a conversation.
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-8 py-3 text-sm font-semibold text-black disabled:opacity-40"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
