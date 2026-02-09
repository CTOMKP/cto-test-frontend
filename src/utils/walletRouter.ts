/**
 * WalletRouter Utility
 * Routes wallet operations based on chain (SOLANA vs MOVEMENT)
 * 
 * Handles the hybrid wallet system:
 * - SOLANA: Privy-managed Solana wallets (signTransaction) [trading disabled for now]
 * - MOVEMENT: Server-side signing via backend
 */

import { useWallets } from '@privy-io/react-auth';
import { VersionedTransaction, Connection, PublicKey } from '@solana/web3.js';
import { getMovementWallet } from '../lib/movement-wallet';
import axios from 'axios';
import toast from 'react-hot-toast';
import { isHex, toHex } from 'viem';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';

export type ChainType = 'SOLANA' | 'MOVEMENT' | 'BASE' | 'ETHEREUM' | 'BSC' | 'SUI';

export interface TradeExecutionParams {
  chain: ChainType;
  quote: any; // Jupiter or Panora quote response
  signedTransaction?: string; // For Solana: base64 signed transaction, for Base: tx hash
}

export interface WalletRouterResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

/**
 * Hook to get wallet router utilities
 * Must be used within a React component
 */
export function useWalletRouter() {
  const { wallets } = useWallets();

  /**
   * Get Solana wallet from Privy
   */
  const getSolanaWallet = () => {
    const solanaWallet = wallets.find(
      (w) => w.chainId === 'solana:mainnet' || w.chainId === 'solana:devnet'
    );
    
    if (!solanaWallet) {
      throw new Error('No Solana wallet found. Please ensure you have a Solana wallet connected.');
    }
    
    return solanaWallet;
  };

  const getBaseWallet = () => {
    let baseWallet = wallets.find((w) => (w as any).chainType === 'ethereum');
    if (!baseWallet) {
      baseWallet = wallets.find(
        (w) =>
          w.chainId === 'eip155:8453' ||
          w.chainId === 'eip155:1' ||
          w.chainId === 'eip155:84532'
      );
    }
    if (!baseWallet) {
      baseWallet = wallets.find(
        (w) => w.chainId?.startsWith('eip155:') || w.walletClientType === 'privy'
      );
    }
    if (!baseWallet) {
      throw new Error('No Base/Ethereum wallet found. Please connect an Ethereum wallet in Privy.');
    }
    return baseWallet;
  };

  const normalizeHex = (value?: string) => {
    if (!value) return undefined;
    if (isHex(value)) return value;
    try {
      return toHex(BigInt(value));
    } catch {
      return undefined;
    }
  };

  const sendBaseTransaction = async (transaction: any): Promise<string> => {
    const baseWallet = getBaseWallet();
    if (!transaction?.to || !transaction?.data) {
      throw new Error('Invalid Base transaction data');
    }

    const provider = await baseWallet.getEthereumProvider();
    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: baseWallet.address,
          to: transaction.to,
          data: transaction.data,
          value: normalizeHex(transaction.value) || '0x0',
          gas: normalizeHex(transaction.gas),
          gasPrice: normalizeHex(transaction.gasPrice),
        },
      ],
    });

    if (!txHash || typeof txHash !== 'string') {
      throw new Error('Failed to send Base transaction');
    }

    return txHash;
  };

  /**
   * Get Movement wallet (from Privy or backend)
   */
  const getMovementWalletAddress = async (privyUser: any): Promise<{
    address: string;
    publicKey: string;
  }> => {
    // First, try to get from Privy
    let movementWallet = getMovementWallet(privyUser);
    
    if (movementWallet && movementWallet.address && movementWallet.publicKey) {
      return {
        address: movementWallet.address,
        publicKey: movementWallet.publicKey,
      };
    }

    // Fallback: Check backend database
    try {
      const token = localStorage.getItem('cto_auth_token');
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await axios.get(
        `${API_BASE}/api/v1/auth/privy/wallets`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const walletsData = response.data?.data?.wallets || response.data?.wallets || [];
      const dbWallet = walletsData.find(
        (w: any) =>
          w.blockchain === 'MOVEMENT' ||
          w.blockchain === 'APTOS' ||
          w.walletClient === 'APTOS_EMBEDDED'
      );

      if (dbWallet && dbWallet.address) {
        return {
          address: dbWallet.address,
          publicKey: dbWallet.publicKey || dbWallet.address, // Fallback if pubkey missing
        };
      }
    } catch (error) {
      console.warn('Failed to fetch Movement wallet from backend:', error);
    }

    throw new Error(
      'No Movement wallet found. Please go to Profile and click "Sync Wallets" or create a Movement wallet.'
    );
  };

  /**
   * Sign and execute a Solana trade
   */
  const executeSolanaTrade = async (
    swapTransactionBase64: string,
    quote: any
  ): Promise<WalletRouterResult> => {
    try {
      const solanaWallet = getSolanaWallet();

      // Deserialize the transaction
      const swapTransactionBuf = Buffer.from(swapTransactionBase64, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      // Sign with Privy Solana wallet
      // Privy Solana wallets may expose signTransaction in different ways
      toast.loading('Signing Solana transaction...', { id: 'solana-sign' });
      
      let signedTx: VersionedTransaction;
      
      // Try different methods to sign the transaction
      // Method 1: Direct signTransaction (if available)
      if ('signTransaction' in solanaWallet && typeof (solanaWallet as any).signTransaction === 'function') {
        signedTx = await (solanaWallet as any).signTransaction(transaction);
      }
      // Method 2: Provider-based signing
      else if ((solanaWallet as any).provider && typeof (solanaWallet as any).provider.signTransaction === 'function') {
        signedTx = await (solanaWallet as any).provider.signTransaction(transaction);
      }
      // Method 3: Wallet client signing
      else if ((solanaWallet as any).walletClient && typeof (solanaWallet as any).walletClient.signTransaction === 'function') {
        signedTx = await (solanaWallet as any).walletClient.signTransaction(transaction);
      }
      // Method 4: Use sendTransaction if signTransaction is not available
      // (This would require sending directly, but we need to sign first)
      else {
        throw new Error(
          'Solana wallet signing not available. ' +
          'Please ensure your Solana wallet (Phantom, etc.) is connected and supports transaction signing.'
        );
      }

      // Send to backend for broadcasting
      toast.loading('Broadcasting transaction...', { id: 'solana-broadcast' });
      const token = localStorage.getItem('cto_auth_token');
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await axios.post(
        `${API_BASE}/api/v1/trades/execute`,
        {
          chain: 'solana',
          quote,
          signedTransaction: Buffer.from(signedTx.serialize()).toString('base64'),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const payload = response.data;
      const data = payload?.data ?? payload;
      const txHash = data?.txHash || data?.transactionHash;
      
      if (txHash) {
        toast.success('Trade executed successfully!', { id: 'solana-sign' });
        return {
          success: true,
          transactionHash: txHash,
        };
      }

      throw new Error(payload?.error || data?.error || 'Trade execution failed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to execute Solana trade', { id: 'solana-sign' });
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  };

  /**
   * Execute a Movement trade (server-side signing)
   */
  const executeMovementTrade = async (
    quote: any
  ): Promise<WalletRouterResult> => {
    try {
      toast.loading('Submitting transaction...', { id: 'movement-broadcast' });
      const token = localStorage.getItem('cto_auth_token');
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await axios.post(
        `${API_BASE}/api/v1/trades/execute`,
        {
          chain: 'movement',
          quote,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const payload = response.data;
      const data = payload?.data ?? payload;
      const txHash = data?.txHash || data?.transactionHash;
      
      if (txHash) {
        toast.success('Trade executed successfully!', { id: 'movement-broadcast' });
        return {
          success: true,
          transactionHash: txHash,
        };
      }

      throw new Error(payload?.error || data?.error || 'Trade execution failed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to execute Movement trade', { id: 'movement-broadcast' });
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  };

  /**
   * Execute a Base trade (EVM)
   * Sends tx via wallet, then records trade via backend using tx hash.
   */
  const executeBaseTrade = async (
    chain: 'base' | 'ethereum' | 'bsc',
    transaction: any,
    quote: any
  ): Promise<WalletRouterResult> => {
    try {
      toast.loading('Submitting transaction...', { id: 'base-send' });
      const submittedTxHash = await sendBaseTransaction(transaction);

      const token = localStorage.getItem('cto_auth_token');
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await axios.post(
        `${API_BASE}/api/v1/trades/execute`,
          {
            chain,
            quote,
            signedTransaction: submittedTxHash,
          },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const payload = response.data;
      const data = payload?.data ?? payload;
      const resultTxHash = data?.txHash || data?.transactionHash;
      if (resultTxHash) {
        toast.success('Trade executed successfully!', { id: 'base-send' });
        return {
          success: true,
          transactionHash: resultTxHash,
        };
      }

      throw new Error(payload?.error || data?.error || 'Trade execution failed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to execute Base trade', { id: 'base-send' });
      return {
        success: false,
        error: error.message || 'Unknown error',
      };
    }
  };

  /**
   * Main router function - routes to appropriate wallet based on chain
   */
  const executeTrade = async (
    chain: ChainType,
    privyUser: any,
    params: {
      // For Solana: base64 transaction from Jupiter
      transaction?: any;
      quote: any;
    }
  ): Promise<WalletRouterResult> => {
    if (chain === 'SOLANA') {
      return {
        success: false,
        error: 'Solana trading is disabled. This chain is read-only for now.',
      };
    }
    if (chain === 'BASE' || chain === 'ETHEREUM' || chain === 'BSC') {
      if (!params.transaction || typeof params.transaction !== 'object') {
        throw new Error('transaction is required for Base trades');
      }
      const chainKey = chain === 'ETHEREUM' ? 'ethereum' : chain === 'BSC' ? 'bsc' : 'base';
      return executeBaseTrade(chainKey, params.transaction, params.quote);
    } else if (chain === 'MOVEMENT') {
      return executeMovementTrade(params.quote);
    } else {
      throw new Error(`Unsupported chain: ${chain}`);
    }
  };

  return {
    getSolanaWallet,
    getMovementWalletAddress,
    sendBaseTransaction,
    executeSolanaTrade,
    executeMovementTrade,
    executeBaseTrade,
    executeTrade,
  };
}

/**
 * Standalone function to get wallet address for a chain
 * (Useful when hooks can't be used)
 */
export async function getWalletAddressForChain(
  chain: ChainType,
  privyUser: any,
  wallets?: any[]
): Promise<string> {
  if (chain === 'SOLANA') {
    if (!wallets) {
      throw new Error('Wallets array required for Solana');
    }
    // Privy Solana wallet detection - check chainType first
    let solanaWallet = wallets.find(
      (w) => (w as any).chainType === 'solana'
    );
    
    // Fallback: check by chainId
    if (!solanaWallet) {
      solanaWallet = wallets.find(
        (w) => w.chainId === 'solana:mainnet' || w.chainId === 'solana:devnet'
      );
    }
    
    // Fallback: check by walletClientType or coinType
    if (!solanaWallet) {
      solanaWallet = wallets.find(
        (w) => w.walletClientType === 'solana' || w.coinType === 501
      );
    }
    
    // Last fallback: check by address format (Solana addresses are base58, 32-44 chars)
    if (!solanaWallet) {
      solanaWallet = wallets.find((w) => {
        const addr = w.address || '';
        // Solana addresses are base58 encoded, typically 32-44 characters
        return addr.length >= 32 && addr.length <= 44 && !addr.startsWith('0x');
      });
    }
    
    if (!solanaWallet) {
      throw new Error('No Solana wallet found. Please enable Solana in Privy Dashboard (Embedded Wallets -> Chains) and connect a Solana wallet.');
    }
    return solanaWallet.address;
  } else if (chain === 'BASE' || chain === 'ETHEREUM' || chain === 'BSC') {
    // Base uses Privy Ethereum wallet (EVM-compatible)
    // User must switch to Chain ID 8453 before signing
    if (!wallets) {
      throw new Error('Wallets array required for Base');
    }
    
    // Check for Ethereum wallet by chainType (primary method)
    let baseWallet = wallets.find(
      (w) => (w as any).chainType === 'ethereum'
    );
    
    // Fallback: check by chainId for Base (8453) or Ethereum (1)
    if (!baseWallet) {
      baseWallet = wallets.find(
        (w) => w.chainId === 'eip155:8453' || w.chainId === 'eip155:1' || w.chainId === 'eip155:84532'
      );
    }
    
    // Last fallback: any EVM wallet
    if (!baseWallet) {
      baseWallet = wallets.find(
        (w) => w.chainId?.startsWith('eip155:') || w.walletClientType === 'privy'
      );
    }
    
    if (!baseWallet) {
      throw new Error('No EVM wallet found. Please connect an Ethereum wallet in Privy.');
    }
    
    // Note: Frontend should ensure wallet is switched to Chain ID 8453 before signing
    return baseWallet.address;
  } else if (chain === 'MOVEMENT') {
    // For Movement, get from Privy or backend
    let movementWallet = getMovementWallet(privyUser);
    
    if (movementWallet && movementWallet.address) {
      return movementWallet.address;
    }

    // Fallback: Check backend database
    try {
      const token = localStorage.getItem('cto_auth_token');
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await axios.get(
        `${API_BASE}/api/v1/auth/privy/wallets`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const walletsData = response.data?.data?.wallets || response.data?.wallets || [];
      const dbWallet = walletsData.find(
        (w: any) =>
          w.blockchain === 'MOVEMENT' ||
          w.blockchain === 'APTOS' ||
          w.walletClient === 'APTOS_EMBEDDED'
      );

      if (dbWallet && dbWallet.address) {
        return dbWallet.address;
      }
    } catch (error) {
      console.warn('Failed to fetch Movement wallet from backend:', error);
    }

    throw new Error(
      'No Movement wallet found. Please go to Profile and click "Sync Wallets" or create a Movement wallet.'
    );
  } else {
    throw new Error(`Unsupported chain: ${chain}`);
  }
}
