import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface FundingModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const FundingModal: React.FC<FundingModalProps> = ({ isOpen, onClose, userId }) => {
  const [fundingMethods, setFundingMethods] = useState<any[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('USDC');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadFundingMethods();
    }
  }, [isOpen, userId]);

  const loadFundingMethods = async () => {
    try {
      const response = await axios.get(`https://api.ctomarketplace.com/api/funding/methods/${userId}`);
      const methods = response.data?.methods || response.data?.data?.methods || [];
      setFundingMethods(Array.isArray(methods) ? methods : []);
    } catch (error) {
      console.error('Failed to load funding methods:', error);
      // Use default methods if API fails
      setFundingMethods([
        {
          type: 'onchain_deposit',
          name: 'Direct On-Chain Deposit',
          description: 'Send USDC directly to your Circle wallet address from any supported chain',
          supportedChains: ['Ethereum', 'Polygon', 'Avalanche', 'Base', 'Arbitrum', 'Optimism'],
          minAmount: 10,
          maxAmount: 10000,
          fee: 'Network gas fees only',
          processingTime: '1-5 minutes',
          instructions: [
            'Copy your wallet address',
            'Send USDC from your external wallet',
            'Wait for confirmation',
            'USDC appears in your Circle wallet'
          ]
        },
        {
          type: 'cctp_transfer',
          name: 'CCTP Cross-Chain Transfer',
          description: 'Transfer USDC from another chain using Circle CCTP protocol',
          supportedChains: ['Ethereum', 'Polygon', 'Avalanche', 'Base', 'Arbitrum', 'Optimism'],
          minAmount: 10,
          maxAmount: 10000,
          fee: 'CCTP fees + gas',
          processingTime: '5-15 minutes',
          instructions: [
            'Use the Cross-Chain Bridge above',
            'Select source and destination chains',
            'Enter amount and confirm',
            'USDC transfers automatically'
          ]
        },
        {
          type: 'centralized_exchange',
          name: 'Centralized Exchange',
          description: 'Buy USDC on exchanges and transfer to your wallet',
          supportedExchanges: ['Coinbase', 'Binance', 'Kraken', 'KuCoin'],
          minAmount: 25,
          maxAmount: 50000,
          fee: 'Exchange fees + withdrawal fees',
          processingTime: '10-60 minutes',
          instructions: [
            'Buy USDC on your preferred exchange',
            'Withdraw to your Circle wallet address',
            'Wait for blockchain confirmation',
            'USDC appears in your wallet'
          ]
        },
        {
          type: 'decentralized_exchange',
          name: 'DEX Swap',
          description: 'Swap other tokens for USDC using decentralized exchanges',
          supportedDEXs: ['Uniswap', 'PancakeSwap', 'SushiSwap', '1inch'],
          minAmount: 10,
          maxAmount: 10000,
          fee: 'DEX fees + gas',
          processingTime: '2-10 minutes',
          instructions: [
            'Connect your wallet to a DEX',
            'Swap your tokens for USDC',
            'Send USDC to your Circle wallet',
            'Wait for confirmation'
          ]
        }
      ]);
    }
  };

  const handleDeposit = async () => {
    if (!selectedMethod || !amount || parseFloat(amount) <= 0) {
      alert('Please select a funding method and enter a valid amount');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await axios.post('https://api.ctomarketplace.com/api/funding/deposit', {
        userId: userId,
        amount: parseFloat(amount),
        currency: currency,
        paymentMethod: selectedMethod
      });

      setResult({
        success: true,
        data: response.data
      });
    } catch (error: any) {
      console.error('Deposit failed:', error);
      setResult({
        success: false,
        error: error.response?.data?.message || error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">💰 Fund Your Wallet</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Funding Method
            </label>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
              aria-label="Select funding method"
            >
              <option value="">Select a method</option>
              {fundingMethods.map((method) => (
                <option key={method.type} value={method.type}>
                  {method.name} - {method.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount
            </label>
            <div className="flex">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="flex-1 p-2 border border-gray-300 rounded-l-md"
                min="0"
                step="0.01"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="p-2 border border-gray-300 rounded-r-md border-l-0"
              >
                <option value="USDC">USDC</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {selectedMethod && (
            <div className="bg-blue-50 p-4 rounded-md">
              <h4 className="font-medium text-blue-900 mb-3">Method Details:</h4>
              {fundingMethods
                .filter(m => m && m.type === selectedMethod)
                .map(method => (
                  <div key={method.type} className="text-sm text-blue-800 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <p><strong>Fee:</strong> {method.fee || 'N/A'}</p>
                      <p><strong>Processing:</strong> {method.processingTime || 'N/A'}</p>
                      <p><strong>Min Amount:</strong> ${method.minAmount || 'N/A'}</p>
                      <p><strong>Max Amount:</strong> ${method.maxAmount || 'N/A'}</p>
                    </div>
                    
                    {method.supportedChains && Array.isArray(method.supportedChains) && (
                      <div>
                        <p><strong>Supported Chains:</strong></p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {method.supportedChains.map((chain: string) => (
                            <span key={chain} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                              {chain}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {method.supportedExchanges && Array.isArray(method.supportedExchanges) && (
                      <div>
                        <p><strong>Supported Exchanges:</strong></p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {method.supportedExchanges.map((exchange: string) => (
                            <span key={exchange} className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                              {exchange}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {method.supportedDEXs && Array.isArray(method.supportedDEXs) && (
                      <div>
                        <p><strong>Supported DEXs:</strong></p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {method.supportedDEXs.map((dex: string) => (
                            <span key={dex} className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                              {dex}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {method.instructions && Array.isArray(method.instructions) && (
                      <div>
                        <p><strong>Instructions:</strong></p>
                        <ol className="list-decimal list-inside mt-1 space-y-1">
                          {method.instructions.map((instruction: string, index: number) => (
                            <li key={index} className="text-xs">{instruction}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          )}

          <button
            onClick={handleDeposit}
            disabled={isLoading || !selectedMethod || !amount}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isLoading ? 'Processing...' : 'Create Deposit'}
          </button>

          {result && (
            <div className={`p-3 rounded-md ${
              result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <h4 className={`font-medium ${
                result.success ? 'text-green-900' : 'text-red-900'
              }`}>
                {result.success ? '✅ Deposit Created!' : '❌ Deposit Failed'}
              </h4>
              {result.success ? (
                <div className="text-sm text-green-800">
                  <p><strong>Deposit ID:</strong> {result.data.depositId}</p>
                  <p><strong>Status:</strong> {result.data.status}</p>
                  <p><strong>Amount:</strong> {result.data.amount} {result.data.currency}</p>
                  <p><strong>Next Step:</strong> {result.data.nextStep}</p>
                  
                  {result.data.instructions && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <h5 className="font-medium text-blue-900 mb-2">📋 Funding Instructions:</h5>
                      <p className="text-blue-800 mb-2"><strong>Method:</strong> {result.data.instructions.method}</p>
                      <p className="text-blue-800 mb-2"><strong>Wallet Address:</strong> 
                        <code className="bg-blue-100 px-2 py-1 rounded text-xs ml-1">{result.data.instructions.walletAddress}</code>
                        <button 
                          onClick={() => navigator.clipboard.writeText(result.data.instructions.walletAddress)}
                          className="ml-2 text-blue-600 hover:text-blue-800 underline text-xs"
                        >
                          📋 Copy
                        </button>
                      </p>
                      <p className="text-blue-800 mb-2"><strong>Blockchain:</strong> {result.data.instructions.blockchain}</p>
                      <p className="text-blue-800 mb-2"><strong>Amount:</strong> {result.data.instructions.amount}</p>
                      <p className="text-blue-800 mb-2">{result.data.instructions.note}</p>
                      {result.data.instructions.explorer && (
                        <p className="text-blue-800">
                          <strong>View on Explorer:</strong> 
                          <a href={result.data.instructions.explorer} target="_blank" rel="noopener noreferrer" 
                             className="text-blue-600 hover:text-blue-800 underline ml-1">
                            {result.data.instructions.blockchain} Explorer
                          </a>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-red-800"><strong>Error:</strong> {result.error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FundingModal;
