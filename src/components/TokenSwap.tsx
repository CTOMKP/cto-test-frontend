import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { usePrivy } from '@privy-io/react-auth';
import { useWalletRouter } from '../utils/walletRouter';

interface TokenSwapProps {
  onClose?: () => void;
}

const TokenSwap: React.FC<TokenSwapProps> = ({ onClose }) => {
  const [fromToken, setFromToken] = useState('USDC');
  const [toToken, setToToken] = useState('BONK');
  const [amount, setAmount] = useState('');
  const [chain, setChain] = useState('SOLANA');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { user: privyUser } = usePrivy();
  const { getSolanaWallet, executeTrade } = useWalletRouter();

  const tokenMap = useMemo(() => {
    return {
      SOLANA: {
        USDC: {
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          decimals: 6,
        },
        SOL: {
          mint: 'So11111111111111111111111111111111111111112',
          decimals: 9,
        },
        BONK: {
          mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
          decimals: 5,
        },
      },
    } as const;
  }, []);

  const handleSwap = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const token = localStorage.getItem('cto_auth_token');
      if (!token) {
        setResult({
          success: false,
          error: 'Please login first to use token swap',
        });
        setIsLoading(false);
        return;
      }

      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';

      if (chain !== 'SOLANA') {
        throw new Error('Only Solana swaps are supported in this UI right now.');
      }

      const fromMeta = tokenMap.SOLANA[fromToken as keyof typeof tokenMap.SOLANA];
      const toMeta = tokenMap.SOLANA[toToken as keyof typeof tokenMap.SOLANA];
      if (!fromMeta || !toMeta) {
        throw new Error('Unsupported token selection');
      }

      const amountRaw = Math.floor(parseFloat(amount) * Math.pow(10, fromMeta.decimals));
      if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
        throw new Error('Invalid amount');
      }

      let solWalletAddress = '';
      try {
        solWalletAddress = getSolanaWallet().address;
      } catch (e: any) {
        throw new Error(e?.message || 'No Solana wallet found. Connect a Solana wallet in Privy.');
      }

      const quoteRes = await axios.post(
        `${backendUrl}/api/v1/trades/quote`,
        {
          chain: 'solana',
          inputToken: fromMeta.mint,
          outputToken: toMeta.mint,
          amount: amountRaw.toString(),
          slippageBps: 50,
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const quote = quoteRes.data?.data || quoteRes.data;

      const buildRes = await axios.post(
        `${backendUrl}/api/v1/trades/build-transaction`,
        {
          chain: 'solana',
          quote,
          walletAddress: solWalletAddress,
          slippageBps: 50,
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const buildData = buildRes.data?.data || buildRes.data;
      const unsignedTx = buildData?.transaction;
      if (!unsignedTx) {
        throw new Error('Failed to build swap transaction');
      }

      const execResult = await executeTrade('SOLANA', privyUser, {
        transaction: unsignedTx,
        quote,
      });

      if (!execResult.success) {
        throw new Error(execResult.error || 'Swap failed');
      }

      setResult({
        success: true,
        data: {
          message: 'Swap submitted successfully',
          txHash: execResult.transactionHash,
          quote,
        },
      });
    } catch (error: any) {
      console.error('Swap failed:', error);
      setResult({
        success: false,
        error: error.response?.data?.message || error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="token-swap-container">
      <div className="swap-header">
        <h2>?? Token Swap</h2>
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
            <option value="SOL">SOL</option>
            <option value="BONK">BONK</option>
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
            <option value="BONK">BONK</option>
            <option value="SOL">SOL</option>
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
            <option value="SOLANA">Solana</option>
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
          {isLoading ? 'Swapping...' : '?? Swap Tokens'}
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
              {result.success ? '? Swap Submitted!' : '? Swap Failed'}
            </h4>
            {result.success ? (
              <div>
                <p><strong>Status:</strong> {result.data.message}</p>
                {result.data.txHash && (
                  <p><strong>Tx Hash:</strong> {result.data.txHash}</p>
                )}
                {result.data.quote && (
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
            <li>Jupiter finds the best route (includes Meteora)</li>
            <li>Transaction is signed by your Privy Solana wallet</li>
            <li>Tokens are swapped automatically</li>
          </ol>
          <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
            <strong>Note:</strong> This swap uses Jupiter on Solana. Make sure you have a Solana wallet in Privy and a small amount of SOL for gas.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TokenSwap;
