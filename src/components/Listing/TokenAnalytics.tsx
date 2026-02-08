import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { TokenChart } from './TokenChart';

interface TokenAnalyticsProps {
  contractAddress: string;
  chain: string;
  priceUsd?: number;
  marketCap?: number;
  liquidityUsd?: number;
  volume24h?: number;
  holders?: number;
}

interface HolderData {
  holders: number | null;
  source: string;
}

interface TransferAnalytics {
  totalTransfers: number;
  buyCount: number;
  sellCount: number;
  netBuyRatio: number;
  totalVolume: number;
}

const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';

/**
 * TokenAnalytics Component
 * ------------------------
 * Displays comprehensive token analytics including:
 * - Candlestick chart (70% width on desktop)
 * - Stats card with holder count, buy/sell ratio (30% width on desktop)
 * - Responsive layout (stacked on mobile)
 */
export const TokenAnalytics: React.FC<TokenAnalyticsProps> = ({
  contractAddress,
  chain,
  priceUsd,
  marketCap,
  liquidityUsd,
  volume24h,
  holders,
}) => {
  const [holderData, setHolderData] = useState<HolderData | null>(null);
  const [transferData, setTransferData] = useState<TransferAnalytics | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [contractAddress, chain]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch all analytics data in parallel
      const [holdersRes, transfersRes, chartRes] = await Promise.allSettled([
        axios.get(`${backendUrl}/api/v1/listing/holders/${contractAddress}?chain=${chain}`),
        axios.get(`${backendUrl}/api/v1/listing/transfers/${contractAddress}?chain=${chain}`),
        axios.get(`${backendUrl}/api/v1/listing/chart/${contractAddress}?chain=${chain}&timeframe=1h`),
      ]);

      // Process holder data
      if (holdersRes.status === 'fulfilled') {
        setHolderData(holdersRes.value.data);
      }

      // Process transfer data
      if (transfersRes.status === 'fulfilled' && transfersRes.value.data?.data?.analytics) {
        setTransferData(transfersRes.value.data.data.analytics);
      }

      // Process chart data
      if (chartRes.status === 'fulfilled' && chartRes.value.data?.data) {
        console.log('Chart API Response:', chartRes.value.data);
        console.log('Chart Data Array:', chartRes.value.data.data);
        console.log('Chart Data Length:', chartRes.value.data.data?.length);
        setChartData(chartRes.value.data.data);
      } else {
        console.log('Chart request failed or no data:', chartRes);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
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

  const formatHolders = (holders: number | null): string => {
    if (holders === null) return 'N/A';
    if (holders >= 1e6) return `${(holders / 1e6).toFixed(2)}M`;
    if (holders >= 1e3) return `${(holders / 1e3).toFixed(2)}K`;
    return holders.toString();
  };

  const resolvedHolders = holderData?.holders ?? (Number.isFinite(Number(holders)) ? Number(holders) : null);

  return (
    <div className="w-full">
      {/* Desktop Layout: Chart (70%) + Stats (30%) */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Chart Section */}
        <div className="w-full lg:w-[70%]">
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="text-xl font-semibold text-white mb-4">Price Chart</h3>
            <TokenChart data={chartData} loading={loading} />
          </div>
        </div>

        {/* Stats Card Section */}
        <div className="w-full lg:w-[30%]">
          <div className="bg-gray-900 rounded-lg p-6 space-y-4">
            <h3 className="text-xl font-semibold text-white mb-4">Token Stats</h3>

            {/* Price */}
            <div className="border-b border-gray-700 pb-3">
              <div className="text-sm text-gray-400">Price</div>
              <div className="text-lg font-semibold text-white">
                {priceUsd ? formatNumber(priceUsd, 6) : 'N/A'}
              </div>
            </div>

            {/* Market Cap */}
            <div className="border-b border-gray-700 pb-3">
              <div className="text-sm text-gray-400">Market Cap</div>
              <div className="text-lg font-semibold text-white">
                {formatNumber(marketCap)}
              </div>
            </div>

            {/* Liquidity */}
            <div className="border-b border-gray-700 pb-3">
              <div className="text-sm text-gray-400">Liquidity</div>
              <div className="text-lg font-semibold text-white">
                {formatNumber(liquidityUsd)}
              </div>
            </div>

            {/* 24h Volume */}
            <div className="border-b border-gray-700 pb-3">
              <div className="text-sm text-gray-400">24h Volume</div>
              <div className="text-lg font-semibold text-white">
                {formatNumber(volume24h)}
              </div>
            </div>

            {/* Holder Count */}
            <div className="border-b border-gray-700 pb-3">
              <div className="text-sm text-gray-400 flex items-center gap-2">
                Holder Count
                {holderData?.source === 'unavailable' && (
                  <span 
                    className="text-xs text-yellow-500 cursor-help" 
                    title="Holder data not available from free-tier APIs"
                  >
                    ⓘ
                  </span>
                )}
              </div>
              <div className="text-lg font-semibold text-white">
                {loading ? (
                  <span className="text-gray-500">Loading...</span>
                ) : (
                  formatHolders(resolvedHolders)
                )}
              </div>
            </div>

            {/* Buys vs Sells */}
            {transferData && (
              <div className="border-b border-gray-700 pb-3">
                <div className="text-sm text-gray-400">Buys vs Sells</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-sm text-green-400">
                    Buys: {transferData.buyCount}
                  </div>
                  <div className="text-sm text-gray-500">|</div>
                  <div className="text-sm text-red-400">
                    Sells: {transferData.sellCount}
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xs text-gray-400">Net Buy Ratio</div>
                  <div 
                    className={`text-lg font-semibold ${
                      transferData.netBuyRatio > 0 
                        ? 'text-green-400' 
                        : transferData.netBuyRatio < 0 
                        ? 'text-red-400' 
                        : 'text-gray-400'
                    }`}
                  >
                    {transferData.netBuyRatio > 0 ? '+' : ''}
                    {(transferData.netBuyRatio * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            )}

            {/* Total Transfers */}
            {transferData && (
              <div className="pb-3">
                <div className="text-sm text-gray-400">Recent Transfers</div>
                <div className="text-lg font-semibold text-white">
                  {transferData.totalTransfers}
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && !transferData && (
              <div className="text-center py-4">
                <div className="text-sm text-gray-500">Loading analytics...</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile-friendly note */}
      <div className="mt-4 text-xs text-gray-500 text-center lg:hidden">
        Rotate device for better chart viewing experience
      </div>
    </div>
  );
};
