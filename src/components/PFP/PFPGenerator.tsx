import React, { useState, useEffect } from 'react';
import { pfpService, GeneratedPFP, AvatarStyle } from '../../services/pfpService';
import { useAuth } from '../../hooks/useAuth';
import { useCircleWallet } from '../../hooks/useCircleWallet';
import toast from 'react-hot-toast';

export const PFPGenerator: React.FC = () => {
  const { user } = useAuth();
  const { wallet } = useCircleWallet();
  
  const [currentPFP, setCurrentPFP] = useState<GeneratedPFP | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<AvatarStyle>('avataaars');
  const [previewPFPs, setPreviewPFPs] = useState<GeneratedPFP[]>([]);
  const [showStylePicker, setShowStylePicker] = useState(false);

  // Generate initial PFP on mount
  useEffect(() => {
    if (wallet?.address) {
      const pfp = pfpService.generateFromWallet(wallet.address, selectedStyle);
      setCurrentPFP(pfp);
    } else if (user?.email) {
      const pfp = pfpService.generateFromEmail(user.email, selectedStyle);
      setCurrentPFP(pfp);
    }
  }, [wallet?.address, user?.email, selectedStyle]);

  // Generate style previews
  const handleShowStylePicker = () => {
    const seed = wallet?.address || user?.email || 'demo';
    const previews = pfpService.previewStyles(seed);
    setPreviewPFPs(previews);
    setShowStylePicker(true);
  };

  const handleStyleSelect = (style: AvatarStyle) => {
    setSelectedStyle(style);
    setShowStylePicker(false);
    toast.success(`Style changed to ${style}!`);
  };

  const handleDownload = async () => {
    if (!currentPFP) return;
    
    try {
      await pfpService.downloadPFP(currentPFP, `cto-pfp-${Date.now()}.png`);
      toast.success('PFP downloaded successfully!');
    } catch (error) {
      toast.error('Failed to download PFP');
    }
  };

  const handleCopyUrl = async () => {
    if (!currentPFP) return;
    
    try {
      await pfpService.copyPFPUrl(currentPFP);
      toast.success('PFP URL copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy URL');
    }
  };

  const handleShare = (platform: 'twitter' | 'facebook' | 'telegram') => {
    if (!currentPFP) return;
    pfpService.sharePFP(currentPFP, platform);
  };

  const handleRegenerate = () => {
    const seed = `${wallet?.address || user?.email || 'demo'}-${Date.now()}`;
    const pfp = pfpService.generatePFP({ seed, style: selectedStyle });
    setCurrentPFP(pfp);
    toast.success('New PFP generated!');
  };

  if (!currentPFP) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          🎨 Your Profile Picture
        </h2>
        <p className="text-gray-600">
          Generate a unique avatar based on your wallet address
        </p>
      </div>

      {/* Main PFP Display */}
      <div className="flex flex-col items-center mb-8">
        <div className="relative mb-6">
          <img
            src={currentPFP.url}
            alt="Your Profile Picture"
            className="w-64 h-64 rounded-full shadow-xl border-4 border-blue-500"
          />
          <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
            {selectedStyle}
          </div>
        </div>

        {/* Wallet/Email Info */}
        <div className="text-center text-sm text-gray-500 mb-4">
          <p>Generated from:</p>
          <p className="font-mono text-xs break-all max-w-md">
            {wallet?.address || user?.email || 'Demo'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 justify-center mb-6">
          <button
            onClick={handleShowStylePicker}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <span>🎨</span>
            Change Style
          </button>

          <button
            onClick={handleRegenerate}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <span>🔄</span>
            Regenerate
          </button>

          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <span>📥</span>
            Download
          </button>

          <button
            onClick={handleCopyUrl}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <span>📋</span>
            Copy URL
          </button>
        </div>

        {/* Share Buttons */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => handleShare('twitter')}
            className="px-4 py-2 bg-[#1DA1F2] text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <span>𝕏</span>
            Share on X
          </button>

          <button
            onClick={() => handleShare('telegram')}
            className="px-4 py-2 bg-[#0088cc] text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <span>📱</span>
            Telegram
          </button>

          <button
            onClick={() => handleShare('facebook')}
            className="px-4 py-2 bg-[#1877F2] text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <span>👥</span>
            Facebook
          </button>
        </div>
      </div>

      {/* Style Picker Modal */}
      {showStylePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Choose Your Style</h3>
              <button
                onClick={() => setShowStylePicker(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {previewPFPs.map((pfp) => (
                <div
                  key={pfp.style}
                  onClick={() => handleStyleSelect(pfp.style)}
                  className={`cursor-pointer rounded-lg p-3 border-2 transition-all hover:shadow-lg ${
                    selectedStyle === pfp.style
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <img
                    src={pfp.url}
                    alt={pfp.style}
                    className="w-full aspect-square rounded-lg mb-2"
                  />
                  <p className="text-center text-sm font-medium text-gray-700 capitalize">
                    {pfp.style}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">💡 About Your PFP</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✅ Unique to your wallet address</li>
          <li>✅ Same address = same PFP across devices</li>
          <li>✅ 10+ styles to choose from</li>
          <li>✅ Download as PNG for social media</li>
          <li>✅ Share with friends easily</li>
        </ul>
      </div>
    </div>
  );
};






