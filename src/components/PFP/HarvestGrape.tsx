import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PfpSelection from './PfpSelection';

interface HarvestGrapeProps {
  children?: React.ReactNode;
}

export const HarvestGrape: React.FC<HarvestGrapeProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);
  const modalRootRef = useRef<HTMLDivElement | null>(null);

  // Animation phases for blinking/pulsing effect
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 4);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Create modal root element on mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      // Check if modal root already exists
      let modalRoot = document.getElementById('pfp-modal-root') as HTMLDivElement;
      
      if (!modalRoot) {
        // Create a dedicated div for the modal
        modalRoot = document.createElement('div');
        modalRoot.id = 'pfp-modal-root';
        modalRoot.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; z-index: 99999; pointer-events: none;';
        document.body.appendChild(modalRoot);
        console.log('✅ Created modal root element:', modalRoot);
      } else {
        console.log('✅ Modal root already exists:', modalRoot);
      }
      
      modalRootRef.current = modalRoot;

      return () => {
        // Don't remove on unmount - keep it for the lifetime of the app
        // Only remove if component is truly unmounting and no other instances exist
      };
    }
  }, []);

  // Debug: Log state changes
  useEffect(() => {
    console.log('HarvestGrape isOpen state:', isOpen);
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalBodyStyle = window.getComputedStyle(document.body).overflow;
      const originalHtmlStyle = window.getComputedStyle(document.documentElement).overflow;
      const originalBodyPosition = window.getComputedStyle(document.body).position;
      
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.position = 'relative';
      
      console.log('🔒 Modal opened - body scroll locked');
      return () => {
        document.body.style.overflow = originalBodyStyle;
        document.documentElement.style.overflow = originalHtmlStyle;
        document.body.style.position = originalBodyPosition;
        console.log('🔓 Modal closed - body scroll unlocked');
      };
    }
  }, [isOpen]);

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('✅ HarvestGrape button clicked!', { 
      isOpen, 
      timestamp: Date.now(),
      modalRootExists: !!modalRootRef.current,
      modalRootId: modalRootRef.current?.id
    });
    // Force a visible alert to confirm click is working
    console.warn('🚨 HARVEST GRAPE CLICKED - Setting isOpen to true');
    setIsOpen(true);
    // Double-check state was set
    setTimeout(() => {
      console.log('🔍 State check after click:', { isOpen: true });
    }, 100);
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          console.log('🖱️ RAW BUTTON CLICK EVENT FIRED!', e);
          handleButtonClick(e);
        }}
        onMouseDown={(e) => {
          console.log('🖱️ Mouse DOWN on button', e);
        }}
        onMouseUp={(e) => {
          console.log('🖱️ Mouse UP on button', e);
        }}
        onMouseEnter={() => console.log('🖱️ Mouse entered HarvestGrape button')}
        className="relative flex justify-center items-center rounded-lg w-12 h-12 border-2 border-pink-500 bg-gradient-to-r from-pink-500 to-yellow-500 hover:from-pink-600 hover:to-yellow-600 transition-all cursor-pointer shadow-lg active:scale-95"
        style={{ 
          minWidth: '48px', 
          minHeight: '48px',
          position: 'relative',
          zIndex: 1000,
          outline: 'none',
          pointerEvents: 'auto',
          cursor: 'pointer'
        }}
        title="Harvest Grape - Get Your PFP"
      >
        {/* Pulsing background glow */}
        <div 
          className={`absolute inset-0 rounded-lg transition-all duration-500 pointer-events-none ${
            animationPhase === 0 ? 'bg-gradient-to-r from-[#FF0075] to-[#FFCB45] opacity-75 scale-100' :
            animationPhase === 1 ? 'bg-gradient-to-r from-[#FF0075] to-[#FFCB45] opacity-100 scale-110' :
            animationPhase === 2 ? 'bg-gradient-to-r from-[#FF0075] to-[#FFCB45] opacity-90 scale-105' :
            'bg-gradient-to-r from-[#FF0075] to-[#FFCB45] opacity-100 scale-115'
          } animate-pulse blur-sm`}
          style={{ pointerEvents: 'none' }}
        />
        
        {/* Main button content */}
        <div 
          className="relative z-10 flex justify-center items-center w-full h-full"
          style={{ pointerEvents: 'none' }}
        >
          {children || (
            <div className="text-2xl" style={{ pointerEvents: 'none' }}>🍇</div>
          )}
          
          {/* Sparkle effects */}
          <div className="absolute -top-1 -right-1 text-yellow-400 animate-pulse text-xs pointer-events-none">✨</div>
          <div className="absolute -bottom-1 -left-1 text-pink-400 animate-pulse text-xs pointer-events-none">⭐</div>
        </div>
      </button>

      {/* Modal - Render to dedicated modal root using portal, fallback to document.body */}
      {isOpen && typeof document !== 'undefined' && (() => {
        const portalTarget = modalRootRef.current || document.body;
        console.log('🎬 Rendering modal portal to:', {
          target: portalTarget,
          targetId: portalTarget.id || 'document.body',
          isModalRoot: portalTarget === modalRootRef.current,
          modalRootExists: !!modalRootRef.current
        });
        
        return createPortal(
          <>
            {/* Backdrop */}
            <div 
              id="pfp-modal-backdrop"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                zIndex: 99999,
                pointerEvents: 'auto'
              }}
              onClick={(e) => {
                // Close modal when clicking outside
                if (e.target === e.currentTarget) {
                  console.log('Closing PFP modal (clicked outside)...');
                  setIsOpen(false);
                }
              }}
            />
            {/* Modal Content - Absolutely positioned and centered */}
            <div 
              id="pfp-modal-content"
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: '#000',
                border: '2px solid rgba(134, 134, 134, 0.3)',
                padding: '1.5rem',
                color: '#fff',
                minWidth: '413px',
                maxWidth: '90vw',
                maxHeight: '90vh',
                overflowY: 'auto',
                borderRadius: '0.75rem',
                zIndex: 100000,
                boxSizing: 'border-box',
                pointerEvents: 'auto'
              }}
              onClick={(e) => {
                // Prevent closing when clicking inside modal
                e.stopPropagation();
              }}
            >
              <PfpSelection onClose={() => {
                console.log('Closing PFP modal...');
                setIsOpen(false);
              }} />
            </div>
          </>,
          portalTarget
        );
      })()}
    </>
  );
};

export default HarvestGrape;




