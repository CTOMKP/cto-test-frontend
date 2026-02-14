
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import marketplaceService from '../../services/marketplaceService';
import { movementWalletService } from '../../services/movementWalletService';
import { usePrivyAuth } from '../../services/privyAuthService';
import { getMovementWallet, sendMovementTransaction } from '../../lib/movement-wallet';
import { useSignRawHash } from '@privy-io/react-auth/extended-chains';
import { pfpService } from '../../services/pfpService';
import { getCloudFrontUrl } from '../../utils/image-url-helper';

const MARKETPLACE_ASSET_BASE = '/marketplace';

type StepKey = 'market' | 'category' | 'details' | 'preview' | 'payment' | 'success' | 'summary' | 'pending' | 'live';
type PostType = 'LOOKING_FOR' | 'OFFERING';
type Tier = 'FREE' | 'PLUS' | 'PREMIUM';

type PricingRow = {
  kind: 'CATEGORY' | 'ADDON' | 'TIER';
  key: string;
  amount: number;
  label?: string;
};

type AdDraft = {
  postType: PostType;
  category: string;
  subCategory: string;
  projectName: string;
  adTitle: string;
  description: string;
  images: File[];
  imagePreviews: string[];
  blockchainFocus: string;
  roleType: string;
  toolsStack: string;
  paymentType: string;
  amount: string;
  deadline: string;
  noDeadline: boolean;
  tier: Tier;
  autoBump: boolean;
  homepageSpotlight: boolean;
  urgentTag: boolean;
  multiChainTag: boolean;
};

const CATEGORIES = [
  'NFT & Art',
  'Developers',
  'Tools & Services',
  'Design & Branding',
  'Writing & Content',
  'Shilling & Marketing',
  'Tokenomics & Strategy',
  'Advisory & Leadership',
  'Community & Operations',
  'Project Listings (For Takeover)',
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

const DEFAULT_DRAFT: AdDraft = {
  postType: 'LOOKING_FOR',
  category: '',
  subCategory: '',
  projectName: '',
  adTitle: '',
  description: '',
  images: [],
  imagePreviews: [],
  blockchainFocus: 'Solana',
  roleType: 'Designer',
  toolsStack: 'Adobe Illustrator',
  paymentType: 'USDT',
  amount: '',
  deadline: '',
  noDeadline: false,
  tier: 'FREE',
  autoBump: false,
  homepageSpotlight: false,
  urgentTag: false,
  multiChainTag: false,
};

const DEFAULT_PRICING: PricingRow[] = [
  { kind: 'CATEGORY', key: 'Developers', amount: 5 },
  { kind: 'CATEGORY', key: 'CTO Wanted', amount: 5 },
  { kind: 'TIER', key: 'FREE', amount: 0 },
  { kind: 'TIER', key: 'PLUS', amount: 5 },
  { kind: 'TIER', key: 'PREMIUM', amount: 15 },
  { kind: 'ADDON', key: 'AUTO_BUMP_3', amount: 7 },
  { kind: 'ADDON', key: 'HOMEPAGE_SPOTLIGHT', amount: 20 },
  { kind: 'ADDON', key: 'URGENT_TAG', amount: 5 },
  { kind: 'ADDON', key: 'MULTI_CHAIN_TAG', amount: 10 },
];

const ROLE_OPTIONS = ['Designer', 'Developer', 'Community Lead', 'CTO', 'Project Manager'];
const TOOL_OPTIONS = ['Adobe Illustrator', 'Figma', 'Photoshop', 'Premiere Pro', 'Notion'];
const PAYMENT_TYPES = ['USDT', 'USDC', 'Revenue Share'];
const BLOCKCHAIN_OPTIONS = ['Solana', 'Base', 'Ethereum', 'Movement', 'Polygon'];
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

const isFeatured = (ad: { featuredPlacement?: boolean; featuredUntil?: string }) => {
  if (ad?.featuredPlacement) return true;
  if (!ad?.featuredUntil) return false;
  const ts = new Date(ad.featuredUntil).getTime();
  return Number.isFinite(ts) && ts > Date.now();
};

export default function MarketDashboard() {
  const [step, setStep] = useState<StepKey>('market');
  const [draft, setDraft] = useState<AdDraft>(DEFAULT_DRAFT);
  const [pricing, setPricing] = useState<PricingRow[]>(DEFAULT_PRICING);
  const [publicAds, setPublicAds] = useState<any[]>([]);
  const [publicAdsLoading, setPublicAdsLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletPublicKey, setWalletPublicKey] = useState('');
  const [adsId] = useState('#432738');
  const [agreeRules, setAgreeRules] = useState(false);
  const [subCategoryInput, setSubCategoryInput] = useState('');
  const [adId, setAdId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const { user: privyUser } = usePrivyAuth();
  const { signRawHash } = useSignRawHash();

  useEffect(() => {
    let mounted = true;
    marketplaceService
      .getPricing()
      .then((rows) => {
        if (mounted && rows?.length) setPricing(rows);
      })
      .catch(() => null);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setPublicAdsLoading(true);
    marketplaceService
      .listPublic({ page: 1, limit: 24 })
      .then((items) => {
        if (mounted) setPublicAds(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (mounted) setPublicAds([]);
      })
      .finally(() => {
        if (mounted) setPublicAdsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (subCategoryInput) {
      setDraft((prev) => ({ ...prev, subCategory: subCategoryInput }));
    }
  }, [subCategoryInput]);

  useEffect(() => {
    const loadWallet = async () => {
      const walletId = localStorage.getItem('cto_wallet_id');
      if (!walletId) return;
      try {
        const balances = await movementWalletService.getBalance(walletId);
        const usdc = balances.find((b) => b.tokenSymbol?.toUpperCase().includes('USDC')) || balances[0];
        if (usdc) {
          const decimals = typeof usdc.decimals === 'number' ? usdc.decimals : 6;
          const numericBalance = parseFloat(usdc.balance || '0') / Math.pow(10, decimals);
          setWalletBalance(Number.isFinite(numericBalance) ? numericBalance : 0);
        }
      } catch (error) {
        console.error('Failed to fetch Movement balance:', error);
      }
    };
    loadWallet();
  }, []);

  useEffect(() => {
    try {
      const movementWallet = getMovementWallet(privyUser);
      if (movementWallet?.address) {
        setWalletAddress(movementWallet.address);
      }
      if ((movementWallet as any)?.publicKey) {
        setWalletPublicKey((movementWallet as any).publicKey);
      }
    } catch {
      // ignore
    }
  }, [privyUser]);

  const subOptions = useMemo(() => SUBCATEGORY_MAP[draft.category] || [], [draft.category]);
  const maxImages = draft.tier === 'FREE' ? 3 : 5;
  const adsToRender = publicAds.length > 0 ? publicAds : SAMPLE_ADS;

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

  const getPrice = (kind: PricingRow['kind'], key: string, fallback: number) => {
    const match = pricing.find((row) => row.kind === kind && row.key === key);
    return match ? match.amount : fallback;
  };
  const categoryPrice = 0;
  const tierPriceByKey: Record<Tier, number> = {
    FREE: getPrice('TIER', 'FREE', 0),
    PLUS: getPrice('TIER', 'PLUS', 5),
    PREMIUM: getPrice('TIER', 'PREMIUM', 15),
  };
  const tierPrice = tierPriceByKey[draft.tier];
  const autoBumpDisplay = getPrice('ADDON', 'AUTO_BUMP_3', 7);
  const homepageDisplay = getPrice('ADDON', 'HOMEPAGE_SPOTLIGHT', 20);
  const urgentDisplay = getPrice('ADDON', 'URGENT_TAG', 5);
  const multiChainDisplay = getPrice('ADDON', 'MULTI_CHAIN_TAG', 10);
  const autoBumpPrice = draft.autoBump ? autoBumpDisplay : 0;
  const homepagePrice = draft.homepageSpotlight ? homepageDisplay : 0;
  const urgentPrice = draft.urgentTag ? urgentDisplay : 0;
  const multiChainPrice = draft.multiChainTag ? multiChainDisplay : 0;
  const uploadedImageCount = draft.images.filter((file) => file && file.size > 0).length;
  const imageAddonPrice = Math.max(uploadedImageCount - 3, 0) * 1;

  const estimatedTotal =
    categoryPrice +
    tierPrice +
    autoBumpPrice +
    homepagePrice +
    urgentPrice +
    multiChainPrice +
    imageAddonPrice;

  const lowBalance = walletBalance < estimatedTotal;

  const updateDraft = (next: Partial<AdDraft>) => {
    setDraft((prev) => ({ ...prev, ...next }));
  };

  const uploadImages = useCallback(async () => {
    const userId = localStorage.getItem('cto_user_id');
    const images = draft.images.filter((file) => file && file.size > 0);
    if (!images.length || !userId) return [];
    setIsUploading(true);
    try {
      const uploads = await Promise.all(
        images.map(async (file) => {
          const result = await pfpService.uploadProfileImage(file, userId);
          return result.viewUrl;
        })
      );
      return uploads;
    } finally {
      setIsUploading(false);
    }
  }, [draft.images]);

  const buildDraftPayload = async () => {
    const imageUrls = await uploadImages();
    const priceAmount = Number.isFinite(Number(draft.amount)) ? Number(draft.amount) : undefined;
    return {
      postType: draft.postType,
      category: draft.category,
      subCategory: draft.subCategory,
      title: draft.adTitle,
      description: draft.description,
      tags: [],
      contactInfo: '',
      chain: draft.blockchainFocus ? draft.blockchainFocus.toUpperCase() : undefined,
      offerType: draft.roleType,
      priceAmount,
      priceCurrency: draft.paymentType,
      images: imageUrls,
      tier: draft.tier,
      homepageSpotlight: draft.homepageSpotlight,
      autoBumpDays: draft.autoBump ? 3 : undefined,
      urgentTag: draft.urgentTag,
      multiChainTag: draft.multiChainTag,
    };
  };

  const ensureDraftSaved = useCallback(async () => {
    const payload = await buildDraftPayload();
    if (!adId) {
      const created = await marketplaceService.createDraft(payload);
      const nextId = created?.id || created?.data?.id;
      if (nextId) setAdId(nextId);
      return nextId;
    }
    await marketplaceService.updateDraft(adId, payload);
    return adId;
  }, [adId, buildDraftPayload]);

  const handleGoToPayment = async () => {
    try {
      setIsSubmitting(true);
      const nextId = await ensureDraftSaved();
      if (!nextId) {
        toast.error('Could not create ad draft. Please try again.');
        return;
      }
      setStep('payment');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save draft.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayment = async () => {
    if (lowBalance) return;
    if (!walletAddress || !walletPublicKey) {
      toast.error('Movement wallet not found. Please sync wallets in Profile.');
      return;
    }
    try {
      setIsSubmitting(true);
      const nextId = await ensureDraftSaved();
      if (!nextId) throw new Error('Draft not created');
      const paymentResponse = await marketplaceService.createPayment(nextId);
      const resolvedPaymentId = paymentResponse?.paymentId || paymentResponse?.payment?.paymentId || paymentResponse?.payment?.id;
      if (resolvedPaymentId) setPaymentId(resolvedPaymentId);

      if (paymentResponse?.message?.includes('No payment required')) {
        setStep('success');
        return;
      }

      const transactionData =
        paymentResponse?.payment?.transactionData || paymentResponse?.transactionData || paymentResponse?.payment?.transaction_data;
      if (!transactionData) {
        throw new Error(paymentResponse?.message || 'Transaction data missing');
      }

      const txHash = await sendMovementTransaction(
        transactionData,
        walletAddress,
        walletPublicKey,
        signRawHash
      );

      if (resolvedPaymentId) {
        await marketplaceService.verifyPayment(resolvedPaymentId, txHash);
      }

      setStep('success');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Payment failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateImageAt = (index: number, file: File | null) => {
    const nextImages = [...draft.images];
    const nextPreviews = [...draft.imagePreviews];
    if (file) {
      nextImages[index] = file;
      nextPreviews[index] = URL.createObjectURL(file);
    }
    updateDraft({ images: nextImages, imagePreviews: nextPreviews });
  };

  const addEmptySlot = () => {
    if (draft.images.length >= maxImages) return;
    updateDraft({ images: [...draft.images, new File([], '')], imagePreviews: [...draft.imagePreviews, ''] });
  };

  const handlePublish = () => {
    if (!agreeRules) return;
    setStep('live');
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        {step === 'market' && (
          <div className="space-y-10">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1c1c1c] to-black p-10 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">CTO Marketplace</p>
              <h1 className="mt-4 text-4xl font-semibold">Need to Rebuild?</h1>
              <p className="mt-3 text-sm text-zinc-400">Find and connect with talent, you need to revive your CTO.</p>
              <button
                className="mt-6 rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-6 py-3 text-sm font-semibold text-black"
                onClick={() => setStep('category')}
              >
                Post an ad
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {['For you', 'New', 'Top', 'Trending'].map((tag) => (
                  <span key={tag} className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input className="rounded-full bg-white/10 px-4 py-2 text-sm text-white" placeholder="Search ads" />
                <button className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-zinc-400">
                  Filters
                </button>
              </div>
            </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {publicAdsLoading && (
                  <div className="col-span-full text-center text-sm text-white/60">Loading marketplace ads...</div>
                )}
                {!publicAdsLoading && publicAds.length === 0 && (
                  <div className="col-span-full text-center text-sm text-white/60">No ads yet.</div>
                )}
                {(publicAds.length ? publicAds : SAMPLE_ADS).map((ad) => {
                    const imageUrl =
                      toCloudFrontUrl(ad.image || ad.images?.[0]) ||
                      `${MARKETPLACE_ASSET_BASE}/ads-thumbnail.png`;
                    const card = (
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10">
                        <div className="relative h-40 overflow-hidden rounded-2xl border border-white/10">
                          <img
                            src={imageUrl}
                            alt={ad.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                          <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white">
                            {ad.badge || (ad.featuredPlacement ? 'Featured' : 'Live')}
                          </span>
                          {isFeatured(ad) && (
                            <span className="absolute right-3 top-3 rounded-full bg-purple-500/80 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white">
                              Purple Badge
                            </span>
                          )}
                        </div>
                        <div className="mt-4 space-y-2">
                          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                            {ad.category || 'Marketplace'} · {ad.subCategory || ad.category || 'General'}
                          </p>
                          <h3 className="text-lg font-semibold">{ad.title}</h3>
                          <p className="text-sm text-zinc-400">{ad.cta || ad.description || 'View details'}</p>
                        </div>
                      </div>
                    );

                    return ad.id ? (
                      <Link key={ad.id} to={`/marketplace/ads/${ad.id}`} className="block">
                        {card}
                      </Link>
                    ) : (
                      <div key={ad.title}>{card}</div>
                    );
                  })
                }
            </div>
          </div>
        )}

        {step === 'category' && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10">
            <div className="flex items-center gap-4 rounded-full border border-white/10 bg-black/50 p-2">
              <button
                className={`flex-1 rounded-full px-4 py-2 text-sm ${
                  draft.postType === 'LOOKING_FOR' ? 'bg-white/10 text-white' : 'text-zinc-500'
                }`}
                onClick={() => updateDraft({ postType: 'LOOKING_FOR' })}
              >
                Looking for
              </button>
              <button
                className={`flex-1 rounded-full px-4 py-2 text-sm ${
                  draft.postType === 'OFFERING' ? 'bg-white/10 text-white' : 'text-zinc-500'
                }`}
                onClick={() => updateDraft({ postType: 'OFFERING' })}
              >
                Offering
              </button>
            </div>

            <div className="mx-auto mt-8 max-w-xl rounded-3xl border border-white/10 bg-black/60 p-8">
              <p className="text-sm font-semibold text-white">Category*</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    className={`rounded-xl border px-4 py-2 text-xs uppercase tracking-[0.25em] ${
                      draft.category === cat
                        ? 'border-white bg-white/10 text-white'
                        : 'border-white/10 text-zinc-500 hover:border-white/30'
                    }`}
                    onClick={() => updateDraft({ category: cat, subCategory: '' })}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Subcategory</p>
                <select
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/60 p-3 text-sm"
                  value={draft.subCategory}
                  onChange={(event) => updateDraft({ subCategory: event.target.value })}
                >
                  <option value="">Select or input sub category</option>
                  {subOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <input
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/60 p-3 text-sm"
                  placeholder="Be more specific (e.g. Smart Contract Dev, Meme Designer, Space Host)"
                  value={subCategoryInput}
                  onChange={(event) => setSubCategoryInput(event.target.value)}
                />
              </div>
              <button
                className="mt-6 w-full rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-6 py-3 text-sm font-semibold text-black"
                onClick={() => setStep('details')}
                disabled={!draft.category || !draft.subCategory}
              >
                Create post
              </button>
            </div>
          </div>
        )}
        {step === 'details' && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10">
            <h2 className="text-center text-2xl font-semibold">Tell Us About The Project</h2>
            <div className="mt-8 space-y-6">
              <input
                className="w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-sm"
                placeholder="Project Name"
                value={draft.projectName}
                onChange={(event) => updateDraft({ projectName: event.target.value })}
              />
              <div>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-sm"
                  placeholder="Ad Title (short headline)"
                  value={draft.adTitle}
                  onChange={(event) => updateDraft({ adTitle: event.target.value })}
                />
                <p className="mt-2 text-right text-xs text-amber-400">8-60 characters, required</p>
              </div>

              <div>
                <p className="text-sm text-zinc-400">Upload Images*</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-4">
                  {[...Array(maxImages)].map((_, idx) => {
                    const preview = draft.imagePreviews[idx];
                    return (
                      <label
                        key={`image-slot-${idx}`}
                        className="flex h-28 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/60 text-xs text-zinc-500"
                      >
                        {preview ? (
                          <img src={preview} alt="preview" className="h-full w-full rounded-2xl object-cover" />
                        ) : (
                          <span>Upload image</span>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => updateImageAt(idx, event.target.files?.[0] || null)}
                        />
                      </label>
                    );
                  })}
                  {draft.images.length < maxImages ? (
                    <button
                      type="button"
                      className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-white/20 text-2xl text-white/40"
                      onClick={addEmptySlot}
                    >
                      +
                    </button>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-amber-400">
                  <span>Upgrade to premium</span>
                  <span>To add more than 3 images</span>
                </div>
              </div>

              <div>
                <textarea
                  className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-sm"
                  placeholder="Project Description"
                  value={draft.description}
                  onChange={(event) => updateDraft({ description: event.target.value })}
                />
                <p className="mt-2 text-right text-xs text-amber-400">800 characters, required</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-zinc-400">Blockchain Focus</label>
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-sm"
                    value={draft.blockchainFocus}
                    onChange={(event) => updateDraft({ blockchainFocus: event.target.value })}
                  >
                    {BLOCKCHAIN_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-zinc-400">Role Type</label>
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-sm"
                    value={draft.roleType}
                    onChange={(event) => updateDraft({ roleType: event.target.value })}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-zinc-400">Tools/Stack</label>
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-sm"
                    value={draft.toolsStack}
                    onChange={(event) => updateDraft({ toolsStack: event.target.value })}
                  >
                    {TOOL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-zinc-400">Payment Type</label>
                  <select
                    className="w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-sm"
                    value={draft.paymentType}
                    onChange={(event) => updateDraft({ paymentType: event.target.value })}
                  >
                    {PAYMENT_TYPES.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-zinc-400">Amount</label>
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-sm"
                    placeholder="Amount"
                    value={draft.amount}
                    onChange={(event) => updateDraft({ amount: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.3em] text-zinc-400">Deadline</label>
                  <input
                    type="date"
                    className="w-full rounded-2xl border border-white/10 bg-black/60 p-4 text-sm"
                    value={draft.deadline}
                    onChange={(event) => updateDraft({ deadline: event.target.value })}
                    disabled={draft.noDeadline}
                  />
                  <label className="flex items-center gap-2 text-xs text-amber-400">
                    <input
                      type="checkbox"
                      checked={draft.noDeadline}
                      onChange={(event) => updateDraft({ noDeadline: event.target.checked })}
                    />
                    No fixed deadline
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Category</p>
                <div className="mt-3 flex items-center justify-between rounded-2xl border border-amber-400/40 bg-black/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{draft.category || 'Developer'}</p>
                    <p className="text-xs text-zinc-400">{draft.subCategory || 'Full Stack'}</p>
                  </div>
                  <span className="text-amber-400">${categoryPrice.toFixed(0)}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Choose how visible you want this post to be</p>
                <div className="mt-4 space-y-3">
                  {([
                    { value: 'FREE', label: 'Free', desc: 'Listed for 28 days', price: tierPriceByKey.FREE },
                    { value: 'PLUS', label: 'Plus', desc: 'Highlighted in listings + top for 1 day', price: tierPriceByKey.PLUS },
                    { value: 'PREMIUM', label: 'Premium', desc: 'Top for 7 days + featured badge + show on homepage', price: tierPriceByKey.PREMIUM },
                  ] as const).map((option) => (
                    <label key={option.value} className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          checked={draft.tier === option.value}
                          onChange={() => updateDraft({ tier: option.value })}
                        />
                        <div>
                          <p>{option.label}</p>
                          <p className="text-xs text-zinc-500">{option.desc}</p>
                        </div>
                      </div>
                      <span className="text-amber-400">${option.price}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/60 p-4">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Boost your ad's reach</p>
                <div className="mt-4 space-y-3">
                  <label className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={draft.autoBump} onChange={(e) => updateDraft({ autoBump: e.target.checked })} />
                      <div>
                        <p>Auto-Bump (3 days)</p>
                        <p className="text-xs text-zinc-500">Pushes your ad to the top every 24h for 3 days</p>
                      </div>
                    </div>
                    <span className="text-amber-400">${autoBumpDisplay}</span>
                  </label>
                  <label className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={draft.homepageSpotlight}
                        onChange={(e) => updateDraft({ homepageSpotlight: e.target.checked })}
                      />
                      <div>
                        <p>Homepage Spotlight</p>
                        <p className="text-xs text-zinc-500">Displayed on homepage under "Top Picks"</p>
                      </div>
                    </div>
                    <span className="text-amber-400">${homepageDisplay}</span>
                  </label>
                  <label className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={draft.urgentTag} onChange={(e) => updateDraft({ urgentTag: e.target.checked })} />
                      <div>
                        <p>Urgent Tag</p>
                        <p className="text-xs text-zinc-500">Red urgency tag, filterable</p>
                      </div>
                    </div>
                    <span className="text-amber-400">${urgentDisplay}</span>
                  </label>
                  <label className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={draft.multiChainTag}
                        onChange={(e) => updateDraft({ multiChainTag: e.target.checked })}
                      />
                      <div>
                        <p>Multi-Chain Tag</p>
                        <p className="text-xs text-zinc-500">Appear under multiple blockchains</p>
                      </div>
                    </div>
                    <span className="text-amber-400">${multiChainDisplay}</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  className="rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-6 py-3 text-sm font-semibold text-black disabled:opacity-40"
                  onClick={() => setStep('preview')}
                >
                  Preview
                </button>
                <p className="text-sm text-zinc-400">Sub-Total: ${estimatedTotal.toFixed(0)}</p>
              </div>
            </div>
          </div>
        )}
        {step === 'preview' && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10">
            <button className="mb-6 rounded-full border border-white/10 px-4 py-2 text-xs" onClick={() => setStep('details')}>
              Back To Edit
            </button>
            <h2 className="text-center text-2xl font-semibold">Review Your Ad Before Publishing</h2>
            <div className="mt-8 space-y-6">
              <div className="rounded-2xl border border-white/10 bg-black/60 p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Project Name</p>
                <p className="mt-1 text-sm text-white">{draft.projectName || 'Bagzilla'}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.3em] text-zinc-400">Ad Title (short headline)</p>
                <p className="mt-1 text-sm text-white">{draft.adTitle || 'CTO Wanted for Aptos Revival Project'}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.3em] text-zinc-400">Upload Images</p>
                <div className="mt-3 flex gap-3">
                  {(draft.imagePreviews.length ? draft.imagePreviews : [`${MARKETPLACE_ASSET_BASE}/preview-ads.png`]).map((img, idx) => (
                    <img key={`prev-${idx}`} src={img} alt="preview" className="h-24 w-24 rounded-xl object-cover" />
                  ))}
                </div>
                <p className="mt-4 text-xs uppercase tracking-[0.3em] text-zinc-400">Project Description</p>
                <p className="mt-1 text-sm text-zinc-300">{draft.description || 'Your description will appear here.'}</p>
                <div className="mt-6 grid gap-3 md:grid-cols-2">
                  <p className="text-sm text-zinc-400">Blockchain Focus</p>
                  <p className="text-sm text-white">{draft.blockchainFocus}</p>
                  <p className="text-sm text-zinc-400">Role Type</p>
                  <p className="text-sm text-white">{draft.roleType}</p>
                  <p className="text-sm text-zinc-400">Tools/Stack</p>
                  <p className="text-sm text-white">{draft.toolsStack}</p>
                  <p className="text-sm text-zinc-400">Payment</p>
                  <p className="text-sm text-white">{draft.paymentType}</p>
                  <p className="text-sm text-zinc-400">Amount</p>
                  <p className="text-sm text-white">{draft.amount || '10,000 USDT'}</p>
                  <p className="text-sm text-zinc-400">Deadline</p>
                  <p className="text-sm text-white">{draft.noDeadline ? 'No fixed deadline' : draft.deadline || '07/30/2025'}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/60 p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Category</p>
                <div className="mt-3 flex items-center justify-between rounded-2xl border border-amber-400/40 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{draft.category || 'Developer'}</p>
                    <p className="text-xs text-zinc-400">{draft.subCategory || 'Full Stack'}</p>
                  </div>
                  <span className="text-amber-400">${categoryPrice.toFixed(0)}</span>
                </div>
                <div className="mt-4 space-y-2">
                  {['FREE', 'PLUS', 'PREMIUM'].map((tier) => (
                    <div
                      key={tier}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-2 text-sm ${
                        draft.tier === tier ? 'border-amber-400/60 bg-amber-500/10 text-white' : 'border-white/10'
                      }`}
                    >
                      <span>{tier}</span>
                      <span className="text-amber-400">${tierPriceByKey[tier as Tier]}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  <div
                    className={`flex items-center justify-between rounded-2xl border px-4 py-2 text-sm ${
                      draft.autoBump ? 'border-amber-400/60 bg-amber-500/10 text-white' : 'border-white/10'
                    }`}
                  >
                    <span>Auto-Bump (3 days)</span>
                    <span className="text-amber-400">${autoBumpDisplay}</span>
                  </div>
                  <div
                    className={`flex items-center justify-between rounded-2xl border px-4 py-2 text-sm ${
                      draft.homepageSpotlight ? 'border-amber-400/60 bg-amber-500/10 text-white' : 'border-white/10'
                    }`}
                  >
                    <span>Homepage Spotlight</span>
                    <span className="text-amber-400">${homepageDisplay}</span>
                  </div>
                  <div
                    className={`flex items-center justify-between rounded-2xl border px-4 py-2 text-sm ${
                      draft.urgentTag ? 'border-amber-400/60 bg-amber-500/10 text-white' : 'border-white/10'
                    }`}
                  >
                    <span>Urgent Tag</span>
                    <span className="text-amber-400">${urgentDisplay}</span>
                  </div>
                  <div
                    className={`flex items-center justify-between rounded-2xl border px-4 py-2 text-sm ${
                      draft.multiChainTag ? 'border-amber-400/60 bg-amber-500/10 text-white' : 'border-white/10'
                    }`}
                  >
                    <span>Multi-Chain Tag</span>
                    <span className="text-amber-400">${multiChainDisplay}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <button
                  className="rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-6 py-3 text-sm font-semibold text-black disabled:opacity-40"
                  onClick={handleGoToPayment}
                  disabled={isSubmitting || isUploading}
                >
                  {isSubmitting ? 'Saving...' : 'Publish'}
                </button>
                <p className="text-sm text-zinc-400">Sub-Total: ${estimatedTotal.toFixed(0)}</p>
              </div>
            </div>
          </div>
        )}
        {step === 'payment' && (
          <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-black/80 p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Payment</h2>
              <button className="text-zinc-400" onClick={() => setStep('preview')}>
                ?
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.3em] text-zinc-400">Project Title</label>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-black/60 p-3 text-sm"
                  value={draft.projectName || 'Multisig Setup for Bagzilla Inu'}
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.3em] text-zinc-400">Ads ID</label>
                <input className="w-full rounded-2xl border border-white/10 bg-black/60 p-3 text-sm" value={adId || adsId} readOnly />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.3em] text-zinc-400">Listing Fee</label>
                <input className="w-full rounded-2xl border border-white/10 bg-black/60 p-3 text-sm" value={`$${estimatedTotal.toFixed(0)}`} readOnly />
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/60 p-4 text-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Payment Method</p>
                <div className="mt-3 space-y-2">
                  {['Fund with USDC', 'Fund with APT', 'Fund with Sol'].map((method, idx) => (
                    <label key={method} className="flex items-center gap-2 text-zinc-300">
                      <input type="radio" name="payment-method" defaultChecked={idx === 0} />
                      {method}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/60 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span>Your Wallet Balance:</span>
                  <span className={lowBalance ? 'text-red-400' : 'text-emerald-400'}>${walletBalance.toFixed(2)} USDC</span>
                  <button className="text-amber-400">Fund Wallet</button>
                </div>
                {lowBalance ? (
                  <div className="mt-3 text-xs text-zinc-400">
                    Wallet Address
                    <div className="mt-2 rounded-xl border border-white/10 bg-black/70 p-2 text-xs">{walletAddress || 'Sync your Movement wallet in Profile'}</div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-400">By clicking on "Pay", the sum will be charged from your wallet balance.</p>
                )}
              </div>

              <p className="text-xs text-amber-400">
                *This app uses USDC as the primary transaction token. Please ensure your wallet is funded.
              </p>

              <button
                className="w-full rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-6 py-3 text-sm font-semibold text-black disabled:opacity-40"
                disabled={lowBalance || isSubmitting}
                onClick={handlePayment}
              >{isSubmitting ? 'Processing...' : 'Pay'}</button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-black/80 p-12 text-center">
            <h2 className="text-sm uppercase tracking-[0.3em] text-zinc-400">All Set</h2>
            <div className="mx-auto mt-6 h-24 w-24 rounded-full bg-emerald-500/20 flex items-center justify-center text-3xl">&#10003;</div>
            <h3 className="mt-6 text-3xl font-semibold">Payment Successful</h3>
            <p className="mt-3 text-sm text-zinc-400">Congratulations! Your payment has been received.</p>
            <button
              className="mt-8 rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-6 py-3 text-sm font-semibold text-black"
              onClick={() => setStep('pending')}
            >
              Continue
            </button>
          </div>
        )}


        {step === 'pending' && (
          <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-black/80 p-12 text-center">
            <h2 className="text-2xl font-semibold">You Are Almost Live</h2>
            <p className="mt-3 text-sm text-zinc-400">
              Give us a few minutes. Admin is reviewing your ad and it will go live once approved.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <button
                className="rounded-full border border-white/10 px-6 py-3 text-sm"
                onClick={() => (window.location.href = '/profile')}
              >
                Go To Profile
              </button>
              <button
                className="rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-6 py-3 text-sm font-semibold text-black"
                onClick={() => setStep('market')}
              >
                Back To Marketplace
              </button>
            </div>
          </div>
        )}
        {step === 'summary' && (
          <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-black/80 p-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Payment & Publish</h2>
              <button className="text-zinc-400" onClick={() => setStep('payment')}>
                ?
              </button>
            </div>
            <div className="mt-4 text-right text-sm text-zinc-400">Ads ID: {adId || adsId}</div>
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Listing</span>
                <span className="text-amber-400">${tierPrice.toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Boost</span>
                <span className="text-amber-400">${(autoBumpPrice + homepagePrice + urgentPrice + multiChainPrice).toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Images(x{uploadedImageCount || 0})</span>
                <span className="text-amber-400">${imageAddonPrice.toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Category</span>
                <span className="text-amber-400">${categoryPrice.toFixed(0)}</span>
              </div>
            </div>
            <div className="mt-6 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between text-lg">
                <span>Total</span>
                <span className="text-amber-400">${estimatedTotal.toFixed(0)}</span>
              </div>
              <label className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
                <input type="checkbox" checked={agreeRules} onChange={(e) => setAgreeRules(e.target.checked)} /> I agree to the{' '}
                <span className="text-amber-400">Community Rules</span>
              </label>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                className="rounded-full bg-gradient-to-r from-pink-500 to-amber-400 px-6 py-3 text-sm font-semibold text-black disabled:opacity-40"
                disabled={!agreeRules}
                onClick={handlePublish}
              >
                Pay & Publish
              </button>
            </div>
          </div>
        )}

        {step === 'live' && (
          <div className="rounded-3xl border border-white/10 bg-black/80 p-10 text-center">
            <h2 className="text-2xl font-semibold">You're Live</h2>
            <div className="mt-6 rounded-3xl border border-white/10 bg-black/60 p-8">
              <div className="text-lg font-semibold">You're Live</div>
              <div className="mt-3 text-sm text-blue-400">https://ctomarketplace.com/listing/bagzilla</div>
              <div className="mt-4 flex justify-center gap-3">
                {['Reddit', 'Meta', 'X', 'Copy'].map((label) => (
                  <button key={label} className="rounded-full border border-white/10 px-4 py-2 text-xs text-zinc-400">
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-6 rounded-full border border-white/10 px-4 py-2 text-xs text-zinc-400">
                Bumped Ads Get 3x More DMs In The First 24 Hours
              </div>
            </div>
            <div className="mt-8 flex justify-center">
              <div className="w-full max-w-xs rounded-3xl border border-white/10 bg-black/60 p-4 text-left">
                <div className="relative h-40 overflow-hidden rounded-2xl">
                  <img src={`${MARKETPLACE_ASSET_BASE}/marketplace-full.png`} alt="ad" className="h-full w-full object-cover" />
                  <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-1 text-xs text-amber-400">10d : 28m : 34s</span>
                </div>
                <div className="mt-3 text-sm font-semibold">Liquidity Partner Needed</div>
                <div className="text-xs text-zinc-400">by @DegenFund</div>
                <div className="mt-3 flex justify-between text-xs text-zinc-500">
                  <span>Payment</span>
                  <span>Price</span>
                </div>
                <div className="mt-2 flex justify-between text-xs text-zinc-400">
                  <span>Revenue share</span>
                  <span>-</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-zinc-500">
                  {['#Liquidity', '#Partner', '#RevenueShare', '#Launch'].map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 px-2 py-1">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



