import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCircleWallet } from '../../hooks/useCircleWallet';
import { pfpService } from '../../services/pfpService';
import toast from 'react-hot-toast';

// Mascot traits matching actual images
type TraitType = 
  | 'ARTIST' | 'ARTIST2' | 'ARTIST3'
  | 'CTO' | 'CTO2'
  | 'DEGEN' | 'DEGEN2'
  | 'DEV'
  | 'EARLYADT.WHALE'
  | 'HACKER' | 'HACKER2' | 'HACKER3'
  | 'HODLER'
  | 'KOL'
  | 'MOD' | 'MOD2' | 'MOD3'
  | 'NEWBIE'
  | 'SHILLER'
  | 'VISIONARY' | 'VISIONARY2'
  | 'WHALE' | 'WHALE2' | 'WHALE3';

type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

// Trait metadata
const TRAIT_INFO: Record<TraitType, { name: string; rarity: Rarity; description: string }> = {
  'NEWBIE': { name: 'Newbie', rarity: 'Common', description: 'Just getting started in crypto' },
  'HODLER': { name: 'Hodler', rarity: 'Common', description: 'Diamond hands forever' },
  'SHILLER': { name: 'Shiller', rarity: 'Common', description: 'Always promoting the next big thing' },
  'DEV': { name: 'Developer', rarity: 'Uncommon', description: 'Building the future of Web3' },
  'ARTIST': { name: 'Artist', rarity: 'Uncommon', description: 'Creating beautiful NFTs' },
  'ARTIST2': { name: 'Artist II', rarity: 'Rare', description: 'Master of digital art' },
  'ARTIST3': { name: 'Artist III', rarity: 'Epic', description: 'Legendary NFT creator' },
  'MOD': { name: 'Moderator', rarity: 'Uncommon', description: 'Keeping the community safe' },
  'MOD2': { name: 'Moderator II', rarity: 'Rare', description: 'Trusted community guardian' },
  'MOD3': { name: 'Moderator III', rarity: 'Epic', description: 'Elite community leader' },
  'DEGEN': { name: 'Degen', rarity: 'Rare', description: 'Risk-taking crypto enthusiast' },
  'DEGEN2': { name: 'Degen II', rarity: 'Epic', description: 'Master of high-risk plays' },
  'KOL': { name: 'KOL', rarity: 'Rare', description: 'Key Opinion Leader in crypto' },
  'HACKER': { name: 'Hacker', rarity: 'Rare', description: 'Security expert and builder' },
  'HACKER2': { name: 'Hacker II', rarity: 'Epic', description: 'Elite smart contract auditor' },
  'HACKER3': { name: 'Hacker III', rarity: 'Legendary', description: 'Legendary blockchain architect' },
  'CTO': { name: 'CTO', rarity: 'Epic', description: 'Chief Technology Officer' },
  'CTO2': { name: 'CTO II', rarity: 'Legendary', description: 'Visionary tech leader' },
  'VISIONARY': { name: 'Visionary', rarity: 'Epic', description: 'Sees the future of crypto' },
  'VISIONARY2': { name: 'Visionary II', rarity: 'Legendary', description: 'Legendary crypto prophet' },
  'WHALE': { name: 'Whale', rarity: 'Epic', description: 'Major market player' },
  'WHALE2': { name: 'Whale II', rarity: 'Legendary', description: 'Legendary whale with massive holdings' },
  'WHALE3': { name: 'Whale III', rarity: 'Legendary', description: 'Mythical market mover' },
  'EARLYADT.WHALE': { name: 'Early Adopter Whale', rarity: 'Legendary', description: 'OG crypto whale' },
};

interface MascotCard {
  id: string;
  trait: TraitType;
  name: string;
  rarity: Rarity;
  description: string;
  compositeImage: string; // Data URL of the layered image
}

interface CardRevealProps {
  onClose: () => void;
}

export const CardReveal: React.FC<CardRevealProps> = ({ onClose }) => {
  const { user } = useAuth();
  const { wallet } = useCircleWallet();
  const [isRevealing, setIsRevealing] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [mascotCard, setMascotCard] = useState<MascotCard | null>(null);

  // Generate composite image from layers
  const createCompositeImage = async (traitType: TraitType): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject('Canvas not supported');
        return;
      }

      // Set canvas size
      canvas.width = 800;
      canvas.height = 800;

      const images = {
        stage: new Image(),
        baseSkin: new Image(),
        trait: new Image(),
      };

      let loadedCount = 0;
      const totalImages = 3;

      const onImageLoad = () => {
        loadedCount++;
        if (loadedCount === totalImages) {
          // Draw layers in order: stage -> base skin -> trait
          ctx.drawImage(images.stage, 0, 0, canvas.width, canvas.height);
          ctx.drawImage(images.baseSkin, 0, 0, canvas.width, canvas.height);
          ctx.drawImage(images.trait, 0, 0, canvas.width, canvas.height);
          
          resolve(canvas.toDataURL('image/png'));
        }
      };

      const onImageError = () => {
        console.error('Failed to load mascot image');
        reject('Failed to load mascot images');
      };

      // Load all images
      images.stage.onload = onImageLoad;
      images.stage.onerror = onImageError;
      images.stage.src = '/mascots/STAGE/STAGE.png';

      images.baseSkin.onload = onImageLoad;
      images.baseSkin.onerror = onImageError;
      images.baseSkin.src = '/mascots/SKIN/BASE SKIN.png';

      images.trait.onload = onImageLoad;
      images.trait.onerror = onImageError;
      images.trait.src = `/mascots/TRAITS/${traitType}.png`;
    });
  };

  // Generate mascot based on wallet address + timestamp + random
  const generateMascot = async (): Promise<MascotCard> => {
    const baseSeed = wallet?.address || user?.email || 'demo';
    const timestamp = Date.now();
    const random = Math.random() * 1000000;
    const seed = `${baseSeed}_${timestamp}_${random}`;
    const seedHash = seed.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);

    // All available traits
    const allTraits: TraitType[] = Object.keys(TRAIT_INFO) as TraitType[];
    
    // Select trait based on weighted rarity
    const rarityRoll = Math.abs(seedHash) % 100;
    let targetRarity: Rarity;
    if (rarityRoll < 40) targetRarity = 'Common'; // 40%
    else if (rarityRoll < 65) targetRarity = 'Uncommon'; // 25%
    else if (rarityRoll < 82) targetRarity = 'Rare'; // 17%
    else if (rarityRoll < 94) targetRarity = 'Epic'; // 12%
    else targetRarity = 'Legendary'; // 6%

    // Filter traits by rarity
    const traitsOfRarity = allTraits.filter(t => TRAIT_INFO[t].rarity === targetRarity);
    const selectedTrait = traitsOfRarity[Math.abs(seedHash >> 2) % traitsOfRarity.length];
    
    const traitInfo = TRAIT_INFO[selectedTrait];
    
    // Generate composite image
    const compositeImage = await createCompositeImage(selectedTrait);

    return {
      id: `mascot_${Date.now()}`,
      trait: selectedTrait,
      name: traitInfo.name,
      rarity: traitInfo.rarity,
      description: traitInfo.description,
      compositeImage,
    };
  };

  const handleReveal = async () => {
    setIsRevealing(true);
    try {
      const mascot = await generateMascot();
      setMascotCard(mascot);
      
      // Animation delay
      setTimeout(() => {
        setIsRevealed(true);
        toast.success(`🎉 You got a ${mascot.rarity} ${mascot.name}!`);
      }, 2000);
    } catch (error) {
      console.error('Failed to generate mascot:', error);
      toast.error('Failed to generate mascot. Please try again.');
      setIsRevealing(false);
    }
  };

  // Auto-save PFP when mascot is revealed
  useEffect(() => {
    const handleSavePFP = async () => {
      if (!mascotCard || !isRevealed) return;

      try {
        // Convert data URL to File
        const dataUrl = mascotCard.compositeImage;
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `mascot-${mascotCard.id}.png`, { type: 'image/png' });

        // Get user ID from localStorage
        const userId = localStorage.getItem('cto_user_id');

        // Save PFP automatically
        const result = await pfpService.savePFP(file, userId || undefined);
        
        if (result.success) {
          console.log('✅ PFP auto-saved successfully:', result.imageUrl);
          toast.success('🎉 Profile picture saved automatically!');
        }
      } catch (error) {
        console.error('Failed to auto-save PFP:', error);
        // Don't show error toast - just log it, as the user can still use the mascot
      }
    };

    // Trigger auto-save when mascot is revealed
    if (isRevealed && mascotCard) {
      handleSavePFP();
    }
  }, [mascotCard, isRevealed]);

  const handleShare = (platform: 'twitter' | 'facebook' | 'telegram') => {
    if (!mascotCard) return;
    
    const shareText = `🎉 I just got my CTO Marketplace mascot: ${mascotCard.name} (${mascotCard.rarity})! Check out my unique profile picture!`;
    const shareUrl = window.location.origin;
    
    const shareUrls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    };

    window.open(shareUrls[platform], '_blank', 'width=600,height=400');
  };

  const handleDownload = () => {
    if (!mascotCard) return;
    
    const link = document.createElement('a');
    link.download = `cto-mascot-${mascotCard.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = mascotCard.compositeImage;
    link.click();
    
    toast.success('Mascot card downloaded!');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">🎴 Your Mascot Card</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Card Container */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            {/* Card Back (Before Reveal) */}
            {!isRevealed && (
              <div className={`w-80 h-96 rounded-xl border-4 border-pink-500 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center transition-all duration-1000 ${isRevealing ? 'animate-spin' : ''}`}>
                <div className="text-center">
                  <div className="text-6xl mb-4">🎴</div>
                  <div className="text-white text-xl font-bold">Mystery Card</div>
                  <div className="text-gray-400 text-sm">Click to reveal your mascot!</div>
                </div>
              </div>
            )}

            {/* Card Front (After Reveal) */}
            {isRevealed && mascotCard && (
              <div className="w-80 rounded-xl border-4 border-pink-500 bg-gradient-to-br from-gray-800 to-gray-900 p-4 transform transition-all duration-1000 overflow-hidden">
                {/* Rarity Badge */}
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold mb-2 ${
                  mascotCard.rarity === 'Common' ? 'bg-gray-500 text-white' :
                  mascotCard.rarity === 'Uncommon' ? 'bg-green-500 text-white' :
                  mascotCard.rarity === 'Rare' ? 'bg-blue-500 text-white' :
                  mascotCard.rarity === 'Epic' ? 'bg-purple-500 text-white' :
                  'bg-yellow-500 text-black'
                }`}>
                  ✨ {mascotCard.rarity}
                </div>

                {/* Mascot Composite Image */}
                <div className="text-center mb-3">
                  <img 
                    src={mascotCard.compositeImage} 
                    alt={mascotCard.name}
                    className="w-full h-auto rounded-lg mb-2"
                  />
                  <div className="text-white font-bold text-xl">{mascotCard.name}</div>
                </div>

                {/* Description */}
                <div className="bg-gray-800 bg-opacity-50 p-3 rounded-lg">
                  <p className="text-gray-300 text-sm text-center italic">
                    "{mascotCard.description}"
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {!isRevealed && (
          <div className="text-center">
            <button
              onClick={handleReveal}
              disabled={isRevealing}
              className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-8 py-4 rounded-xl font-bold text-xl hover:from-pink-600 hover:to-orange-600 transition-all transform hover:scale-105 disabled:opacity-50"
            >
              {isRevealing ? '🎴 Revealing...' : '🎴 Reveal Your Mascot!'}
            </button>
          </div>
        )}

        {isRevealed && mascotCard && (
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => {
                setIsRevealed(false);
                setMascotCard(null);
                setIsRevealing(false);
              }}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <span>🎴</span>
              Get New Mascot
            </button>
            <button
              onClick={() => handleShare('twitter')}
              className="bg-[#1DA1F2] text-white px-6 py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <span>𝕏</span>
              Share on X
            </button>
            <button
              onClick={() => handleShare('telegram')}
              className="bg-[#0088cc] text-white px-6 py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <span>📱</span>
              Telegram
            </button>
            <button
              onClick={() => handleShare('facebook')}
              className="bg-[#1877F2] text-white px-6 py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
            >
              <span>👥</span>
              Facebook
            </button>
            <button
              onClick={handleDownload}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <span>📥</span>
              Download
            </button>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 bg-blue-900 bg-opacity-30 rounded-lg border border-blue-500">
          <h4 className="font-semibold text-blue-300 mb-2">💡 About Your Mascot</h4>
          <ul className="text-sm text-blue-200 space-y-1">
            <li>✅ Each reveal generates a new unique mascot</li>
            <li>✅ 5 rarity tiers: Common (40%), Uncommon (25%), Rare (17%), Epic (12%), Legendary (6%)</li>
            <li>✅ 24 different character types with unique traits</li>
            <li>✅ Use as your profile picture across social media</li>
            <li>✅ Download high-quality PNG for any use</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
