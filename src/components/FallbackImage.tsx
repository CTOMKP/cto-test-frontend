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
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      
      {/* Always show a placeholder if no image or error */}
      {(!current || error) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="flex flex-col items-center justify-center">
            <svg className="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v8l4-2 4 2 4-2 4 2V6H4zm0 12h16v-2l-4-2-4 2-4-2-4 2v2z" />
            </svg>
            <div className="text-gray-500 text-xs mt-1">{alt || 'Image not available'}</div>
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