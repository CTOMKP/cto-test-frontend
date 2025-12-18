import React, { useMemo, useState, useEffect } from 'react';
import { buildImageCandidates } from '../utils/helpers';
import './FallbackImage.css';

interface Props {
  src?: string | null;
  alt?: string;
  className?: string;
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
  customStyles?: {
    width?: string;
    height?: string;
    objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
    objectPosition?: string;
  };
}

// Tries multiple URL candidates (normalized S3 key forms) until one loads
const FallbackImage: React.FC<Props> = ({ src, alt = '', className, onLoad, customStyles }) => {
  const candidates = useMemo(() => buildImageCandidates(src), [src]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const current = candidates[index];

  // Reset states when src changes
  useEffect(() => {
    if (src) {
      setIndex(0);
      setLoading(true);
      setError(false);
    }
  }, [src]);

  // Preload image
  useEffect(() => {
    if (!current) {
      setLoading(false);
      setError(true);
      return;
    }
    
    const img = new Image();
    img.src = current;
    
    img.onload = () => {
      setLoading(false);
      setError(false);
      if (onLoad) {
        // Create a proper synthetic event or just call onLoad directly
        onLoad({ target: img } as unknown as React.SyntheticEvent<HTMLImageElement>);
      }
    };
    
    img.onerror = () => {
      // Try next candidate
      if (index < candidates.length - 1) {
        setIndex(i => i + 1);
      } else {
        setLoading(false);
        setError(true);
      }
    };
    
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [current, index, candidates.length, onLoad]);

  // Instead of returning null, show a placeholder

  // Convert customStyles to CSS custom properties
  const cssVars = customStyles ? {
    '--img-width': customStyles.width,
    '--img-height': customStyles.height,
    '--img-object-fit': customStyles.objectFit,
    '--img-object-position': customStyles.objectPosition,
  } as React.CSSProperties : undefined;

  // Build dynamic classes based on customStyles
  const styleClasses = [
    'fallback-image',
    className,
    customStyles?.objectFit && `object-${customStyles.objectFit}`,
    customStyles?.width === '100%' && 'w-full',
    customStyles?.height === '100%' && 'h-full',
    loading ? 'opacity-0' : 'opacity-100',
  ].filter(Boolean).join(' ');

  return (
    <div className={`relative ${className || ''}`} style={cssVars}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-full">
          <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      
      {/* Always show a placeholder if no image or error */}
      {(!current || error) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-full z-10">
          <div className="flex flex-col items-center justify-center">
            <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
            </svg>
          </div>
        </div>
      )}
      
      {current && !error && (
        <img
          src={current}
          alt={alt}
          className={styleClasses}
          style={{ transition: 'opacity 300ms' }}
          onError={() => setIndex((i) => i + 1)}
        />
      )}
    </div>
  );
};

export default FallbackImage;