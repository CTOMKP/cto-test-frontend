import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../utils/constants';
import userListingsService, { ScanResult, CreateUserListingPayload } from '../../services/userListingsService';
import toast from 'react-hot-toast';
import axios from 'axios';
import Step1Scan from './steps/Step1Scan';
import Step2Details from './steps/Step2Details';
import Step3Roadmap from './steps/Step3Roadmap';

const networks = [
  { name: 'Aptos', value: 'APTOS' },
  { name: 'Solana', value: 'SOLANA' },
  { name: 'BNB', value: 'BNB' },
  { name: 'Movement', value: 'MOVEMENT' },
  { name: 'Base', value: 'BASE' },
  { name: 'Ethereum', value: 'ETHEREUM' },
  { name: 'Sui', value: 'SUI' },
  { name: 'Near', value: 'NEAR' },
  { name: 'Osmosis', value: 'OSMOSIS' },
];

const info = [
  {
    title: 'Smart contract audit',
    description: 'Automated vulnerability detection and security analysis',
    image: '/Overlay.svg',
  },
  {
    title: 'Wallet behaviour',
    description: 'Reputation engine and suspicious activity detection',
    image: '/Overlay-1.svg',
  },
  {
    title: 'Accurate results',
    description: 'Real time blockchain with comprehensive risk scoring',
    image: '/Overlay-2.svg',
  },
  {
    title: 'Tier classification',
    description: 'Four-tier system from seed to stellar ratings',
    image: '/Overlay-3.svg',
  },
];

const getStarted = [
  {
    title: 'Submit Your Contract',
    description: 'Paste your token contract (Aptos, Solana, ETH, etc.) to start the vetting process',
  },
  {
    title: 'Automated analysis',
    description: 'Our system checks security, liquidity, wallets, and sentiment.',
  },
  {
    title: 'Get Listed',
    description: 'Get your badge tier, add project info, and go live',
  },
];

const CreateUserListingNew: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('SOLANA');
  const [scanResults, setScanResults] = useState<ScanResult | null>(null);
  const [draftListingId, setDraftListingId] = useState<string | null>(null);
  const [contractAddress, setContractAddress] = useState<string>('');

  // Clear draft ID on mount (fresh start)
  useEffect(() => {
    localStorage.removeItem('cto_draft_listing_id');
  }, []);

  const handleScanComplete = (results: ScanResult, contractAddr: string) => {
    setScanResults(results);
    setContractAddress(contractAddr);
    // Don't auto-navigate - let user review scan results first
    // User can manually proceed to step 2 using the "Continue" button
  };

  const handleDraftCreated = (draftId: string) => {
    setDraftListingId(draftId);
    localStorage.setItem('cto_draft_listing_id', draftId);
  };

  const handlePublishComplete = () => {
    setDraftListingId(null);
    localStorage.removeItem('cto_draft_listing_id');
    toast.success('Listing published successfully!');
    navigate(ROUTES.myUserListings);
  };

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Step Indicator */}
        <div className="border border-white/20 rounded-lg mt-[78px] mx-auto max-w-4xl">
          <div className="flex justify-center items-center gap-3.5 mx-4 border-b border-white/20 pt-3 pb-4">
            <span
              onClick={() => currentStep > 1 && setCurrentStep(1)}
              className={`size-5 rounded-full font-bold text-[10.5px] flex justify-center items-center cursor-pointer ${
                currentStep === 1
                  ? 'text-white bg-white/10'
                  : 'text-white/30 bg-white/5'
              }`}
            >
              1
            </span>
            <span className="bg-white/30 w-6 h-[1px]"></span>
            <span
              onClick={() => currentStep > 2 && setCurrentStep(2)}
              className={`size-5 rounded-full font-bold text-[10.5px] flex justify-center items-center cursor-pointer ${
                currentStep === 2
                  ? 'text-white bg-white/10'
                  : 'text-white/30 bg-white/5'
              }`}
            >
              2
            </span>
            <span className="bg-white/30 w-6 h-[1px]"></span>
            <span
              onClick={() => currentStep > 3 && setCurrentStep(3)}
              className={`size-5 rounded-full font-bold text-[10.5px] flex justify-center items-center cursor-pointer ${
                currentStep === 3
                  ? 'text-white bg-white/10'
                  : 'text-white/30 bg-white/5'
              }`}
            >
              3
            </span>
          </div>

          <h1 className="font-medium text-[62px] text-center">
            {currentStep === 1 && 'Get Verified & Grow'}
            {currentStep === 2 && 'Listing Details'}
            {currentStep === 3 && 'Project roadmap'}
          </h1>

          {/* Tier badges - only show on step 1 */}
          {currentStep === 1 && (
            <div className="flex justify-center items-center gap-3">
              <span className="rounded-lg p-1.5 font-bold text-[#6D6D6D] bg-[#6D6D6D]/20 flex items-center gap-2.5">
                <span className="text-base">🌱</span> Seed
              </span>
              <span className="rounded-lg p-1.5 font-bold text-[#FF5900] bg-[#FF5900]/20 flex items-center gap-2.5">
                <span className="text-base">🌿</span> Sprout
              </span>
              <span className="rounded-lg p-1.5 font-bold text-[#15FF00] bg-[#15FF00]/20 flex items-center gap-2.5">
                <span className="text-base">🌸</span> Bloom
              </span>
              <span className="rounded-lg p-1.5 font-bold text-[#FFBB00] bg-[#FFBB00]/20 flex items-center gap-2.5">
                <span className="text-base">⭐</span> Stellar
              </span>
            </div>
          )}

          {/* Step Content */}
          <div
            className={`border border-white/20 rounded-lg p-6 my-8 max-w-[534px] mx-auto ${
              currentStep !== 1 ? 'mt-4' : ''
            }`}
          >
            {currentStep === 1 && (
              <Step1Scan
                selectedNetwork={selectedNetwork}
                setSelectedNetwork={setSelectedNetwork}
                networks={networks}
                onScanComplete={handleScanComplete}
              />
            )}

            {currentStep === 2 && (
              <Step2Details
                scanResults={scanResults}
                contractAddress={contractAddress}
                chain={selectedNetwork}
                onDraftCreated={handleDraftCreated}
                setCurrentStep={setCurrentStep}
              />
            )}

            {currentStep === 3 && (
              <Step3Roadmap
                draftListingId={draftListingId}
                onPublishComplete={handlePublishComplete}
                setCurrentStep={setCurrentStep}
              />
            )}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 px-[100px] mt-4">
          {info.map((item, index) => (
            <div
              key={index}
              className="bg-gradient-to-t from-white/40 via-white/10 to-white/5 rounded-3xl p-[1px]"
            >
              <div className="bg-black rounded-3xl h-full p-5 text-white">
                <div className="text-2xl mb-3">📊</div>
                <h3 className="font-bold text-[18px] mb-3">{item.title}</h3>
                <p className="text-white/70 text-sm">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Get Started Section */}
        <div className="mt-[100px] mx-[100px] mb-[140px]">
          <h3 className="text-center text-[32px] mb-8">
            Get started in 3 easy steps
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {getStarted.map((step, index) => (
              <div key={index} className="p-8 rounded-lg border border-white/10">
                <div className="flex justify-center">
                  <span className="size-6 rounded-full bg-[#FF4A15]/20 flex items-center justify-center mb-3 text-[#FF4A15]">
                    {index + 1}
                  </span>
                </div>
                <h4 className="font-semibold text-[18px] text-center mb-3">
                  {step.title}
                </h4>
                <p className="text-white/70 text-sm text-center">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateUserListingNew;
