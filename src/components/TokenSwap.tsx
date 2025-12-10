import React, { useState } from 'react';
import axios from 'axios';

interface TokenSwapProps {
  onClose?: () => void;
}

const TokenSwap: React.FC<TokenSwapProps> = ({ onClose }) => {
  const [fromToken, setFromToken] = useState('USDC');
  const [toToken, setToToken] = useState('PEPE');
  const [amount, setAmount] = useState('');
  const [chain, setChain] = useState('ETHEREUM');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSwap = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      // Get current user email from localStorage
      const userEmail = localStorage.getItem('cto_user_email') || localStorage.getItem('userEmail');
      
      if (!userEmail) {
        setResult({
          success: false,
          error: 'Please login first to use token swap'
        });
        setIsLoading(false);
        return;
      }

      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';
      
      console.log('🔄 Calling swap API:', `${backendUrl}/api/transfers/panora/swap`);
      console.log('📧 User email:', userEmail);
      
      const response = await axios.post(`${backendUrl}/api/transfers/panora/swap`, {
        userId: userEmail,
        fromToken: fromToken,
        toToken: toToken,
        amount: parseFloat(amount),
        chain: chain,
        slippage: 0.5
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Swap response:', response.data);

      setResult({
        success: true,
        data: response.data
      });
    } catch (error: any) {
      console.error('Swap failed:', error);
      setResult({
        success: false,
        error: error.response?.data?.message || error.message
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="token-swap-container">
      <div className="swap-header">
        <h2>🔄 Token Swap</h2>
        {onClose && (
          <button onClick={onClose} className="close-button">
            ×
          </button>
        )}
      </div>
      
      <div className="swap-content" style={{ padding: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label>From Token:</label>
          <select 
            value={fromToken} 
            onChange={(e) => setFromToken(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            aria-label="Select from token"
          >
            <option value="USDC">USDC</option>
            <option value="ETH">ETH</option>
            <option value="USDT">USDT</option>
          </select>
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label>To Token:</label>
          <select 
            value={toToken} 
            onChange={(e) => setToToken(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            aria-label="Select to token"
          >
            <option value="PEPE">PEPE</option>
            <option value="DOGE">DOGE</option>
            <option value="SHIB">SHIB</option>
            <option value="USDC">USDC</option>
          </select>
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label>Chain:</label>
          <select 
            value={chain} 
            onChange={(e) => setChain(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            aria-label="Select blockchain"
          >
            <option value="ETHEREUM">Ethereum</option>
            <option value="BASE">Base</option>
            <option value="ARBITRUM">Arbitrum</option>
            <option value="OPTIMISM">Optimism</option>
            <option value="POLYGON">Polygon</option>
            <option value="AVALANCHE">Avalanche</option>
          </select>
        </div>
        
        <div style={{ marginBottom: '1rem' }}>
          <label>Amount:</label>
          <input 
            type="number" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount"
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
          />
        </div>
        
        <button 
          onClick={handleSwap}
          disabled={isLoading || !amount}
          style={{
            backgroundColor: '#00d4aa',
            color: 'white',
            padding: '1rem 2rem',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1.1rem',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          {isLoading ? 'Swapping...' : '🔄 Swap Tokens'}
        </button>
        
        {result && (
          <div style={{ 
            backgroundColor: result.success ? '#d4edda' : '#f8d7da', 
            padding: '1rem', 
            borderRadius: '8px',
            marginTop: '1rem',
            textAlign: 'left',
            border: `1px solid ${result.success ? '#c3e6cb' : '#f5c6cb'}`
          }}>
            <h4 style={{ color: result.success ? '#155724' : '#721c24' }}>
              {result.success ? '✅ Swap Successful!' : '❌ Swap Failed'}
            </h4>
            {result.success ? (
              <div>
                <p><strong>Status:</strong> {result.data.message}</p>
                {result.data.quote && (
                  <div>
                    <p><strong>Quote Received:</strong> ✅</p>
                    <p><strong>Next Step:</strong> {result.data.nextStep}</p>
                    <details style={{ marginTop: '0.5rem' }}>
                      <summary style={{ cursor: 'pointer', color: '#666' }}>View Quote Details</summary>
                      <pre style={{ 
                        fontSize: '0.8rem', 
                        backgroundColor: '#f5f5f5', 
                        padding: '0.5rem', 
                        marginTop: '0.5rem',
                        borderRadius: '4px',
                        overflow: 'auto',
                        maxHeight: '200px'
                      }}>
                        {JSON.stringify(result.data.quote, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            ) : (
              <p><strong>Error:</strong> {result.error}</p>
            )}
          </div>
        )}
        
        <div style={{ 
          backgroundColor: '#f5f5f5', 
          padding: '1rem', 
          borderRadius: '8px',
          marginTop: '1rem',
          textAlign: 'left'
        }}>
          <h4>How it works:</h4>
          <ol style={{ paddingLeft: '1.5rem' }}>
            <li>Select tokens and enter amount</li>
            <li>Choose the blockchain network</li>
            <li>Click "Swap Tokens" to get quote</li>
            <li>Panora finds the best exchange rate</li>
            <li>Transaction executes via Circle wallet</li>
            <li>Tokens are swapped automatically</li>
          </ol>
          <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
            <strong>Note:</strong> Your Circle wallet is created on APTOS by default. The system will use your APTOS wallet for swaps, even if you select a different chain. This is normal behavior.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TokenSwap;
