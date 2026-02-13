import React, { useEffect, useMemo, useState } from 'react';
import marketplaceService from '../../services/marketplaceService';

const MARKETPLACE_ASSET_BASE = '/marketplace';

const STEPS = [
  { key: 'market', label: 'Marketplace' },
  { key: 'category', label: 'Category' },
  { key: 'details', label: 'Details' },
  { key: 'preview', label: 'Preview' },
  { key: 'payment', label: 'Payment' },
  { key: 'summary', label: 'Summary' },
  { key: 'success', label: 'Success' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

const CATEGORIES = [
  {
    title: 'Developers',
    items: ['Smart Contract Dev', 'Frontend Dev', 'Backend Dev', 'Full Stack', 'Blockchain Integration', 'Bot Developer'],
  },
  {
    title: 'Design & Branding',
    items: ['UI/UX Designer', 'Graphic Designer', 'Motion Designer', 'Meme Designer', '3D / NFT Artist', 'Branding Strategist'],
  },
  {
    title: 'Shilling & Marketing',
    items: ['Shillers', 'Influencer Outreach', 'Growth Hacker', 'Social Media Manager', 'Paid Ads / Campaign', 'Meme Creator'],
  },
  {
    title: 'Tokenomics & Strategy',
    items: ['Tokenomics Analyst', 'On-chain Economist', 'Project Strategist', 'DAO Architect', 'Revenue Model Planner'],
  },
  {
    title: 'Advisory & Leadership',
    items: ['CTO', 'Founder/Co-founder', 'Advisor', 'Moderator Lead', 'Project Manager', 'Community DAO Lead'],
  },
  {
    title: 'Community & Operations',
    items: ['Telegram / Discord Mod', 'Admin / Support', 'Community Builder', 'Partnerships Manager', 'Event Organizer', 'HR / Team Coordinator'],
  },
  {
    title: 'Project Listings (For Takeover)',
    items: ['CTO Wanted', 'Rugged Project Revival', 'New Meme Launch', 'DAO Takeover', 'Partnership Requests', 'Builder Wanted'],
  },
  {
    title: 'NFT & Art',
    items: ['NFT Artist', '3D Animator', 'Concept Artist', 'Collection Manager', 'NFT Strategist'],
  },
  {
    title: 'Tools & Services',
    items: ['Analytics Tools', 'Security / Audit Service', 'Launchpad Service', 'Automation / API', 'Dev Tool / Plugin', 'Marketing Tool'],
  },
  {
    title: 'Writing & Content',
    items: ['Copywriter', 'Whitepaper Writer', 'Meme Writer', 'Community Announcer', 'Script Writer', 'Translator'],
  },
];

const SUBCATEGORY_MAP: Record<string, string[]> = {
  Developers: ['Smart Contract Dev', 'Frontend Dev', 'Backend Dev', 'Full Stack', 'Blockchain Integration', 'Bot Developer'],
  'Design & Branding': ['UI/UX Designer', 'Graphic Designer', 'Motion Designer', 'Meme Designer', '3D / NFT Artist', 'Branding Strategist'],
  'Shilling & Marketing': ['Shillers', 'Influencer Outreach', 'Growth Hacker', 'Social Media Manager', 'Paid Ads / Campaign', 'Meme Creator'],
  'Tokenomics & Strategy': ['Tokenomics Analyst', 'On-chain Economist', 'Project Strategist', 'DAO Architect', 'Revenue Model Planner'],
  'Advisory & Leadership': ['CTO', 'Founder/Co-founder', 'Advisor', 'Moderator Lead', 'Project Manager', 'Community DAO Lead'],
  'Community & Operations': ['Telegram / Discord Mod', 'Admin / Support', 'Community Builder', 'Partnerships Manager', 'Event Organizer', 'HR / Team Coordinator'],
  'Project Listings (For Takeover)': ['CTO Wanted', 'Rugged Project Revival', 'New Meme Launch', 'DAO Takeover', 'Partnership Requests', 'Builder Wanted'],
  'NFT & Art': ['NFT Artist', '3D Animator', 'Concept Artist', 'Collection Manager', 'NFT Strategist'],
  'Tools & Services': ['Analytics Tools', 'Security / Audit Service', 'Launchpad Service', 'Automation / API', 'Dev Tool / Plugin', 'Marketing Tool'],
  'Writing & Content': ['Copywriter', 'Whitepaper Writer', 'Meme Writer', 'Community Announcer', 'Script Writer', 'Translator'],
};

const isFeatured = (ad: any) => {
  if (ad?.featuredPlacement) return true;
  if (!ad?.featuredUntil) return false;
  const ts = new Date(ad.featuredUntil).getTime();
  return Number.isFinite(ts) && ts > Date.now();
};
const SAMPLE_ADS = [
  {
    id: 'dev-cta',
    title: 'Need a Solidity CTO?',
    category: 'Developers',
    subCategory: 'Smart Contract Dev',
    cta: 'Start a takeover with a verified CTO.',
    badge: 'Featured',
    featuredPlacement: true,
    featuredUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    image: `${MARKETPLACE_ASSET_BASE}/marketplace-full.png`,
  },
  {
    id: 'design-ux',
    title: 'Brand refresh in 72 hours',
    category: 'Design & Branding',
    subCategory: 'UI/UX Designer',
    cta: 'Launch-ready visuals for your meme.',
    badge: 'Hot',
    featuredUntil: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    image: `${MARKETPLACE_ASSET_BASE}/marketplace.png`,
  },
  {
    id: 'marketing',
    title: 'Campaign launch squad',
    category: 'Shilling & Marketing',
    subCategory: 'Growth Hacker',
    cta: 'Channel growth, influencer outreach, shill list.',
    badge: 'New',
    featuredUntil: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    image: `${MARKETPLACE_ASSET_BASE}/ads-thumbnail.png`,
  },
];

type AdDraft = {
  title: string;
  category: string;
  subCategory: string;
  duration: string;
  budget: string;
  description: string;
  contact: string;
  images: string[];
  tier: 'FREE' | 'PLUS' | 'PREMIUM';
};

const DEFAULT_DRAFT: AdDraft = {
  title: '',
  category: '',
  subCategory: '',
  duration: '7 days',
  budget: '150',
  description: '',
  contact: '',
  images: [''],
  tier: 'FREE',
};

function StepPill({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div
      className={[
        'px-3 py-1 rounded-full text-xs uppercase tracking-[0.2em] border',
        active ? 'bg-white text-black border-white' : done ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40' : 'bg-white/5 text-zinc-400 border-white/10',
      ].join(' ')}
    >
      {label}
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_0_45px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">{title}</p>
          {subtitle ? <h3 className="mt-2 text-2xl font-semibold text-white">{subtitle}</h3> : null}
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function MarketplaceBoard({ onStart }: { onStart: () => void }) {
  return (
    <div className="space-y-10">
      <div className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_rgba(0,0,0,0.7))] p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="flex-1 space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">CTO Marketplace</p>
            <h1 className="text-4xl font-semibold text-white md:text-5xl">Run premium ads. Find elite builders. Go viral.</h1>
            <p className="text-sm text-zinc-400 md:text-base">
              Showcase your listing across the CTO network. Choose a category, upload a creative, and publish in minutes.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:scale-[1.02]"
                onClick={onStart}
              >
                Create an Ad
              </button>
              <button className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80">
                View Live Ads
              </button>
            </div>
          </div>
          <div className="relative h-64 w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40 lg:h-72 lg:w-[380px]">
            <img
              src={`${MARKETPLACE_ASSET_BASE}/marketplace-full.png`}
              alt="Marketplace hero"
              className="h-full w-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          </div>
        </div>
      </div>

      <SectionCard title="Featured" subtitle="Top campaign placements">
        <div className="grid gap-6 lg:grid-cols-3">
          {SAMPLE_ADS.map((ad) => (
            <div key={ad.id} className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <div className="relative h-36 overflow-hidden rounded-2xl border border-white/10">
                <img src={ad.image} alt={ad.title} className="h-full w-full object-cover" />
                <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white">
                  {ad.badge}
                </span>
                {isFeatured(ad) ? (
                  <span className="absolute right-3 top-3 rounded-full bg-purple-500/80 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white">
                    Purple Badge
                  </span>
                ) : null}
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">
                  {ad.category} � {ad.subCategory}
                </p>
                <h3 className="text-lg font-semibold text-white">{ad.title}</h3>
                <p className="text-sm text-zinc-400">{ad.cta}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function CategorySelection({
  selected,
  onSelect,
  subCategory,
  onSelectSub,
  onNext,
}: {
  selected: string;
  subCategory: string;
  onSelect: (value: string) => void;
  onSelectSub: (value: string) => void;
  onNext: () => void;
}) {
  const [showGuide, setShowGuide] = useState(false);
  const subOptions = useMemo(() => SUBCATEGORY_MAP[selected] || [], [selected]);

  return (
    <SectionCard title="Step 1" subtitle="Choose a category">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-4 md:grid-cols-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.title}
              className={[
                'rounded-2xl border p-4 text-left transition',
                selected === cat.title
                  ? 'border-white bg-white/10 text-white'
                  : 'border-white/10 bg-black/30 text-zinc-400 hover:border-white/30 hover:text-white',
              ].join(' ')}
              onClick={() => onSelect(cat.title)}
            >
              <p className="text-sm uppercase tracking-[0.3em]">{cat.title}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {cat.items.slice(0, 3).map((item) => (
                  <span key={item} className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
                    {item}
                  </span>
                ))}
                {cat.items.length > 3 ? (
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-500">
                    +{cat.items.length - 3} more
                  </span>
                ) : null}
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Subcategory</p>
            <p className="mt-2 text-sm text-zinc-400">Choose the exact placement for the ad.</p>
            <select
              className="mt-4 w-full rounded-2xl border border-white/10 bg-black/60 p-3 text-sm text-white"
              value={subCategory}
              onChange={(event) => onSelectSub(event.target.value)}
            >
              <option value="">Select a subcategory</option>
              {subOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <button
            className="w-full rounded-2xl border border-white/10 bg-white/10 p-3 text-sm text-white/80"
            onClick={() => setShowGuide((prev) => !prev)}
          >
            {showGuide ? 'Hide subcategory guide' : 'View subcategory guide'}
          </button>
          {showGuide ? (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <img src={`${MARKETPLACE_ASSET_BASE}/sub.jpg`} alt="Subcategory guide" className="w-full" />
            </div>
          ) : null}
          <button
            className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-black disabled:opacity-40"
            onClick={onNext}
            disabled={!selected || !subCategory}
          >
            Continue
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

function AdDetailsForm({ draft, onChange, onNext, onBack }: { draft: AdDraft; onChange: (next: Partial<AdDraft>) => void; onNext: () => void; onBack: () => void }) {
  const images = draft.images.length ? draft.images : [''];
  const maxImages = draft.tier === 'FREE' ? 3 : 5;

  const updateImage = (index: number, value: string) => {
    const nextImages = [...images];
    nextImages[index] = value;
    onChange({ images: nextImages });
  };

  const addImage = () => {
    if (images.length >= maxImages) return;
    onChange({ images: [...images, ''] });
  };

  return (
    <SectionCard title="Step 2" subtitle="Ad details">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-zinc-400">
              Title
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/60 p-3 text-white"
                placeholder="Launch partner needed"
                value={draft.title}
                onChange={(event) => onChange({ title: event.target.value })}
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-400">
              Contact
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/60 p-3 text-white"
                placeholder="Telegram / email"
                value={draft.contact}
                onChange={(event) => onChange({ contact: event.target.value })}
              />
            </label>
          </div>
          <label className="space-y-2 text-sm text-zinc-400">
            Description
            <textarea
              className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-black/60 p-3 text-white"
              placeholder="Tell the community what you are looking for"
              value={draft.description}
              onChange={(event) => onChange({ description: event.target.value })}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-zinc-400">
              Duration
              <select
                className="w-full rounded-2xl border border-white/10 bg-black/60 p-3 text-white"
                value={draft.duration}
                onChange={(event) => onChange({ duration: event.target.value })}
              >
                {['3 days', '7 days', '14 days', '30 days'].map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-zinc-400">
              Budget (USDC)
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/60 p-3 text-white"
                placeholder="150"
                value={draft.budget}
                onChange={(event) => onChange({ budget: event.target.value })}
              />
            </label>
          </div>
        </div>
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Images</p>
            <p className="mt-2 text-xs text-zinc-500">Max {maxImages} images</p>
            <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
              <img
                src={images[0] || `${MARKETPLACE_ASSET_BASE}/post-ad.png`}
                alt="Upload preview"
                className="h-40 w-full object-cover"
              />
            </div>
            <div className="mt-4 space-y-3">
              {images.map((image, index) => (
                <input
                  key={`image-${index}`}
                  className="w-full rounded-2xl border border-white/10 bg-black/60 p-3 text-sm text-white"
                  placeholder={`Image URL ${index + 1}`}
                  value={image}
                  onChange={(event) => updateImage(index, event.target.value)}
                />
              ))}
              {images.length < maxImages ? (
                <button
                  type="button"
                  className="w-full rounded-2xl border border-white/10 bg-white/10 p-3 text-xs uppercase tracking-[0.3em] text-white/80"
                  onClick={addImage}
                >
                  Add another image
                </button>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Tier</p>
            <div className="mt-3 space-y-3">
              {([
                { value: "FREE", label: "Free", desc: "Standard visibility for 28 days (3 images)." },
                { value: "PLUS", label: "Plus", desc: "Top placement for 24 hours (5 images)." },
                { value: "PREMIUM", label: "Premium", desc: "Top placement for 7 days (5 images)." },
              ] as const).map((option) => (
                <label key={option.value} className="flex items-center gap-3 rounded-2xl border border-white/10 p-3 text-sm text-zinc-300">
                  <input
                    type="radio"
                    name="tier"
                    checked={draft.tier === option.value}
                    onChange={() => onChange({ tier: option.value })}
                  />
                  <div>
                    <p className="text-white">{option.label}</p>
                    <p className="text-xs text-zinc-500">{option.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="rounded-full border border-white/20 px-5 py-2 text-sm text-white/70" onClick={onBack}>
          Back
        </button>
        <button className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black" onClick={onNext}>
          Preview
        </button>
      </div>
    </SectionCard>
  );
}

function PreviewAd({ draft, onNext, onBack, estimatedTotal }: { draft: AdDraft; onNext: () => void; onBack: () => void; estimatedTotal: number }) {
  return (
    <SectionCard title="Step 3" subtitle="Preview">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl border border-white/10 bg-black/40 p-6">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-zinc-400">
              {draft.tier}
            </span>
            <span className="text-xs text-zinc-500">{draft.duration}</span>
          </div>
          <h3 className="mt-4 text-2xl font-semibold text-white">{draft.title || 'Ad title pending'}</h3>
          <p className="mt-2 text-sm text-zinc-400">{draft.description || 'Your ad description will appear here.'}</p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs uppercase tracking-[0.3em] text-zinc-500">
            <span>{draft.category || 'Category'}</span>
            <span>{draft.subCategory || 'Subcategory'}</span>
          </div>
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
            <img
              src={draft.images[0] || `${MARKETPLACE_ASSET_BASE}/preview-ads.png`}
              alt="Ad preview"
              className="h-52 w-full object-cover"
            />
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/50 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Estimated total</p>
            <p className="mt-3 text-3xl font-semibold text-white">{estimatedTotal.toFixed(2)} USDC</p>
            <p className="mt-2 text-sm text-zinc-500">Includes placement + featured boost.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-zinc-400">
            <p>Contact: {draft.contact || 'Not provided'}</p>
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="rounded-full border border-white/20 px-5 py-2 text-sm text-white/70" onClick={onBack}>
          Back
        </button>
        <button className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black" onClick={onNext}>
          Continue to payment
        </button>
      </div>
    </SectionCard>
  );
}

function PaymentMethod({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <SectionCard title="Step 4" subtitle="Select payment">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {['USDC (Movement)'].map((method) => (
            <button
              key={method}
              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/40 p-4 text-left text-sm text-zinc-300 hover:border-white/40"
            >
              <span>{method}</span>
              <span className="text-xs uppercase tracking-[0.3em] text-zinc-500">Recommended</span>
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <img src={`${MARKETPLACE_ASSET_BASE}/payment-summary.png`} alt="Payment summary" className="w-full rounded-2xl" />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="rounded-full border border-white/20 px-5 py-2 text-sm text-white/70" onClick={onBack}>
          Back
        </button>
        <button className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black" onClick={onNext}>
          Review summary
        </button>
      </div>
    </SectionCard>
  );
}

function PaymentSummary({ draft, onNext, onBack, estimatedTotal }: { draft: AdDraft; onNext: () => void; onBack: () => void; estimatedTotal: number }) {
  return (
    <SectionCard title="Step 5" subtitle="Payment summary">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-5 text-sm text-zinc-300">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Ad package</p>
            <h3 className="mt-3 text-xl font-semibold text-white">{draft.title || 'Ad title'}</h3>
            <p className="mt-2 text-zinc-400">{draft.description || 'Your ad description.'}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.3em] text-zinc-500">
              <span>{draft.duration}</span>
              <span>{draft.tier}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-5 text-sm text-zinc-300">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Totals</p>
            <div className="mt-3 flex items-center justify-between text-sm text-white">
              <span>Subtotal</span>
              <span>{estimatedTotal.toFixed(2)} USDC</span>
            </div>
            <div className="mt-4 flex items-center justify-between text-lg font-semibold text-white">
              <span>Total</span>
              <span>{estimatedTotal.toFixed(2)} USDC</span>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <img src={`${MARKETPLACE_ASSET_BASE}/payment-summary.png`} alt="Summary card" className="w-full rounded-2xl" />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="rounded-full border border-white/20 px-5 py-2 text-sm text-white/70" onClick={onBack}>
          Back
        </button>
        <button className="rounded-full bg-emerald-400 px-6 py-2 text-sm font-semibold text-black" onClick={onNext}>
          Confirm payment
        </button>
      </div>
    </SectionCard>
  );
}

function SuccessScreen({ draft, onReset }: { draft: AdDraft; onReset: () => void }) {
  return (
    <SectionCard title="Complete" subtitle="Your ad is live">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-200">
            <p className="text-xs uppercase tracking-[0.3em]">Success</p>
            <h3 className="mt-3 text-2xl font-semibold text-white">Campaign confirmed</h3>
            <p className="mt-2 text-sm text-emerald-200">Your listing will appear across marketplace surfaces instantly.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-5 text-sm text-zinc-300">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Ad details</p>
            <p className="mt-3 text-lg text-white">{draft.title || 'Ad title'}</p>
            <p className="mt-1 text-zinc-400">{draft.category} � {draft.subCategory}</p>
            <p className="mt-3 text-zinc-400">Duration: {draft.duration}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <img src={`${MARKETPLACE_ASSET_BASE}/preview-ads.png`} alt="Live placement" className="w-full rounded-2xl" />
          <button className="mt-4 w-full rounded-full bg-white px-5 py-2 text-sm font-semibold text-black" onClick={onReset}>
            Create another ad
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

function LiveAdDisplay() {
  return (
    <SectionCard title="Live" subtitle="Recent ads">
      <div className="grid gap-4 md:grid-cols-2">
        {SAMPLE_ADS.map((ad) => (
          <div key={ad.id} className="flex gap-4 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="relative">
              <img src={ad.image} alt={ad.title} className="h-20 w-20 rounded-2xl object-cover" />
              {isFeatured(ad) ? (
                <span className="absolute -right-2 -top-2 rounded-full bg-purple-500/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white">
                  Purple
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{ad.category}</p>
              <p className="text-lg font-semibold text-white">{ad.title}</p>
              <p className="text-sm text-zinc-400">{ad.cta}</p>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

export default function MarketDashboard() {
  const [step, setStep] = useState<StepKey>('market');
  const [draft, setDraft] = useState<AdDraft>(DEFAULT_DRAFT);
  const [pricing, setPricing] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    marketplaceService
      .getPricing()
      .then((rows) => {
        if (mounted) setPricing(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (mounted) setPricing([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const pricingMaps = useMemo(() => {
    const category = new Map<string, number>();
    const tier = new Map<string, number>();
    pricing.forEach((row) => {
      if (row?.kind === "CATEGORY") category.set(row.key, Number(row.amount) || 0);
      if (row?.kind === "TIER") tier.set(row.key, Number(row.amount) || 0);
    });
    return { category, tier };
  }, [pricing]);

  const estimatedTotal = useMemo(() => {
    const basePrice = pricingMaps.category.get(draft.category) ?? 0;
    const tierPrice = pricingMaps.tier.get(draft.tier) ?? 0;
    return basePrice + tierPrice;
  }, [draft.category, draft.tier, pricingMaps]);

  const stepIndex = STEPS.findIndex((item) => item.key === step);

  const updateDraft = (next: Partial<AdDraft>) => setDraft((prev) => ({ ...prev, ...next }));

  const handleStart = () => setStep('category');
  const handleCategorySelect = (value: string) => {
    updateDraft({ category: value, subCategory: '' });
  };

  const resetFlow = () => {
    setDraft(DEFAULT_DRAFT);
    setStep('market');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Marketplace console</p>
            <h2 className="mt-2 text-3xl font-semibold">CTO Marketplace</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {STEPS.map((item, index) => (
              <StepPill key={item.key} label={item.label} active={index === stepIndex} done={index < stepIndex} />
            ))}
          </div>
        </div>

        {step === 'market' ? <MarketplaceBoard onStart={handleStart} /> : null}
        {step === 'category' ? (
          <CategorySelection
            selected={draft.category}
            subCategory={draft.subCategory}
            onSelect={handleCategorySelect}
            onSelectSub={(value) => updateDraft({ subCategory: value })}
            onNext={() => setStep('details')}
          />
        ) : null}
        {step === 'details' ? (
          <AdDetailsForm
            draft={draft}
            onChange={updateDraft}
            onBack={() => setStep('category')}
            onNext={() => setStep('preview')}
          />
        ) : null}
        {step === 'preview' ? (
          <PreviewAd draft={draft} onBack={() => setStep('details')} onNext={() => setStep('payment')} estimatedTotal={estimatedTotal} />
        ) : null}
        {step === 'payment' ? (
          <PaymentMethod onBack={() => setStep('preview')} onNext={() => setStep('summary')} />
        ) : null}
        {step === 'summary' ? (
          <PaymentSummary draft={draft} onBack={() => setStep('payment')} onNext={() => setStep('success')} estimatedTotal={estimatedTotal} />
        ) : null}
        {step === 'success' ? <SuccessScreen draft={draft} onReset={resetFlow} /> : null}

        <LiveAdDisplay />
      </div>
    </div>
  );
}

















