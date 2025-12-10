import React, { useMemo, useState, useEffect } from 'react';
import userListingsService, { CreateUserListingPayload, ScanResult } from '../../services/userListingsService';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';
import toast from 'react-hot-toast';
import axios from 'axios';

// Multi-step wizard: Scan → Vetting Result → Details → Roadmap → Publish
// Images are handled by URL fields for now; can be replaced with upload service later

const CHAINS = ['SOLANA', 'APTOS', 'BNB', 'ETHEREUM', 'SUI', 'BASE', 'NEAR', 'OSMOSIS'];

export const CreateUserListing: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: scan
  const [contractAddr, setContractAddr] = useState('');
  const [chain, setChain] = useState('SOLANA');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  // Step 3: details (after Vetting Result)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bio, setBio] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [links, setLinks] = useState({ website: '', twitter: '', telegram: '', discord: '' });

  // Step 4: roadmap
  const [roadmapTitle, setRoadmapTitle] = useState('');
  const [roadmapDescription, setRoadmapDescription] = useState('');
  const [roadmapLinks, setRoadmapLinks] = useState<string>('');

  const DRAFT_KEY = 'cto_draft_listing_id';
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';
  const authHeaders = () => {
    const token = localStorage.getItem('cto_auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };
  const getDraftId = (): string | undefined => {
    return localStorage.getItem(DRAFT_KEY) || (window as any).__draftListingId;
  };
  const setDraftId = (id: string) => {
    localStorage.setItem(DRAFT_KEY, id);
    (window as any).__draftListingId = id;
  };

  const [logoUploading, setLogoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);

  // Clear any stale draft ID when component mounts (ensures fresh start)
  useEffect(() => {
    console.log('🗑️ CreateUserListing mounted - clearing stale draft ID');
    localStorage.removeItem(DRAFT_KEY);
    (window as any).__draftListingId = undefined;
  }, []); // Run only once on mount

  const ensureDraftExists = async (): Promise<string | undefined> => {
    const existing = getDraftId();
    if (existing) return existing;
    if (!scanResult?.success || !scanResult.eligible) {
      return undefined;
    }
    const payload: CreateUserListingPayload = {
      contractAddr: contractAddr.trim(),
      chain,
      title,
      description,
      bio: bio || undefined,
      logoUrl: logoUrl || undefined,
      bannerUrl: bannerUrl || undefined,
      links: {
        website: links.website || undefined,
        twitter: links.twitter || undefined,
        telegram: links.telegram || undefined,
        discord: links.discord || undefined,
      },
      vettingTier: scanResult.vettingTier,
      vettingScore: scanResult.vettingScore,
    };
    const res = await userListingsService.create(payload);
    if (res?.success && res?.data?.id) {
      setDraftId(res.data.id);
      // Persist any current logo/banner URLs immediately after draft creation
      const updates: Partial<CreateUserListingPayload> = {};
      if (logoUrl) updates.logoUrl = logoUrl;
      if (bannerUrl) updates.bannerUrl = bannerUrl;
      if (Object.keys(updates).length > 0) {
        try { await userListingsService.update(res.data.id, updates); } catch {}
      }
      return res.data.id;
    }
    throw new Error('Failed to create draft');
  };

  const handleContinueFromDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      if (scanResult?.eligible) {
        await ensureDraftExists();
      } else {
        toast('You can continue, but saving/publishing requires a higher vetting score.', { icon: '⚠️' });
      }
      setStep(4);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to continue');
      setStep(4);
    } finally {
      setLoading(false);
    }
  };

  // Presigned upload helper shared by logo/banner
  const uploadViaPresign = async (
    kind: 'generic' | 'profile' | 'banner' | 'meme',
    file: File,
    opts?: { projectId?: string; userId?: string }
  ): Promise<{ viewUrl: string; key: string; metadata: any }> => {
    if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed');
    if (file.size > 10 * 1024 * 1024) throw new Error('Image must be 10MB or less');

    // 1) Ask backend for presigned upload URL
    const presignRes = await axios.post(
      `${backendUrl}/api/images/presign`,
      {
        type: kind,
        userId: opts?.userId,
        projectId: opts?.projectId,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      },
      { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
    );

    const { uploadUrl, key, metadata } = presignRes.data || {};
    if (!uploadUrl || !key) throw new Error('Failed to get presigned upload URL');

    // 2) Upload directly to storage (S3) via presigned PUT
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!putRes.ok) {
      throw new Error(`Upload failed with status ${putRes.status}`);
    }

    // 3) Always use backend redirect endpoint for stable reads (avoids expiring S3 URLs)
    const viewUrl = `${backendUrl}/api/images/view/${key}`;
    return { viewUrl, key, metadata };
  };

  const onLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLogoUploading(true);
      // Ensure we have a draft so logo persists to DB immediately
      const draftId = await ensureDraftExists();
      let viewUrl: string;
      if (draftId) {
        // Use 'profile' type and projectId to keep logo under project namespace
        ({ viewUrl } = await uploadViaPresign('profile', file, { projectId: draftId }));
      } else {
        ({ viewUrl } = await uploadViaPresign('generic', file));
      }
      setLogoUrl(viewUrl);
      // Persist immediately if draft exists
      if (draftId) {
        try { await userListingsService.update(draftId, { logoUrl: viewUrl }); } catch {}
      }
      toast.success('Logo uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const onBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setBannerUploading(true);
      // Prefer project-keyed banner if a draft exists; otherwise fall back to generic so user sees progress
      let viewUrl: string;
      const draftId = await ensureDraftExists();
      if (draftId) {
        ({ viewUrl } = await uploadViaPresign('banner', file, { projectId: draftId }));
      } else {
        ({ viewUrl } = await uploadViaPresign('generic', file));
        toast('Draft not created yet — uploaded as generic. Save draft to lock a project banner key.', { icon: 'ℹ️' });
      }
      setBannerUrl(viewUrl);
      // If we already have a draft, persist bannerUrl so DB won't be null
      if (draftId) {
        try { await userListingsService.update(draftId, { bannerUrl: viewUrl }); } catch {}
      }
      toast.success('Banner uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload banner');
    } finally {
      setBannerUploading(false);
    }
  };

  const canProceedPostScan = useMemo(() => !!scanResult, [scanResult]);

  const handleScan = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await userListingsService.scan(contractAddr.trim(), chain);
      setScanResult(res);
      // Proceed to Vetting Result (Step 2) after any scan result (eligible or not)
      setStep(2);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Scan failed';
      // If unauthorized, clear session and redirect to login
      if (e?.message === 'Unauthorized' || e?.response?.status === 401) {
        localStorage.removeItem('cto_user_email');
        localStorage.removeItem('cto_user_created');
        localStorage.removeItem('cto_wallet_id');
        localStorage.removeItem('cto_auth_token');
        toast.error('Session expired. Please sign in again.');
        navigate(ROUTES.login);
        return;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDraft = async () => {
    if (!scanResult?.success || !scanResult.eligible) {
      setError('Please pass vetting before continuing');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const payload: CreateUserListingPayload = {
        contractAddr: contractAddr.trim(),
        chain,
        title,
        description,
        bio: bio || undefined,
        logoUrl: logoUrl || undefined,
        bannerUrl: bannerUrl || undefined,
        links: {
          website: links.website || undefined,
          twitter: links.twitter || undefined,
          telegram: links.telegram || undefined,
          discord: links.discord || undefined,
        },
        vettingTier: scanResult.vettingTier,
        vettingScore: scanResult.vettingScore,
      };
      const res = await userListingsService.create(payload);
      if (res?.success && res?.data?.id) {
        setDraftId(res.data.id);
        setStep(4);
      } else {
        setError('Failed to create draft');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Create failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    try {
      setLoading(true);
      setError(null);
      let id = getDraftId();

      // If no draft exists yet, create it now (idempotent publish)
      if (!id) {
        if (!scanResult?.success || !scanResult.eligible) {
          throw new Error('Please pass vetting before publishing');
        }
        const payload: CreateUserListingPayload = {
          contractAddr: contractAddr.trim(),
          chain,
          title,
          description,
          bio: bio || undefined,
          logoUrl: logoUrl || undefined,
          bannerUrl: bannerUrl || undefined,
          links: {
            website: links.website || undefined,
            twitter: links.twitter || undefined,
            telegram: links.telegram || undefined,
            discord: links.discord || undefined,
          },
          vettingTier: scanResult.vettingTier,
          vettingScore: scanResult.vettingScore,
        };
        const createRes = await userListingsService.create(payload);
        if (!createRes?.success || !createRes?.data?.id) {
          throw new Error('Failed to create draft for publish');
        }
        id = createRes.data.id;
        setDraftId(id as string);
      }

      // Resolve to a definite string for TS
      const draftId: string = id as string;
      if (!draftId) {
        throw new Error('No draft id available');
      }

      // Update draft with roadmap fields (append to description for now)
      const updatedDescription = description + (roadmapTitle || roadmapDescription || roadmapLinks ? `\n\nRoadmap: ${roadmapTitle}\n${roadmapDescription}\n${roadmapLinks}` : '');
      
      try {
      await userListingsService.update(draftId, { description: updatedDescription });
      } catch (updateError: any) {
        // If draft doesn't exist (404), clear stale ID and show helpful message
        if (updateError?.response?.status === 404) {
          localStorage.removeItem(DRAFT_KEY);
          (window as any).__draftListingId = undefined;
          throw new Error('Draft expired. Please create a new listing from the beginning.');
        }
        throw updateError;
      }

      const res = await userListingsService.publish(draftId);
      if (res?.success) {
        setStep(5);
        // Clear draft id after successful publish
        localStorage.removeItem(DRAFT_KEY);
        (window as any).__draftListingId = undefined;
      } else {
        setError('Publish failed');
      }
    } catch (e: any) {
      const errorMsg = e?.response?.data?.message || e?.message || 'Publish failed';
      setError(errorMsg);
      
      // If error is about payment, show helpful message and redirect
      if (errorMsg.includes('Payment required') || errorMsg.includes('pay 50 USDC')) {
        toast('💳 Payment Required! Redirecting to payment page...', { 
          icon: '💰',
          duration: 3000,
          style: {
            background: '#3B82F6',
            color: '#fff',
          }
        });
        
        setTimeout(() => {
          navigate(ROUTES.myUserListings);
        }, 2000);
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setScanResult(null);
    setContractAddr('');
    setChain('SOLANA');
    setTitle('');
    setDescription('');
    setBio('');
    setLogoUrl('');
    setBannerUrl('');
    setLinks({ website: '', twitter: '', telegram: '', discord: '' });
    setRoadmapTitle('');
    setRoadmapDescription('');
    setRoadmapLinks('');
  };

  // Helper to safely read nested values with fallback
  const pick = (obj: any, key: string) => {
    try {
      const val = key.split('.').reduce((o: any, k: string) => (o ? o[k] : undefined), obj);
      return val ?? '—';
    } catch {
      return '—';
    }
  };

  // Helper to read raw (no fallback conversion)
  const get = (obj: any, key: string) => {
    try {
      return key.split('.').reduce((o: any, k: string) => (o ? o[k] : undefined), obj);
    } catch {
      return undefined;
    }
  };

  // Currency formatting for large values
  const formatCurrency = (val: any) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return '—';
    const abs = Math.abs(n);
    if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toLocaleString()}`;
  };

  // Date formatting helper
  const formatDate = (val: any) => {
    const d = new Date(val);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Create User Listing</h1>

      {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded p-3 mb-4 text-sm">{error}</div>}

      {step === 1 && (
        <div className="space-y-4 bg-white p-4 rounded border">
          <div>
            <label className="block text-sm mb-1">Chain</label>
            <select 
              value={chain} 
              onChange={(e) => setChain(e.target.value)} 
              className="border rounded px-3 py-2 w-full"
              aria-label="Select blockchain"
            >
              {CHAINS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Contract Address</label>
            <input className="border rounded px-3 py-2 w-full" value={contractAddr} onChange={(e) => setContractAddr(e.target.value)} placeholder="Enter contract address"/>
          </div>
          <button disabled={loading || !contractAddr} className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50" onClick={handleScan}>Scan</button>
          {scanResult && (
            <div className="text-sm bg-gray-50 border rounded p-3 space-y-1">
              <div>Eligible: <span className={scanResult.eligible ? 'text-green-600' : 'text-red-600'}>{String(scanResult.eligible)}</span></div>
              <div>Score: 
                <span className={`ml-1 px-1 py-0.5 rounded text-xs ${
                  (scanResult.vettingScore || 0) >= 70 ? 'bg-green-100 text-green-800' :  // 70-100 = Low Risk (safe)
                  (scanResult.vettingScore || 0) >= 40 ? 'bg-yellow-100 text-yellow-800' : // 40-69 = Medium Risk (moderate)
                  'bg-red-100 text-red-800'  // 0-39 = High Risk (dangerous)
                }`}>
                  {scanResult.vettingScore?.toFixed(1) || 'N/A'}
                </span>
              </div>
              <div>Tier: {scanResult.vettingTier}</div>
              {!scanResult.eligible && (
                <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                  Token does not meet minimum criteria for any tier. You can still continue to provide details and a roadmap, but saving as draft or publishing will require sufficient vetting score.
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button className="px-3 py-1 border rounded disabled:opacity-50" disabled={!canProceedPostScan} onClick={() => setStep(2)}>Continue</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 bg-white p-4 rounded border">
          <h2 className="text-lg font-semibold">Vetting Result</h2>
          {scanResult ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border rounded p-3">
                  <div className="text-sm text-gray-500">Eligibility</div>
                  <div className={`text-base font-semibold ${scanResult.eligible ? 'text-green-600' : 'text-red-600'}`}>{scanResult.eligible ? 'Eligible' : 'Not Eligible'}</div>
                </div>
                <div className="border rounded p-3">
                  <div className="text-sm text-gray-500">Vetting Score</div>
                  <div className="text-base font-semibold">
                    <span className={`px-2 py-1 rounded text-sm ${
                      (scanResult.vettingScore || 0) >= 70 ? 'bg-green-100 text-green-800' :  // 70-100 = Low Risk (safe)
                      (scanResult.vettingScore || 0) >= 40 ? 'bg-yellow-100 text-yellow-800' : // 40-69 = Medium Risk (moderate)
                      'bg-red-100 text-red-800'  // 0-39 = High Risk (dangerous)
                    }`}>
                      {scanResult.vettingScore?.toFixed(1) || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="border rounded p-3">
                  <div className="text-sm text-gray-500">Tier</div>
                  <div className="text-base font-semibold">{scanResult.vettingTier}</div>
                </div>
              </div>

              {scanResult.details && (
                <div className="border rounded p-3">
                  <div className="text-sm text-gray-700 font-semibold mb-2">Summary</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-500">Name:</span> {pick(scanResult.details, 'metadata.token_name')}</div>
                    <div><span className="text-gray-500">Symbol:</span> {pick(scanResult.details, 'metadata.token_symbol')}</div>
                    <div><span className="text-gray-500">Age:</span> {pick(scanResult.details, 'metadata.age_display') !== '—' ? pick(scanResult.details, 'metadata.age_display') : pick(scanResult.details, 'metadata.age_display_short')}</div>
                    <div><span className="text-gray-500">LP Security:</span> {(() => {
                      const locked = get(scanResult.details, 'metadata.lp_amount_usd');
                      return locked !== undefined ? formatCurrency(locked) : pick(scanResult.details, 'metadata.lp_locked');
                    })()}</div>
                    <div><span className="text-gray-500">Holders:</span> {(() => {
                      const holders = get(scanResult.details, 'metadata.holder_count');
                      return Number.isFinite(Number(holders)) ? Number(holders).toLocaleString() : '—';
                    })()}</div>
                    <div><span className="text-gray-500">Market Cap:</span> {formatCurrency(get(scanResult.details, 'metadata.market_cap'))}</div>
                    <div><span className="text-gray-500">24h Volume:</span> {formatCurrency(get(scanResult.details, 'metadata.volume_24h'))}</div>
                    <div><span className="text-gray-500">Created At:</span> {formatDate(get(scanResult.details, 'metadata.creation_date'))}</div>
                    <div><span className="text-gray-500">DEX Pair:</span> {pick(scanResult.details, 'metadata.pair_address')}</div>
                  </div>
                  {/* If backend attaches a message for unqualified */}
                  {pick(scanResult.details, 'message') !== '—' && (
                    <div className="mt-3 text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                      {String(pick(scanResult.details, 'message'))}
                    </div>
                  )}
                </div>
              )}

              {!scanResult.eligible && (
                <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  Token does not meet minimum criteria for any tier. You can review details and provide a roadmap, but saving as draft or publishing will require a sufficient vetting score.
                </div>
              )}

              <div className="flex gap-2">
                <button className="px-3 py-1 border rounded" onClick={() => setStep(1)}>Back</button>
                <button className="px-3 py-1 border rounded bg-blue-600 text-white" onClick={() => setStep(3)}>Continue to Details</button>
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-600">No scan result. Go back and scan a token.</div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 bg-white p-4 rounded border">
          <div>
            <label className="block text-sm mb-1">Title</label>
            <input className="border rounded px-3 py-2 w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title"/>
          </div>
          <div>
            <label className="block text-sm mb-1">Description</label>
            <textarea className="border rounded px-3 py-2 w-full" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your project"/>
          </div>
          <div>
            <label className="block text-sm mb-1">Bio (short)</label>
            <input className="border rounded px-3 py-2 w-full" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1" htmlFor="logo-upload">Logo</label>
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={onLogoFileChange} 
                  disabled={logoUploading}
                  aria-label="Upload logo image"
                  id="logo-upload" 
                />
                {logoUploading && <span className="text-xs text-gray-500">Uploading...</span>}
              </div>
              {logoUrl && (
                <div className="mt-2 text-xs text-gray-500">Preview updated</div>
              )}
            </div>
            <div>
              <label className="block text-sm mb-1" htmlFor="banner-upload">Banner (3:1)</label>
              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={onBannerFileChange} 
                  disabled={bannerUploading}
                  aria-label="Upload banner image (3:1 ratio)"
                  id="banner-upload" 
                />
                {bannerUploading && <span className="text-xs text-gray-500">Uploading...</span>}
              </div>
              {bannerUrl && (
                <div className="mt-2 text-xs text-gray-500">Preview updated</div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Website</label>
              <input className="border rounded px-3 py-2 w-full" value={links.website} onChange={(e) => setLinks({ ...links, website: e.target.value })} placeholder="https://..."/>
            </div>
            <div>
              <label className="block text-sm mb-1">Twitter/X</label>
              <input className="border rounded px-3 py-2 w-full" value={links.twitter} onChange={(e) => setLinks({ ...links, twitter: e.target.value })} placeholder="https://twitter.com/..."/>
            </div>
            <div>
              <label className="block text-sm mb-1">Telegram</label>
              <input className="border rounded px-3 py-2 w-full" value={links.telegram} onChange={(e) => setLinks({ ...links, telegram: e.target.value })} placeholder="https://t.me/..."/>
            </div>
            <div>
              <label className="block text-sm mb-1">Discord</label>
              <input className="border rounded px-3 py-2 w-full" value={links.discord} onChange={(e) => setLinks({ ...links, discord: e.target.value })} placeholder="https://discord.gg/..."/>
            </div>
          </div>

          <div className="flex gap-2">
            <button className="px-3 py-1 border rounded" onClick={() => setStep(2)}>Back</button>
            <button className="px-3 py-1 border rounded" onClick={handleContinueFromDetails}>Continue</button>
            <button
              className="px-4 py-2 rounded bg-purple-600 text-white disabled:opacity-50"
              onClick={handleCreateDraft}
              disabled={loading || !title || !description || !(scanResult?.eligible)}
              title={!(scanResult?.eligible) ? 'Increase vetting score to save draft' : undefined}
            >
              Save Draft
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4 bg-white p-4 rounded border">
          <div>
            <label className="block text-sm mb-1">Roadmap Title</label>
            <input className="border rounded px-3 py-2 w-full" value={roadmapTitle} onChange={(e) => setRoadmapTitle(e.target.value)} placeholder="e.g., Aptos NFT Artist for Hire"/>
          </div>
          <div>
            <label className="block text-sm mb-1">Roadmap Description</label>
            <textarea className="border rounded px-3 py-2 w-full" rows={5} value={roadmapDescription} onChange={(e) => setRoadmapDescription(e.target.value)} placeholder="Explain your plan"/>
          </div>
          <div>
            <label className="block text-sm mb-1">Additional Links (comma separated)</label>
            <input className="border rounded px-3 py-2 w-full" value={roadmapLinks} onChange={(e) => setRoadmapLinks(e.target.value)} placeholder="https://... , https://..."/>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 border rounded" onClick={() => setStep(3)}>Back</button>
            <button 
              className="px-4 py-2 rounded bg-green-600 text-white" 
              onClick={handlePublish} 
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Listing (Payment Required Next)'}
            </button>
          </div>
          
          {/* Payment Info Notice */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-4">
            <p className="text-sm text-blue-700">
              <strong>💡 Next Step:</strong> After clicking submit, you'll be redirected to pay 50 USDC to publish your listing.
            </p>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="bg-white p-6 rounded border text-center">
          <h2 className="text-xl font-semibold mb-2">Listing Published 🎉</h2>
          <p className="text-gray-600 mb-4">Your user listing is now live.</p>
          <div className="flex gap-2 justify-center">
            <button className="px-3 py-1 border rounded" onClick={reset}>Create Another</button>
            <button className="px-3 py-1 border rounded bg-blue-600 text-white" onClick={() => navigate(ROUTES.myUserListings)}>Go to My Listings</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateUserListing;