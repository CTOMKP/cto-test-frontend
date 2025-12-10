/**
 * PFP (Profile Picture) Generation Service
 * Generates unique profile pictures based on user wallet address or email
 * Uses DiceBear API for avatar generation
 */

export type AvatarStyle = 
  | 'adventurer'
  | 'avataaars'
  | 'bottts'
  | 'croodles'
  | 'identicon'
  | 'lorelei'
  | 'micah'
  | 'miniavs'
  | 'pixel-art'
  | 'thumbs';

export interface PFPOptions {
  style?: AvatarStyle;
  size?: number;
  seed?: string; // User's wallet address or email
  backgroundColor?: string;
  radius?: number;
}

export interface GeneratedPFP {
  url: string;
  dataUrl?: string;
  downloadUrl: string;
  shareUrl: string;
  seed: string;
  style: AvatarStyle;
}

class PFPService {
  private readonly DICEBEAR_BASE = 'https://api.dicebear.com/7.x';
  private readonly DEFAULT_SIZE = 256;
  private readonly DEFAULT_STYLE: AvatarStyle = 'avataaars';

  /**
   * Generate a profile picture URL
   */
  generatePFP(options: PFPOptions): GeneratedPFP {
    const {
      style = this.DEFAULT_STYLE,
      size = this.DEFAULT_SIZE,
      seed = this.generateRandomSeed(),
      backgroundColor = 'transparent',
      radius = 50,
    } = options;

    // Build DiceBear URL
    const params = new URLSearchParams({
      seed: seed,
      size: size.toString(),
      backgroundColor: backgroundColor,
      radius: radius.toString(),
    });

    const url = `${this.DICEBEAR_BASE}/${style}/svg?${params.toString()}`;
    const downloadUrl = `${this.DICEBEAR_BASE}/${style}/png?${params.toString()}`;

    return {
      url,
      downloadUrl,
      shareUrl: url,
      seed,
      style,
    };
  }

  /**
   * Generate PFP from wallet address
   */
  generateFromWallet(walletAddress: string, style?: AvatarStyle, size?: number): GeneratedPFP {
    return this.generatePFP({
      seed: walletAddress,
      style,
      size,
    });
  }

  /**
   * Generate PFP from user email
   */
  generateFromEmail(email: string, style?: AvatarStyle, size?: number): GeneratedPFP {
    return this.generatePFP({
      seed: email,
      style,
      size,
    });
  }

  /**
   * Generate PFP from user ID
   */
  generateFromUserId(userId: string, style?: AvatarStyle, size?: number): GeneratedPFP {
    return this.generatePFP({
      seed: userId,
      style,
      size,
    });
  }

  /**
   * Get data URL for embedding in HTML
   */
  async getPFPDataUrl(pfp: GeneratedPFP): Promise<string> {
    try {
      const response = await fetch(pfp.url);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to get PFP data URL:', error);
      throw error;
    }
  }

  /**
   * Download PFP as PNG
   */
  async downloadPFP(pfp: GeneratedPFP, filename?: string): Promise<void> {
    try {
      const response = await fetch(pfp.downloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `pfp-${pfp.seed}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PFP:', error);
      throw error;
    }
  }

  /**
   * Share PFP on social media
   */
  sharePFP(pfp: GeneratedPFP, platform: 'twitter' | 'facebook' | 'telegram'): void {
    const shareText = `Check out my CTO Marketplace profile picture!`;
    const shareUrl = pfp.shareUrl;

    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    };

    window.open(shareUrls[platform], '_blank', 'width=600,height=400');
  }

  /**
   * Copy PFP URL to clipboard
   */
  async copyPFPUrl(pfp: GeneratedPFP): Promise<void> {
    try {
      await navigator.clipboard.writeText(pfp.url);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = pfp.url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  /**
   * Get all available avatar styles
   */
  getAvailableStyles(): AvatarStyle[] {
    return [
      'adventurer',
      'avataaars',
      'bottts',
      'croodles',
      'identicon',
      'lorelei',
      'micah',
      'miniavs',
      'pixel-art',
      'thumbs',
    ];
  }

  /**
   * Generate a random seed for anonymous users
   */
  private generateRandomSeed(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Preview multiple styles for a user
   */
  previewStyles(seed: string): GeneratedPFP[] {
    const styles = this.getAvailableStyles();
    return styles.map(style => this.generatePFP({ seed, style, size: 128 }));
  }

  /**
   * Save/Upload PFP to user profile (calls new backend endpoint)
   * Accepts either a File (for upload) or imageUrl (for existing URLs)
   */
  async savePFP(imageFileOrUrl: File | string, userId?: string): Promise<{ success: boolean; message?: string; imageUrl?: string }> {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';
      const token = localStorage.getItem('cto_auth_token');
      
      if (!token) {
        throw new Error('No authentication token');
      }

      let imageUrl: string;

      // If it's a File, upload it first using presigned URL
      if (imageFileOrUrl instanceof File) {
        if (!userId) {
          const userIdFromStorage = localStorage.getItem('cto_user_id');
          if (!userIdFromStorage) {
            throw new Error('User ID is required for file upload');
          }
          userId = userIdFromStorage;
        }

        // Use the same upload flow as ProfilePage
        if (!imageFileOrUrl.type.startsWith('image/')) {
          throw new Error('Only image files are allowed');
        }
        if (imageFileOrUrl.size > 10 * 1024 * 1024) {
          throw new Error('Image must be 10MB or less');
        }

        // 1) Get presigned upload URL
        const presignRes = await fetch(`${backendUrl}/api/images/presign`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'profile',
            userId: userId,
            filename: imageFileOrUrl.name,
            mimeType: imageFileOrUrl.type,
            size: imageFileOrUrl.size,
          }),
        });

        if (!presignRes.ok) {
          throw new Error('Failed to get presigned upload URL');
        }

        const presignData = await presignRes.json();
        const { uploadUrl, key } = presignData || {};
        if (!uploadUrl || !key) {
          throw new Error('Failed to get presigned upload URL');
        }

        // 2) Upload directly to storage (S3) via presigned PUT
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': imageFileOrUrl.type },
          body: imageFileOrUrl,
        });

        if (!putRes.ok) {
          throw new Error(`Upload failed with status ${putRes.status}`);
        }

        // 3) Use server redirect endpoint for stable reads
        imageUrl = `${backendUrl}/api/images/view/${key}`;
      } else {
        // It's already a URL string
        imageUrl = imageFileOrUrl;
      }

      // Save the image URL to user profile using new PFP endpoint
      const response = await fetch(`${backendUrl}/api/pfp/save`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save PFP' }));
        throw new Error(errorData.message || 'Failed to save PFP');
      }

      const result = await response.json();

      if (result.success) {
        // Store in localStorage for quick access
        localStorage.setItem('profile_avatar_url', imageUrl);
        localStorage.setItem('cto_user_avatar_url', imageUrl);
        
        return {
          success: true,
          message: result.message || 'PFP saved successfully',
          imageUrl,
        };
      }

      throw new Error(result.message || 'Failed to save PFP');
    } catch (error: unknown) {
      console.error('Failed to save PFP:', error);
      let message = 'Failed to save PFP';
      if (error instanceof Error) {
        message = error.message || message;
      }
      throw new Error(message);
    }
  }
}

export const pfpService = new PFPService();


