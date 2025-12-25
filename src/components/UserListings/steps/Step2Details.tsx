import React, { useState, useEffect } from 'react';
import { Globe, Plus, Upload } from 'lucide-react';
import userListingsService, { ScanResult, CreateUserListingPayload } from '../../../services/userListingsService';
import toast from 'react-hot-toast';
import axios from 'axios';

interface Step2DetailsProps {
  scanResults: ScanResult | null;
  contractAddress: string;
  chain: string;
  onDraftCreated?: (draftId: string) => void;
  setCurrentStep: (step: number) => void;
}

export default function Step2Details({
  scanResults,
  contractAddress,
  chain,
  onDraftCreated,
  setCurrentStep,
}: Step2DetailsProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bio, setBio] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [links, setLinks] = useState({
    website: '',
    twitter: '',
    telegram: '',
    discord: '',
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [profilePreview, setProfilePreview] = useState<string>('');
  const [bannerPreview, setBannerPreview] = useState<string>('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';
  const authHeaders = () => {
    const token = localStorage.getItem('cto_auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Presigned upload helper
  const uploadViaPresign = async (
    kind: 'generic' | 'profile' | 'banner',
    file: File,
    opts?: { projectId?: string; userId?: string }
  ): Promise<{ viewUrl: string; key: string; metadata: any }> => {
    if (!file.type.startsWith('image/')) throw new Error('Only image files are allowed');
    if (file.size > 10 * 1024 * 1024) throw new Error('Image must be 10MB or less');

    // 1) Ask backend for presigned upload URL
    const presignRes = await axios.post(
      `${backendUrl}/api/v1/images/presign`,
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

    // Handle wrapped response
    const presignData = presignRes.data?.data || presignRes.data;
    const { uploadUrl, key, metadata } = presignData || {};
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

    // 3) Always use backend redirect endpoint for stable reads
    const viewUrl = `${backendUrl}/api/v1/images/view/${key}`;
    return { viewUrl, key, metadata };
  };

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLogoUploading(true);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload image (draft will be created on Continue button click)
      const { viewUrl } = await uploadViaPresign('generic', file);
      setLogoUrl(viewUrl);
      
      toast.success('Logo uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload logo');
      setProfilePreview('');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setBannerUploading(true);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Upload image (draft will be created on Continue button click)
      const { viewUrl } = await uploadViaPresign('generic', file);
      setBannerUrl(viewUrl);
      toast.success('Banner uploaded');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload banner');
      setBannerPreview('');
    } finally {
      setBannerUploading(false);
    }
  };

  const handleContinue = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error('Please fill in title and description');
      return;
    }

    if (!scanResults?.eligible) {
      toast.error('Token did not pass vetting. Cannot create listing.');
      return;
    }

    if (!contractAddress || !chain) {
      toast.error('Missing contract address or chain. Please go back and scan again.');
      return;
    }

    try {
      setIsSaving(true);
      
      let currentDraftId = draftId || localStorage.getItem('cto_draft_listing_id');
      
      const payload: CreateUserListingPayload = {
        contractAddr: contractAddress,
        chain: chain,
        title: title.trim(),
        description: description.trim(),
        bio: bio.trim() || undefined,
        logoUrl: logoUrl || undefined,
        bannerUrl: bannerUrl || undefined,
        links: {
          website: links.website.trim() || undefined,
          twitter: links.twitter.trim() || undefined,
          telegram: links.telegram.trim() || undefined,
          discord: links.discord.trim() || undefined,
        },
        vettingTier: scanResults.vettingTier || scanResults.tier || 'UNQUALIFIED',
        vettingScore: scanResults.vettingScore ?? scanResults.risk_score ?? 0,
      };

      if (currentDraftId) {
        // Update existing draft (TypeScript knows currentDraftId is string here due to the if check)
        await userListingsService.update(currentDraftId as string, payload);
      } else {
        // Create new draft
        const createRes = await userListingsService.create(payload);
        if (createRes?.success && createRes?.data?.id) {
          const newDraftId: string = createRes.data.id as string;
          currentDraftId = newDraftId;
          setDraftId(newDraftId);
          localStorage.setItem('cto_draft_listing_id', newDraftId);
          if (onDraftCreated) {
            onDraftCreated(newDraftId);
          }
        } else {
          throw new Error('Failed to create draft');
        }
      }

      toast.success('Draft saved successfully');
      setCurrentStep(3);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile Picture */}
      <div>
        <label htmlFor="profile-picture" className="font-medium">
          Upload Profile picture
          <span className="text-[#FF3939]">*</span>
        </label>
        <div className="flex flex-col mt-4">
          <span
            className="size-[114px] bg-[#141414] flex items-center justify-center rounded-[3px] cursor-pointer border border-white/20 hover:border-white/40 transition-colors"
            onClick={() => document.getElementById('profile-picture')?.click()}
          >
            {profilePreview || logoUrl ? (
              <img
                src={profilePreview || logoUrl}
                alt="preview"
                className="w-full h-full object-cover rounded-[3px]"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 justify-center">
                <Upload size={16} color="#FFFFFF70" />
                <p className="text-[8px] font-light text-white/70 text-center">
                  Upload Square image
                  <br />
                  <span>(1:1, min 400x400px)</span>
                </p>
              </div>
            )}
          </span>

          <input
            id="profile-picture"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleProfilePictureChange}
            disabled={logoUploading}
          />
          {logoUploading && (
            <span className="text-xs text-white/50 mt-2">Uploading...</span>
          )}
        </div>
      </div>

      {/* Banner */}
      <div>
        <label htmlFor="banner" className="font-medium">
          Banner
          <span className="text-[#FF3939]">*</span>
        </label>
        <ul className="mt-1.5 text-xs text-white/70 list-disc ml-4">
          <li>3:1 aspect ratio (rectangle, for example 600x200px or 1500x500px)</li>
          <li>min. image width: 600px</li>
          <li>support formats: png, jpg, webp and gif</li>
          <li>max. file size: 4.5MB</li>
        </ul>

        <div className="flex flex-col mt-4">
          <span
            className="w-full h-[136px] border-[0.2px] border-white bg-[#141414] flex items-center justify-center rounded-[3px] cursor-pointer hover:border-white/40 transition-colors"
            style={{
              border: '1px solid transparent',
              background: `
                linear-gradient(#141414, #141414) padding-box,
                repeating-linear-gradient(45deg, gray 0, gray 10px, transparent 10px, transparent 20px) border-box
              `,
              borderRadius: '3px',
            }}
            onClick={() => document.getElementById('banner')?.click()}
          >
            {bannerPreview || bannerUrl ? (
              <img
                src={bannerPreview || bannerUrl}
                alt="preview"
                className="w-full h-full object-cover rounded-[3px]"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 justify-center">
                <Upload size={20} color="#FFFFFF70" />
                <p className="text-center font-bold text-white/70">
                  Drag & drop files or{' '}
                  <span className="bg-gradient-to-r from-[#FF0075] via-[#FF4A15] to-[#FFCB45] bg-clip-text text-transparent">
                    Browse
                  </span>
                  <br />
                  <span className="text-sm font-normal">
                    Supported formats JPEG,PNG
                  </span>
                </p>
              </div>
            )}
          </span>

          <input
            id="banner"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBannerChange}
            disabled={bannerUploading}
          />
          {bannerUploading && (
            <span className="text-xs text-white/50 mt-2">Uploading...</span>
          )}
        </div>
      </div>

      {/* Bio */}
      <div>
        <label htmlFor="bio" className="font-medium">
          Bio
          <span className="text-[#FF3939]">*</span>
        </label>
        <input
          id="bio"
          type="text"
          placeholder="Brief description..."
          className="bg-white/5 border-[0.2px] h-12 mt-4 rounded-lg border-white/20 w-full px-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-pink-500"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>

      {/* Title */}
      <div>
        <label htmlFor="title" className="font-medium">
          Title
          <span className="text-[#FF3939]">*</span>
        </label>
        <input
          id="title"
          type="text"
          placeholder="Project title..."
          className="bg-white/5 border-[0.2px] h-12 mt-4 rounded-lg border-white/20 w-full px-3 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-pink-500"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="font-medium">
          Description
          <span className="text-[#FF3939]">*</span>
        </label>
        <textarea
          id="description"
          placeholder="Describe your project..."
          className="bg-white/5 border-[0.2px] h-auto mt-4 rounded-lg border-white/20 p-3 w-full text-white placeholder:text-white/50 resize-none focus:outline-none focus:ring-2 focus:ring-pink-500"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Social Media Links */}
      <div>
        <label className="font-medium">Social media</label>
        <p className="text-xs text-white/70 mt-1.5 mb-4">
          Add your social media links
        </p>

        <div className="grid grid-cols-2 gap-2 w-full">
          <div className="flex flex-col">
            <label className="text-xs text-white/50 mb-1">X (Twitter)</label>
            <input
              type="url"
              placeholder="https://twitter.com/..."
              className="bg-white/5 border-[0.2px] h-12 rounded-lg border-white/20 px-3 text-white placeholder:text-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              value={links.twitter}
              onChange={(e) => setLinks({ ...links, twitter: e.target.value })}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-white/50 mb-1">Telegram</label>
            <input
              type="url"
              placeholder="https://t.me/..."
              className="bg-white/5 border-[0.2px] h-12 rounded-lg border-white/20 px-3 text-white placeholder:text-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              value={links.telegram}
              onChange={(e) => setLinks({ ...links, telegram: e.target.value })}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-white/50 mb-1">Website</label>
            <input
              type="url"
              placeholder="https://..."
              className="bg-white/5 border-[0.2px] h-12 rounded-lg border-white/20 px-3 text-white placeholder:text-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              value={links.website}
              onChange={(e) => setLinks({ ...links, website: e.target.value })}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-white/50 mb-1">Discord</label>
            <input
              type="url"
              placeholder="https://discord.gg/..."
              className="bg-white/5 border-[0.2px] h-12 rounded-lg border-white/20 px-3 text-white placeholder:text-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500"
              value={links.discord}
              onChange={(e) => setLinks({ ...links, discord: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Continue Button */}
      <button
        onClick={handleContinue}
        disabled={isSaving || !title.trim() || !description.trim() || !scanResults?.eligible}
        className="font-medium w-full gap-2 bg-gradient-to-r from-[#FF0075] via-[#FF4A15] to-[#FFCB45] rounded-lg h-9 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? 'Saving...' : 'Continue'}
      </button>
    </div>
  );
}



