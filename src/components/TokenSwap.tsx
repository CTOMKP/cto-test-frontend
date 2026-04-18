import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { usePrivy } from '@privy-io/react-auth';
import { useWalletRouter } from '../utils/walletRouter';

interface TokenSwapProps {
  onClose?: () => void;
}

type TokenMeta = {
  mint: string;
  decimals: number;
};

const unwrapApiData = (payload: any): any => {
  let data = payload?.data ?? payload;
  if (data?.data && !data?.inputMint && !data?.transaction) {
    data = data.data;
  }
  return data;
};

const TokenSwap: React.FC<TokenSwapProps> = ({ onClose }) => {
  const [fromToken, setFromToken] = useState('USDC');
  const [toToken, setToToken] = useState('SOL');
  const [amount, setAmount] = useState('');
  const [chain, setChain] = useState('SOLANA');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { user: privyUser } = usePrivy();
  const { getSolanaWallet, executeTrade } = useWalletRouter();

  const tokenMap = useMemo(() => {
    const rpc = process.env.REACT_APP_SOLANA_RPC_URL || '';
    const isDevnet = rpc.includes('devnet');

    const defaultUsdcMint = isDevnet
      ? '6e5qtpMzrLzDM8R6fHQtoF6d2iybHBYdj56tceKZo9sn'
      : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

    const usdcMint = process.env.REACT_APP_SOLANA_USDC_MINT || defaultUsdcMint;
    const bonkMint =
      process.env.REACT_APP_SOLANA_BONK_MINT ||
      (!isDevnet ? 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263' : '');

    const solanaTokens: Record<string, TokenMeta> = {
      USDC: { mint: usdcMint, decimals: 6 },
      SOL: { mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
    };

    if (bonkMint) {
      solanaTokens.BONK = { mint: bonkMint, decimals: 5 };
    }

    return { SOLANA: solanaTokens };
  }, []);

  const availableTokens = useMemo(() => Object.keys(tokenMap.SOLANA), [tokenMap]);

  useEffect(() => {
    if (!availableTokens.includes(fromToken)) {
      setFromToken(availableTokens[0] || 'USDC');
      return;
    }

    if (!availableTokens.includes(toToken) || toToken === fromToken) {
      const fallback = availableTokens.find((token) => token !== fromToken) || availableTokens[0] || 'SOL';
      setToToken(fallback);
    }
  }, [availableTokens, fromToken, toToken]);

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
        setResult({ success: false, error: 'Please login first to use token swap' });
        setIsLoading(false);
        return;
      }

      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';

      if (chain !== 'SOLANA') {
        throw new Error('Only Solana swaps are supported in this UI right now.');
      }

      const fromMeta = tokenMap.SOLANA[fromToken];
      const toMeta = tokenMap.SOLANA[toToken];
      if (!fromMeta || !toMeta) {
        throw new Error('Unsupported token selection');
      }
      if (fromToken === toToken) {
        throw new Error('From and To token cannot be the same');
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

      const quotePayload = quoteRes.data;
      if (quotePayload?.success === false || quotePayload?.code) {
        throw new Error(quotePayload?.message || 'Failed to get quote');
      }

      const quote = unwrapApiData(quotePayload);
      if (!quote?.inputMint || !quote?.outputMint || !quote?.inAmount || !quote?.rawQuote) {
        console.error('Invalid swap quote payload:', quotePayload);
        throw new Error('Invalid quote response from backend');
      }

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

      const buildPayload = buildRes.data;
      if (buildPayload?.success === false || buildPayload?.code) {
        throw new Error(buildPayload?.message || 'Failed to build swap transaction');
      }

      const buildData = unwrapApiData(buildPayload);
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
      console.error('Swap failed response payload:', error?.response?.data);
      setResult({
        success: false,
        error:
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          'Swap failed',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="token-swap-container">
      <div className="swap-header">
        <h2>Token Swap</h2>
        {onClose && (
          <button onClick={onClose} className="close-button">
            x
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
            {availableTokens.map((token) => (
              <option key={token} value={token}>{token}</option>
            ))}
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
            {availableTokens.map((token) => (
              <option key={token} value={token}>{token}</option>
            ))}
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
          {isLoading ? 'Swapping...' : 'Swap Tokens'}
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
              {result.success ? 'Swap Submitted' : 'Swap Failed'}
            </h4>
            {result.success ? (
              <div>
                <p><strong>Status:</strong> {result.data.message}</p>
                {result.data.txHash && (
                  <p><strong>Tx Hash:</strong> {result.data.txHash}</p>
                )}
              </div>
            ) : (
              <p><strong>Error:</strong> {result.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TokenSwap;
