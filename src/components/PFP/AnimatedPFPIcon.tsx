import React, { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { CardReveal } from './CardReveal';

export const AnimatedPFPIcon: React.FC = () => {
  const { authenticated } = usePrivy();
  const [isVisible, setIsVisible] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);

  // Only show icon if user is authenticated
  useEffect(() => {
    if (!authenticated) {
      setIsVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 2000); // Show after 2 seconds

    return () => clearTimeout(timer);
  }, [authenticated]);

  // Animation phases
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 4);
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  const handleClick = () => {
    setShowCard(true);
  };

  const handleCloseCard = () => {
    setShowCard(false);
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Animated Icon */}
      <div className="fixed top-20 right-4 z-40">
        <div
          onClick={handleClick}
          className={`relative cursor-pointer transition-all duration-500 transform ${
            animationPhase === 0 ? 'scale-100 rotate-0' :
            animationPhase === 1 ? 'scale-110 rotate-5' :
            animationPhase === 2 ? 'scale-105 rotate-0' :
            'scale-115 rotate-3'
          } hover:scale-125 hover:rotate-6`}
        >
          {/* Pulsing background */}
          <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full animate-ping opacity-75"></div>
          
          {/* Main icon */}
          <div className="relative bg-gradient-to-r from-pink-500 to-orange-500 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl border-4 border-white">
            <div className="text-2xl animate-bounce">🎴</div>
          </div>
          
          {/* Sparkle effects */}
          <div className="absolute -top-2 -right-2 text-yellow-400 animate-pulse">✨</div>
          <div className="absolute -bottom-1 -left-1 text-pink-400 animate-pulse">⭐</div>
          
          {/* Attention-grabbing text */}
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-80 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap animate-pulse">
            Get Your PFP!
          </div>
        </div>
      </div>

      {/* Card Reveal Modal */}
      {showCard && <CardReveal onClose={handleCloseCard} />}
    </>
  );
};
