import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { creatorProgramService, type CreatorDashboardResponse } from '../../services/creatorProgramService';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export const CreatorProgramSection: React.FC = () => {
  const [data, setData] = useState<CreatorDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [requestingPayout, setRequestingPayout] = useState(false);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await creatorProgramService.getDashboard(8);
      setData(response);
      setWalletAddress(response.account?.payoutWalletAddress || localStorage.getItem('cto_wallet_address') || '');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load creator dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  const referralLink = data?.account?.referralLink || '';
  const nextTierLabel = useMemo(() => {
    if (!data?.stats.nextTierTarget) return 'Top tier reached';
    return `Next tier at ${data.stats.nextTierTarget} active referrals`;
  }, [data?.stats.nextTierTarget]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const handleRequestPayout = async () => {
    if (!data) return;
    const trimmedWallet = walletAddress.trim();
    if (!trimmedWallet) {
      toast.error('Wallet address is required');
      return;
    }

    try {
      setRequestingPayout(true);
      await creatorProgramService.requestPayout({
        walletAddress: trimmedWallet,
        amount: data.account.pendingBalance,
      });
      toast.success('Payout requested');
      await loadDashboard();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to request payout');
    } finally {
      setRequestingPayout(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-400">
        Loading creator program...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-5 text-sm text-red-200">
        <div className="font-semibold">Creator program unavailable</div>
        <div className="mt-1">{error}</div>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="mt-3 rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white hover:bg-red-400"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data?.account) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-400">
        Creator dashboard data is not available yet.
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-5 shadow-2xl shadow-amber-950/10">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.35em] text-amber-300/70">Creator Program</div>
          <h2 className="mt-2 text-2xl font-bold text-white">Referral dashboard</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Share your referral link, track earnings, and request payouts from qualified activity.
          </p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-right">
          <div className="text-xs uppercase tracking-[0.3em] text-amber-200/70">Tier</div>
          <div className="mt-1 text-xl font-semibold text-amber-100">{data.account.tier}</div>
          <div className="text-xs text-zinc-400">{nextTierLabel}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <Stat label="Active referrals" value={String(data.stats.activeReferrals)} />
        <Stat label="Pending balance" value={currency.format(data.stats.pendingPayoutBalance)} />
        <Stat label="This month" value={currency.format(data.stats.thisMonthEarnings)} />
        <Stat label="Cut percent" value={`${data.stats.creatorCutPercent}%`} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
          <div className="text-sm font-semibold text-zinc-200">Your referral link</div>
          <div className="mt-2 break-all rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
            {referralLink || 'Generating referral link...'}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copy(referralLink)}
              className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
            >
              Copy link
            </button>
            <button
              type="button"
              onClick={() => copy(data.account.referralCode)}
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-200 hover:border-zinc-500 hover:bg-zinc-900"
            >
              Copy code
            </button>
          </div>
          <div className="mt-4 text-xs uppercase tracking-[0.25em] text-zinc-500">Referral code</div>
          <div className="mt-1 text-sm text-zinc-200">{data.account.referralCode}</div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
          <div className="text-sm font-semibold text-zinc-200">Request payout</div>
          <div className="mt-2 text-xs text-zinc-500">
            Minimum payout is $10. Payouts are tracked in the backend and move into reserved balance on request.
          </div>
          <label className="mt-4 block text-xs uppercase tracking-[0.25em] text-zinc-500">Wallet address</label>
          <input
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="Enter payout wallet address"
            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
          />
          <button
            type="button"
            onClick={handleRequestPayout}
            disabled={requestingPayout}
            className="mt-3 w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {requestingPayout ? 'Requesting...' : 'Request payout'}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <ListPanel
          title="Recent referrals"
          empty="No referrals yet."
          items={data.referrals.map((referral) => ({
            title: referral.referredUser?.email || `User ${referral.referredUserId}`,
            meta: `${referral.status} • ${new Date(referral.signedUpAt).toLocaleDateString()}`,
            value: referral.isActive ? 'Active' : 'Pending',
          }))}
        />
        <ListPanel
          title="Recent earnings"
          empty="No earnings yet."
          items={data.earnings.map((earning) => ({
            title: earning.sourceType,
            meta: new Date(earning.createdAt).toLocaleString(),
            value: currency.format(earning.amountEarned),
          }))}
        />
        <ListPanel
          title="Payout history"
          empty="No payouts yet."
          items={data.payouts.map((payout) => ({
            title: payout.status,
            meta: new Date(payout.createdAt).toLocaleString(),
            value: currency.format(payout.amountRequested),
          }))}
        />
      </div>
    </section>
  );
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="text-xs uppercase tracking-[0.25em] text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function ListPanel({
  title,
  items,
  empty,
}: {
  title: string;
  empty: string;
  items: Array<{ title: string; meta: string; value: string }>;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="text-sm font-semibold text-zinc-200">{title}</div>
      <div className="mt-3 space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-zinc-500">{empty}</div>
        ) : (
          items.slice(0, 5).map((item, index) => (
            <div key={`${title}-${index}`} className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-100">{item.title}</div>
                  <div className="text-xs text-zinc-500">{item.meta}</div>
                </div>
                <div className="text-sm font-semibold text-amber-300">{item.value}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
