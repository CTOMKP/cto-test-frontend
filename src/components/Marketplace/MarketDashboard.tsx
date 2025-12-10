import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface MarketData {
  id: string;
  contractAddress: string;
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
  change1h: number;
  change6h: number;
  liquidityUsd: number;
  marketCap: number;
  volume24h: number;
  holders: number;
  age: string;
  riskScore: number;
  communityScore: number;
  logoUrl: string | null;
  category: string;
}

interface MarketStats {
  totalMarketCap: number;
  marketCapChange: number;
  totalVolume: number;
  activeTokens: number;
}

export const MarketDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [marketStats, setMarketStats] = useState<MarketStats>({
    totalMarketCap: 0,
    marketCapChange: 0,
    totalVolume: 0,
    activeTokens: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState('24h');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [selectedTimeframe, selectedCategory]);

  const fetchMarketData = async () => {
    try {
      setLoading(true);
      const categoryParam = selectedCategory === 'all' ? '' : `&category=${selectedCategory}`;
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com'}/api/listing/listings?limit=100${categoryParam}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('Backend not running or no data yet, using mock data');
          // Use mock data when backend is not available
          const mockData = generateMockMarketData();
          setMarketData(mockData);
          setIsUsingMockData(true);
          setMarketStats({
            totalMarketCap: 3190000000000, // $3.19T
            marketCapChange: -1.02,
            totalVolume: 45000000000, // $45B
            activeTokens: mockData.length
          });
          return;
        }
        throw new Error(`HTTP ${response.status}: Failed to fetch market data`);
      }
      
      const data = await response.json();
      const listings = data.items || [];
      setMarketData(listings);
      setIsUsingMockData(false);
      
      // Calculate market stats
      const totalMarketCap = listings.reduce((sum: number, item: MarketData) => sum + (item.marketCap || 0), 0);
      const totalVolume = listings.reduce((sum: number, item: MarketData) => sum + (item.volume24h || 0), 0);
      const activeTokens = listings.length;
      
      setMarketStats({
        totalMarketCap,
        marketCapChange: -1.02, // Placeholder - would need historical data
        totalVolume,
        activeTokens
      });
    } catch (error) {
      console.error('Failed to fetch market data:', error);
      // Use mock data as fallback
      const mockData = generateMockMarketData();
      setMarketData(mockData);
      setIsUsingMockData(true);
      setMarketStats({
        totalMarketCap: 3190000000000,
        marketCapChange: -1.02,
        totalVolume: 45000000000,
        activeTokens: mockData.length
      });
      toast.error('Using mock data - backend not available');
    } finally {
      setLoading(false);
    }
  };

  const generateMockMarketData = (): MarketData[] => {
    const tokens = [
      { symbol: 'SOL', name: 'Solana', basePrice: 197.97 },
      { symbol: 'BONK', name: 'Bonk', basePrice: 0.00001234 },
      { symbol: 'WIF', name: 'Dogwifhat', basePrice: 2.45 },
      { symbol: 'PEPE', name: 'Pepe', basePrice: 0.00000123 },
      { symbol: 'DOGE', name: 'Dogecoin', basePrice: 0.08 },
      { symbol: 'SHIB', name: 'Shiba Inu', basePrice: 0.0000089 },
      { symbol: 'FLOKI', name: 'Floki', basePrice: 0.000123 },
      { symbol: 'BABYDOGE', name: 'Baby Doge Coin', basePrice: 0.0000000123 },
      { symbol: 'AKITA', name: 'Akita Inu', basePrice: 0.000000123 },
      { symbol: 'KISHU', name: 'Kishu Inu', basePrice: 0.0000000123 }
    ];

    return tokens.map((token, index) => ({
      id: `mock-${index}`,
      contractAddress: `mock-${token.symbol.toLowerCase()}-${index}`,
      symbol: token.symbol,
      name: token.name,
      priceUsd: token.basePrice * (0.8 + Math.random() * 0.4), // ±20% variation
      change24h: (Math.random() - 0.5) * 200, // -100% to +100%
      change1h: (Math.random() - 0.5) * 20, // -10% to +10%
      change6h: (Math.random() - 0.5) * 40, // -20% to +20%
      liquidityUsd: Math.random() * 10000000, // Up to $10M
      marketCap: Math.random() * 1000000000, // Up to $1B
      volume24h: Math.random() * 50000000, // Up to $50M
      holders: Math.floor(Math.random() * 100000), // Up to 100k holders
      age: `${Math.floor(Math.random() * 30)}d ${Math.floor(Math.random() * 24)}h`,
      riskScore: Math.random() * 100, // 0-100 (lower = safer)
      communityScore: Math.random() * 100, // 0-100
      logoUrl: null,
      category: 'MEME'
    }));
  };

  const getTopGainers = () => {
    return marketData
      .filter(item => item.change24h > 0)
      .sort((a, b) => b.change24h - a.change24h)
      .slice(0, 10);
  };

  const getTopLosers = () => {
    return marketData
      .filter(item => item.change24h < 0)
      .sort((a, b) => a.change24h - b.change24h)
      .slice(0, 10);
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
    return num.toFixed(decimals);
  };

  const formatPercentage = (num: number | null | undefined) => {
    if (num === null || num === undefined || !Number.isFinite(num)) {
      return '0.00%';
    }
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  };

  const getChangeColor = (change: number | null | undefined) => {
    if (change === null || change === undefined || !Number.isFinite(change)) {
      return 'text-gray-500';
    }
    if (change > 0) return 'text-green-500';
    if (change < 0) return 'text-red-500';
    return 'text-gray-500';
  };

  const handleTokenClick = (token: MarketData) => {
    // Navigate to token detail page
    navigate(`/listing/${token.contractAddress}`, {
      state: { 
        token,
        fromMarket: true 
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">CTO Marketplace</h1>
            <p className="text-gray-400">Real-time crypto market data and analytics</p>
          </div>
          {isUsingMockData && (
            <div className="bg-yellow-900 border border-yellow-600 text-yellow-200 px-4 py-2 rounded-lg">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span className="text-sm">Demo Data</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Market Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-gray-400 text-sm mb-2">Total Market Cap</h3>
          <div className="text-2xl font-bold text-white">
            ${formatNumber(marketStats.totalMarketCap)}
          </div>
          <div className={`text-sm ${getChangeColor(marketStats.marketCapChange)}`}>
            {formatPercentage(marketStats.marketCapChange)}
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-gray-400 text-sm mb-2">24h Volume</h3>
          <div className="text-2xl font-bold text-white">
            ${formatNumber(marketStats.totalVolume)}
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-gray-400 text-sm mb-2">Active Tokens</h3>
          <div className="text-2xl font-bold text-white">
            {marketStats.activeTokens.toLocaleString()}
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-gray-400 text-sm mb-2">Market Status</h3>
          <div className="text-2xl font-bold text-green-500">
            🟢 Live
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select
          value={selectedTimeframe}
          onChange={(e) => setSelectedTimeframe(e.target.value)}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-600"
          aria-label="Select timeframe"
        >
          <option value="1h">1 Hour</option>
          <option value="6h">6 Hours</option>
          <option value="24h">24 Hours</option>
          <option value="7d">7 Days</option>
        </select>
        
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-600"
          aria-label="Select category"
        >
          <option value="all">All Categories</option>
          <option value="MEME">Memes</option>
          <option value="DEFI">DeFi</option>
          <option value="NFT">NFTs</option>
          <option value="OTHER">Other</option>
          <option value="UNKNOWN">Unknown</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Gainers */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">📈 Top Gainers</h2>
          <div className="space-y-3">
            {getTopGainers().map((item, index) => (
              <div 
                key={item.id} 
                onClick={() => handleTokenClick(item)}
                className="flex items-center justify-between p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-white font-semibold">{item.symbol}</div>
                    <div className="text-gray-400 text-sm">{item.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold">${item.priceUsd?.toFixed(6) || '0'}</div>
                  <div className={`text-sm ${getChangeColor(item.change24h)}`}>
                    {formatPercentage(item.change24h)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Losers */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">📉 Top Losers</h2>
          <div className="space-y-3">
            {getTopLosers().map((item, index) => (
              <div 
                key={item.id} 
                onClick={() => handleTokenClick(item)}
                className="flex items-center justify-between p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-white font-semibold">{item.symbol}</div>
                    <div className="text-gray-400 text-sm">{item.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-semibold">${item.priceUsd?.toFixed(6) || '0'}</div>
                  <div className={`text-sm ${getChangeColor(item.change24h)}`}>
                    {formatPercentage(item.change24h)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Market Overview */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">📊 Market Overview</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Total Tokens</span>
              <span className="text-white font-semibold">{marketStats.activeTokens}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Avg. Risk Score</span>
              <span className="text-yellow-500 font-semibold">
                {marketData.length > 0 
                  ? (marketData.reduce((sum, item) => sum + (item.riskScore || 0), 0) / marketData.length).toFixed(1)
                  : 'N/A'
                }
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Avg. Community Score</span>
              <span className="text-blue-500 font-semibold">
                {marketData.length > 0 
                  ? (marketData.reduce((sum, item) => sum + (item.communityScore || 0), 0) / marketData.length).toFixed(1)
                  : 'N/A'
                }
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Total Holders</span>
              <span className="text-white font-semibold">
                {formatNumber(marketData.reduce((sum, item) => sum + (item.holders || 0), 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* All Tokens Table */}
      <div className="mt-8 bg-gray-800 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">All Tokens</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Token</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">24h %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Volume</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Market Cap</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Holders</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {marketData.slice(0, 20).map((item) => (
                <tr 
                  key={item.id} 
                  onClick={() => handleTokenClick(item)}
                  className="hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center mr-3">
                        {item.logoUrl ? (
                          <img src={item.logoUrl} alt={item.symbol} className="w-8 h-8 rounded-full" />
                        ) : (
                          <span className="text-sm font-bold">{item.symbol?.charAt(0) || '?'}</span>
                        )}
                      </div>
                      <div>
                        <div className="text-white font-semibold">{item.symbol}</div>
                        <div className="text-gray-400 text-sm">{item.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-white">
                    ${item.priceUsd?.toFixed(6) || '0'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap ${getChangeColor(item.change24h)}`}>
                    {formatPercentage(item.change24h)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-white">
                    ${formatNumber(item.volume24h || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-white">
                    ${formatNumber(item.marketCap || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-white">
                    {formatNumber(item.holders || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      (item.riskScore || 0) >= 70 ? 'bg-green-900 text-green-300' :  // 70-100 = Low Risk (safe)
                      (item.riskScore || 0) >= 40 ? 'bg-yellow-900 text-yellow-300' : // 40-69 = Medium Risk (moderate)
                      'bg-red-900 text-red-300'  // 0-39 = High Risk (dangerous)
                    }`}>
                      {item.riskScore?.toFixed(1) || 'N/A'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
