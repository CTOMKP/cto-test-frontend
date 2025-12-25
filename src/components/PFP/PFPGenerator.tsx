import React from 'react';
import PfpSelection from './PfpSelection';

export const PFPGenerator: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-black border-[2px] border-[#86868630] text-white min-w-[413px] max-w-[90vw] overflow-auto max-h-[90vh] rounded-xl p-6">
        <PfpSelection />
      </div>
    </div>
  );
};






