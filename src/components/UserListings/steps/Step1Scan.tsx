import React, { useState, useEffect, useMemo } from 'react';
import { Search, Zap } from 'lucide-react';
import userListingsService, { ScanResult } from '../../../services/userListingsService';
import { getTierColor, getTierIcon, getRiskScoreColor, formatNumber, compactNumber } from '../../../utils/listingHelpers';
import toast from 'react-hot-toast';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

interface Step1ScanProps {
  selectedNetwork: string;
  setSelectedNetwork: (network: string) => void;
  networks: Array<{ name: string; value: string }>;
  onScanComplete?: (scanResults: ScanResult, contractAddress: string) => void;
  onContinue?: () => void;
}

const scanInfo = [
  {
    description: 'Fetching real-time token metadata',
    image: '/Overlay.svg',
  },
  {
    description: 'Analyzing smart contract security',
    image: '/Overlay-1.svg',
  },
  {
    description: 'Checking liquidity & holder activity',
    image: '/Overlay-2.svg',
  },
  {
    description: 'Calculating final risk score',
    image: '/Overlay-3.svg',
  },
];

export default function Step1Scan({
  selectedNetwork,
  setSelectedNetwork,
  networks,
  onScanComplete,
  onContinue,
}: Step1ScanProps) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [contractAddress, setContractAddress] = useState('');
  const [scanResults, setScanResults] = useState<ScanResult | null>(null);
  const [canProceed, setCanProceed] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const createdDate = useMemo(() => {
    const metadata = scanResults?.metadata;
    if (!metadata) return null;
    if (metadata.creation_date) {
      return new Date(metadata.creation_date);
    }
    if (typeof metadata.project_age_days === 'number') {
      return new Date(Date.now() - metadata.project_age_days * 24 * 60 * 60 * 1000);
    }
    return null;
  }, [scanResults?.metadata]);

  const startScan = async () => {
    if (!contractAddress.trim()) {
      toast.error('Please enter a contract address');
      return;
    }

    if (!isAuthenticated) {
      toast.error('Please login first to scan tokens');
      return;
    }

    setIsScanning(true);
    setScanDialogOpen(true);
    setScanComplete(false);
    setProgress(0);
    setCanProceed(false);

    try {
      // Start progress animation
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90; // Stop at 90% until API call completes
          }
          return prev + 2;
        });
      }, 100);

      // Make API call to scan token
      const result = await userListingsService.scan(contractAddress.trim(), selectedNetwork);

      // Complete progress animation
      clearInterval(progressInterval);
      setProgress(100);

      // Check risk score (user listings require risk_score >= 50)
      const riskScore = result.risk_score ?? 0;
      const canProceedToNext = riskScore >= 50;

      // Save scan results
      setScanResults(result);
      setCanProceed(canProceedToNext);

      // Show error if risk score is too low
      if (!canProceedToNext) {
        toast.error(`Token risk score (${riskScore}) is below the minimum required (50). This token cannot be listed.`);
      }

      setTimeout(() => {
        setScanComplete(true);
      }, 500);

      // Notify parent component if scan is successful and can proceed
      if (canProceedToNext && onScanComplete) {
        onScanComplete(result, contractAddress.trim());
      }
    } catch (error: any) {
      console.error('Scan failed:', error);
      toast.error(error?.message || 'Scan failed. Please try again.');
      setProgress(0);
      setScanDialogOpen(false);
    } finally {
      setIsScanning(false);
    }
  };

  const resetScan = () => {
    setScanDialogOpen(false);
    setScanComplete(false);
    setProgress(0);
    setScanResults(null);
    setCanProceed(false);
  };

  return (
    <>
      <h2 className="font-bold text-[18px] text-center mb-2">
        Scan Token Contract
      </h2>
      <div className="flex justify-start mt-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-xs text-white/70 hover:text-white underline"
        >
          Back
        </button>
      </div>
      <p className="text-sm text-white/70 text-center">
        Select network & paste contract address to begin
      </p>

      {/* Network Selector */}
      <div className="mt-6">
        <label className="block text-sm font-medium mb-2">Select Network</label>
        <select
          value={selectedNetwork}
          onChange={(e) => setSelectedNetwork(e.target.value)}
          className="w-full h-10 rounded-lg border-[0.2px] border-white/20 bg-white/5 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
        >
          {networks.map((network) => (
            <option key={network.value} value={network.value}>
              {network.name}
            </option>
          ))}
        </select>
      </div>

      {/* Contract Address Input */}
      <div className="mt-4 relative flex items-center">
        <input
          type="text"
          placeholder="Enter Contract address (32-44 characters)"
          className="border-[0.2px] border-white/20 h-12 py-3 px-2 bg-white/5 rounded-lg text-white placeholder:text-white/50 w-full focus:outline-none focus:ring-2 focus:ring-pink-500"
          value={contractAddress}
          onChange={(e) => setContractAddress(e.target.value)}
        />
        <button
          type="button"
          className="absolute right-2 px-2 py-1.5 text-white/50 text-xs bg-white/5 rounded hover:bg-white/10"
          onClick={() => navigator.clipboard.readText().then((text) => setContractAddress(text))}
        >
          paste
        </button>
      </div>

      {/* Scan Button */}
      <button
        type="button"
        onClick={startScan}
        disabled={isScanning || !contractAddress.trim()}
        className="font-medium mt-4 mb-6 w-full gap-2 bg-gradient-to-r from-[#FF0075] via-[#FF4A15] to-[#FFCB45] rounded-lg h-9 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Search size={16} color="#FFFFFF" /> Scan Token
      </button>

      {/* Scan Dialog/Modal */}
      {scanDialogOpen && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
          <div
            className={`bg-[#010101] ${
              !scanComplete ? 'max-w-[484px]' : 'max-w-[534px]'
            } border-white/20 text-white py-6 px-6 rounded-xl max-h-full overflow-auto`}
          >
            {!scanComplete ? (
              // Scanning UI
              <>
                <div className="flex justify-center mb-6">
                  <span className="size-[100px] flex justify-center items-center rounded-full bg-[#FBA43A]/20">
                    <span className="text-4xl">🔍</span>
                  </span>
                </div>
                <h2 className="font-bold text-center text-[22.5px] mb-2">
                  Analysing token
                </h2>
                <p className="text-xs text-center text-white/70 mb-6">
                  Running comprehensive security and risk assessment
                </p>

                <div className="space-y-6">
                  {scanInfo.map((info, index) => (
                    <div className="flex items-center justify-between" key={index}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📊</span>
                        <p className="text-xs">{info.description}</p>
                      </div>
                      <div className="text-white/50">⋯</div>
                    </div>
                  ))}
                </div>

                <div className="mt-[34px]">
                  <div className="w-full bg-[#27272A] rounded-full h-[3px] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#FF0075] via-[#FF4A15] to-[#FFCB45] transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-sm text-[#71717B] mt-1.5">
                    <span>Processing</span>
                    <span>~15 -25 seconds</span>
                  </div>
                </div>

                <div className="rounded-lg py-4.5 px-2 border border-[#8686864D] mt-6 flex gap-2">
                  <Zap size={20} color="#FFCB45" />
                  <p className="text-sm text-white/70">
                    <span className="font-medium text-white">Did you know?</span> Our
                    system analyzes blockchain data instead of cached results for
                    maximum accuracy
                  </p>
                </div>
              </>
            ) : (
              // Scan Complete UI
              <>
                <div className="py-2 border-b-[0.5px] border-white/20 mb-4">
                  <h2 className="font-bold text-lg">Vetting result</h2>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-5">
                  <div className="flex justify-between p-2 rounded-xl border border-[#8686864D]">
                    <div className="space-y-2">
                      <h3 className="font-bold text-sm text-white/50">
                        Tier classification
                      </h3>
                      <p
                        className="text-[19px] font-bold"
                        style={{ color: getTierColor(scanResults?.tier || 'Seed') }}
                      >
                        {scanResults?.tier || 'Seed'}
                      </p>
                    </div>
                    <span
                      className="size-7 rounded-lg flex justify-center items-center"
                      style={{
                        backgroundColor: `${getTierColor(scanResults?.tier || 'Seed')}20`,
                      }}
                    >
                      <span className="text-base">
                        {scanResults?.tier === 'Sprout' ? '🌿' :
                         scanResults?.tier === 'Bloom' ? '🌸' :
                         scanResults?.tier === 'Stellar' ? '⭐' : '🌱'}
                      </span>
                    </span>
                  </div>

                  <div className="flex justify-between p-2 rounded-xl border border-[#8686864D]">
                    <div className="space-y-2">
                      <h3 className="font-bold text-sm text-white/50">Risk score</h3>
                      <p className="text-[19px] font-bold">
                        <span
                          style={{
                            color: getRiskScoreColor(scanResults?.risk_score || 0),
                          }}
                        >
                          {scanResults?.risk_score ?? 'N/A'}
                        </span>
                        /100
                      </p>
                    </div>
                    <span
                      className="size-7 rounded-lg flex justify-center items-center"
                      style={{
                        backgroundColor: `${getRiskScoreColor(scanResults?.risk_score || 0)}20`,
                      }}
                    >
                      <span className="text-xs">
                        {scanResults?.risk_score && scanResults.risk_score >= 70
                          ? '✅'
                          : scanResults?.risk_score && scanResults.risk_score >= 50
                          ? '⚠️'
                          : '❌'}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Details Section */}
                {scanResults?.metadata && (
                  <div className="mt-5 mb-6">
                    <h3 className="font-bold text-[18px] mb-4">Details</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4.5">
                        <p>
                          <span className="text-white/70">Name:</span>{' '}
                          <span>{scanResults.metadata.token_name || 'N/A'}</span>
                        </p>
                        <p>
                          <span className="text-white/70">Ticker:</span>{' '}
                          <span className="uppercase">
                            ${scanResults.metadata.token_symbol || 'N/A'}
                          </span>
                        </p>
                        <p>
                          <span className="text-white/70">Age:</span>{' '}
                          <span>
                            {scanResults.metadata.age_display ||
                              scanResults.metadata.age_display_short ||
                              'N/A'}
                          </span>
                        </p>
                        <p>
                          <span className="text-white/70">Created:</span>{' '}
                          <span>
                            {createdDate
                              ? createdDate.toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </p>
                      </div>
                      <div className="space-y-4.5">
                        <p>
                          <span className="text-white/70">Price:</span>{' '}
                          <span>
                            {formatNumber(scanResults.metadata.token_price)}
                          </span>
                        </p>
                        <p>
                          <span className="text-white/70">Market cap:</span>{' '}
                          <span>
                            {compactNumber(scanResults.metadata.market_cap)}
                          </span>
                        </p>
                        <p>
                          <span className="text-white/70">24h volume:</span>{' '}
                          <span>
                            {compactNumber(scanResults.metadata.volume_24h)}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Summary */}
                    {scanResults.summary && (
                      <div className="py-4.5 px-2 space-y-4 border border-[#8686864D] rounded-lg mt-4">
                        <h3 className="flex items-center gap-2">
                          <Zap size={16} color="#FFCB45" />
                          <span className="font-medium text-[18px]">Summary</span>
                        </h3>
                        <p className="text-sm text-white/70">{scanResults.summary}</p>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 mt-4 mb-8">
                      <div className="h-[113px] rounded-xl border border-[#8686864D] flex items-center justify-center">
                        <div className="text-center space-y-[2px] w-full">
                          <h3 className="text-white/50 font-bold text-xs">
                            LP security
                          </h3>
                          <div className="flex items-center gap-1 justify-center">
                            <span className="font-bold text-[24px]">
                              {compactNumber(scanResults.metadata.lp_amount_usd)}
                            </span>
                            {scanResults.metadata.lp_locked && (
                              <span className="text-lg">🔒</span>
                            )}
                          </div>
                          <p className="text-white/50 font-bold text-xs">
                            {scanResults.metadata.lp_locked
                              ? `locked: ${scanResults.metadata.lp_lock_months || 0}mo`
                              : 'Not locked'}
                          </p>
                        </div>
                      </div>

                      <div className="h-[113px] rounded-xl border border-[#8686864D] flex items-center justify-center">
                        <div className="text-center space-y-[2px] w-full">
                          <h3 className="text-white/50 font-bold text-xs">Holders</h3>
                          <div className="flex items-center gap-1 justify-center">
                            <span className="font-bold text-[24px]">
                              {scanResults.metadata.holder_count?.toLocaleString() || 'N/A'}
                            </span>
                          </div>
                          <p className="text-white/50 font-bold text-xs">
                            Total holders
                          </p>
                        </div>
                      </div>

                      <div className="h-[113px] rounded-xl border border-[#8686864D] flex items-center justify-center">
                        <div className="text-center space-y-[2px] w-full">
                          <h3 className="text-white/50 font-bold text-xs">Security</h3>
                          <div className="flex items-center gap-1 justify-center">
                            <span className="font-bold text-[24px]">
                              {scanResults.risk_level || 'N/A'}
                            </span>
                            {scanResults.risk_score && scanResults.risk_score >= 70 && (
                              <span className="text-lg">✅</span>
                            )}
                          </div>
                          <p className="text-white/50 font-bold text-xs">
                            Score: {scanResults.risk_score || 'N/A'}/100
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col items-center gap-3">
                  {!canProceed && (
                    <div className="w-full py-3 px-4 rounded-lg bg-red-500/20 border border-red-500/50">
                      <p className="text-sm text-red-400 text-center font-medium">
                        ⚠️ Risk score too low. Minimum required: 50
                      </p>
                    </div>
                  )}
                  {canProceed && (
                    <button
                      onClick={() => {
                        setScanDialogOpen(false);
                        // Navigate to next step if continue handler provided
                        if (onContinue) {
                          onContinue();
                        }
                      }}
                      className="w-[155px] bg-gradient-to-r from-[#FF0075] via-[#FF4A15] to-[#FFCB45] rounded-lg h-9 font-medium"
                    >
                      Continue
                    </button>
                  )}
                  <button
                    onClick={resetScan}
                    className="w-[155px] border border-white/20 text-white/70 rounded-lg h-9 font-medium hover:bg-white/5"
                  >
                    Scan Again
                  </button>
                </div>

                <p className="text-center mt-6 font-medium text-xs text-white/70">
                  <span className="text-white">Disclaimer:</span> this analysis is
                  for informational purpose and does not constitute financial advice.
                  always conduct your own research
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* What we analyze section */}
      <div className="border border-white/20 rounded-lg px-2 py-4.5">
        <div className="flex items-center gap-2">
          <Zap size={16} color="#FFCB45" />
          <h3 className="font-medium">What we analyze:</h3>
        </div>
        <ul className="list-disc list-inside text-[14px] ml-7 space-y-1">
          <li>Smart contract security vulnerabilities</li>
          <li>Liquidity pool amount and lock duration</li>
          <li>Wallet holder distribution and activity</li>
          <li>Project age and development timeline</li>
        </ul>
      </div>
    </>
  );
}
