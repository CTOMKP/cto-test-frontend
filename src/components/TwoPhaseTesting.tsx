import React, { useState } from 'react';
import axios from 'axios';

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';

interface Phase1Response {
  contractAddress: string;
  vettingDate: string;
  approved: boolean;
  tokenInfo: any;
  security: any;
  liquidityPool: any;
  tokenAge: any;
  developerStatus: any;
  initialDistribution: any;
  rugCheck: any;
  vettingResult: any;
}

interface Phase2Response {
  contractAddress: string;
  scannedAt: string;
  currentTier: string;
  market: any;
  holders: any;
  activity: any;
  liquidityMonitoring: any;
  walletBehavior: any;
  community: any;
  badgeProgression: any;
  alerts: any[];
}

export const TwoPhaseTesting: React.FC = () => {
  const [contractAddress, setContractAddress] = useState('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');
  const [currentTier, setCurrentTier] = useState<'seed' | 'sprout' | 'bloom' | 'stellar'>('seed');
  const [phase1Result, setPhase1Result] = useState<Phase1Response | null>(null);
  const [phase2Result, setPhase2Result] = useState<Phase2Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testPhase1 = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${backendUrl}/api/n8n/vetting/phase1`, {
        contractAddress
      });
      setPhase1Result(response.data);
    } catch (err: any) {
      setError(`Phase 1 Error: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testPhase2 = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${backendUrl}/api/n8n/monitoring/phase2`, {
        contractAddress,
        currentTier
      });
      setPhase2Result(response.data);
    } catch (err: any) {
      setError(`Phase 2 Error: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number | null | undefined, decimals: number = 2): string => {
    if (num === null || num === undefined || isNaN(num)) return 'N/A';
    
    if (num >= 1e9) return `$${(num / 1e9).toFixed(decimals)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(decimals)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(decimals)}K`;
    return `$${num.toFixed(decimals)}`;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Two-Phase Vetting System Test</h1>
        
        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contract Address
              </label>
              <input
                type="text"
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter Solana contract address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Tier
              </label>
              <select
                value={currentTier}
                onChange={(e) => setCurrentTier(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="seed">Seed</option>
                <option value="sprout">Sprout</option>
                <option value="bloom">Bloom</option>
                <option value="stellar">Stellar</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-4 mt-4">
            <button
              onClick={testPhase1}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Phase 1 (Vetting)'}
            </button>
            <button
              onClick={testPhase2}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test Phase 2 (Monitoring)'}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Results Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Phase 1 Results */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">Phase 1: Initial Vetting</h2>
            {phase1Result ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Contract:</span>
                    <p className="font-mono text-sm">{phase1Result.contractAddress}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Approved:</span>
                    <p className={`font-semibold ${phase1Result.approved ? 'text-green-600' : 'text-red-600'}`}>
                      {phase1Result.approved ? '✅ YES' : '❌ NO'}
                    </p>
                  </div>
                </div>

                {phase1Result.tokenInfo && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Token Info</h3>
                    <div className="bg-gray-50 p-3 rounded">
                      <p><span className="text-sm text-gray-500">Name:</span> {phase1Result.tokenInfo.name || 'N/A'}</p>
                      <p><span className="text-sm text-gray-500">Symbol:</span> {phase1Result.tokenInfo.symbol || 'N/A'}</p>
                    </div>
                  </div>
                )}

                {phase1Result.vettingResult && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Vetting Result</h3>
                    <div className="bg-gray-50 p-3 rounded">
                      <p><span className="text-sm text-gray-500">Initial Tier:</span> 
                        <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">
                          {phase1Result.vettingResult.initialTier}
                        </span>
                      </p>
                      <p><span className="text-sm text-gray-500">Risk Score:</span> {phase1Result.vettingResult.riskScore}</p>
                      <p><span className="text-sm text-gray-500">Risk Level:</span> 
                        <span className={`ml-2 px-2 py-1 rounded text-sm ${
                          phase1Result.vettingResult.riskLevel === 'LOW' ? 'bg-green-100 text-green-800' :
                          phase1Result.vettingResult.riskLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          phase1Result.vettingResult.riskLevel === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {phase1Result.vettingResult.riskLevel}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                {phase1Result.vettingResult?.warnings?.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Warnings</h3>
                    <ul className="bg-yellow-50 p-3 rounded">
                      {phase1Result.vettingResult.warnings.map((warning: string, index: number) => (
                        <li key={index} className="text-sm text-yellow-800">• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No Phase 1 results yet. Click "Test Phase 1" to run vetting.</p>
            )}
          </div>

          {/* Phase 2 Results */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-green-600">Phase 2: Continuous Monitoring</h2>
            {phase2Result ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Contract:</span>
                    <p className="font-mono text-sm">{phase2Result.contractAddress}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Current Tier:</span>
                    <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">
                      {phase2Result.currentTier}
                    </span>
                  </div>
                </div>

                {phase2Result.market && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Market Data</h3>
                    <div className="bg-gray-50 p-3 rounded grid grid-cols-2 gap-2 text-sm">
                      <p><span className="text-gray-500">Price:</span> {formatNumber(phase2Result.market.price, 6)}</p>
                      <p><span className="text-gray-500">Market Cap:</span> {formatNumber(phase2Result.market.marketCap)}</p>
                      <p><span className="text-gray-500">Liquidity:</span> {formatNumber(phase2Result.market.liquidity)}</p>
                      <p><span className="text-gray-500">24h Volume:</span> {formatNumber(phase2Result.market.volume24h)}</p>
                    </div>
                  </div>
                )}

                {phase2Result.badgeProgression && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Badge Progression</h3>
                    <div className="bg-gray-50 p-3 rounded">
                      <p><span className="text-sm text-gray-500">Next Tier:</span> 
                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                          {phase2Result.badgeProgression.nextTier || 'none'}
                        </span>
                      </p>
                      <p><span className="text-sm text-gray-500">Ready for Upgrade:</span> 
                        <span className={`ml-2 px-2 py-1 rounded text-sm ${
                          phase2Result.badgeProgression.readyForUpgrade ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {phase2Result.badgeProgression.readyForUpgrade ? '✅ YES' : '❌ NO'}
                        </span>
                      </p>
                      <p><span className="text-sm text-gray-500">Requirements Met:</span> 
                        {phase2Result.badgeProgression.requirementsMet}/{phase2Result.badgeProgression.totalRequirements}
                      </p>
                    </div>
                  </div>
                )}

                {phase2Result.alerts && phase2Result.alerts.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-700 mb-2">Alerts</h3>
                    <div className="space-y-2">
                      {phase2Result.alerts.map((alert: any, index: number) => (
                        <div key={index} className={`p-3 rounded text-sm ${
                          alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          alert.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                          alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          <div className="font-semibold">{alert.severity.toUpperCase()}</div>
                          <div>{alert.message}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No Phase 2 results yet. Click "Test Phase 2" to run monitoring.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
