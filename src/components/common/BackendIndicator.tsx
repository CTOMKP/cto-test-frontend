import React from 'react';
import { getBackendLabel, getBackendUrl, isProductionBackend } from '../../utils/apiConfig';

const BackendIndicator: React.FC = () => {
  const isProduction = isProductionBackend();
  const backendLabel = getBackendLabel();
  const backendUrl = getBackendUrl();
  
  return (
    <div 
      className={`fixed bottom-2 right-2 px-3 py-1 rounded-md text-xs font-medium z-50 ${
        isProduction 
          ? 'bg-blue-100 text-blue-800 border border-blue-300' 
          : 'bg-green-100 text-green-800 border border-green-300'
      }`}
      title={`Backend URL: ${backendUrl}`}
    >
      Backend: {backendLabel}
    </div>
  );
};

export default BackendIndicator;