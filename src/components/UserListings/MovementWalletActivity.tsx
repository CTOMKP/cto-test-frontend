import React, { useEffect, useState, useCallback } from 'react';
import { movementWalletService, WalletBalance, WalletTransaction } from '../../services/movementWalletService';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import { sendMovementTransaction, getMovementWallet } from '../../lib/movement-wallet';
import { useSignRawHash } from "@privy-io/react-auth/extended-chains";
import { usePrivy } from '@privy-io/react-auth';
import toast from 'react-hot-toast';

export const MovementWalletActivity: React.FC = () => {
  const { user: dbUser } = useAuth();
  const { user: privyUser } = usePrivy();
  const { signRawHash } = useSignRawHash();
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);

  // Send Form State
  const [showSendForm, setShowSendForm] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedToken, setSelectedToken] = useState<'MOVE' | 'USDC'>('MOVE');

  // USDC Metadata address for Movement Bardock
  const USDC_METADATA = '0xb89077cfd2a82a0c1450534d49cfd5f2707643155273069bc23a912bcfefdee7';

  // STRATEGIC FIX: Find the wallet ID by directly calling the wallet API
  // This bypasses any issues with the user profile response
  const [isAutoRecovering, setIsAutoRecovering] = useState(false);

  useEffect(() => {
    const findAndSetWallet = async () => {
      const userAny = dbUser as any;
      const userId = userAny?.id || localStorage.getItem('cto_user_id');
      
      // GUARD: Don't run if already recovering or if we already have an active wallet
      if (!userId || activeWalletId || isAutoRecovering) return;

      console.log('🔍 MovementWalletActivity: Fetching wallet directly...', { userId });

      try {
        const token = localStorage.getItem('cto_auth_token');
        const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';
        
        const response = await fetch(`${API_BASE}/api/v1/auth/privy/wallets`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        // Handle nested response from TransformInterceptor
        const walletsData = data?.data?.wallets || data?.wallets || [];
        
        // STRATEGIC FIX: Prioritize the wallet that matches the current Privy account
        const privyMoveWallet = getMovementWallet(privyUser);
        let moveWallet = null;
        
        if (privyMoveWallet) {
          moveWallet = walletsData.find((w: any) => 
            w.address.toLowerCase() === privyMoveWallet.address.toLowerCase()
          );
        }
        
        // Fallback to any Movement wallet if no match found
        if (!moveWallet) {
          moveWallet = walletsData.find((w: any) => 
            w.blockchain === 'MOVEMENT' || w.blockchain === 'APTOS'
          );
        }

        if (moveWallet) {
          console.log('✅ Found Movement wallet directly:', moveWallet.id);
          setActiveWalletId(moveWallet.id);
          localStorage.setItem('cto_wallet_id', moveWallet.id);
        } else {
          console.warn('⚠️ No Movement wallet found. Attempting AUTO-RECOVERY sync...');
          setIsAutoRecovering(true);
          
          const syncResponse = await fetch(`${API_BASE}/api/v1/auth/privy/sync-wallets`, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          const syncData = await syncResponse.json();
          console.log('🔄 Auto-Recovery Sync Result:', syncData);
          
          // Re-fetch once after sync
          const retryResponse = await fetch(`${API_BASE}/api/v1/auth/privy/wallets`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const retryData = await retryResponse.json();
          const retryWallets = retryData?.data?.wallets || retryData?.wallets || [];
          
          const recoveredWallet = retryWallets.find((w: any) => 
            w.blockchain === 'MOVEMENT' || w.blockchain === 'APTOS'
          );
          
          if (recoveredWallet) {
            console.log('✅ Auto-Recovery SUCCESS:', recoveredWallet.id);
            setActiveWalletId(recoveredWallet.id);
            localStorage.setItem('cto_wallet_id', recoveredWallet.id);
          } else {
            console.warn('❌ Auto-Recovery failed to find Movement wallet.');
          }
          // Reset recovery state so it can try again later if needed, 
          // but dependencies should prevent loop.
          setIsAutoRecovering(false);
        }
      } catch (err) {
        console.error('❌ Direct wallet fetch failed', err);
        setIsAutoRecovering(false);
      }
    };

    findAndSetWallet();
  }, [dbUser, activeWalletId, isAutoRecovering]);

  const loadData = useCallback(async (showLoading = true) => {
    if (!activeWalletId) return;
    
    try {
      if (showLoading) setLoading(true);
      const [balanceData, txData] = await Promise.all([
        movementWalletService.getBalance(activeWalletId),
        movementWalletService.getTransactions(activeWalletId, 5)
      ]);
      setBalances(balanceData);
      setTransactions(txData);
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [activeWalletId]);

  const handleSync = async (silent = false) => {
    if (!activeWalletId) return;
    
    setSyncing(true);
    try {
      if (!silent) {
        toast.loading('Syncing with Movement blockchain...', { id: 'wallet-sync' });
      }
      
      // 1. Poll for new transactions (Detect funding/payments)
      await movementWalletService.pollTransactions(activeWalletId);
      
      // 2. Refresh local data
      await loadData(false);
      
      if (!silent) {
        toast.success('Wallet synced successfully', { id: 'wallet-sync' });
      }
    } catch (error: any) {
      console.error('Sync failed:', error);
      if (!silent) {
        toast.error('Sync failed: ' + (error.message || 'Unknown error'), { id: 'wallet-sync' });
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleSend = async () => {
    if (!recipient || !amount) {
      toast.error('Please enter recipient and amount');
      return;
    }

    const moveWallet = getMovementWallet(privyUser);
    if (!moveWallet) {
      toast.error('No Movement wallet found');
      return;
    }

    setSending(true);
    const toastId = toast.loading(`Sending ${selectedToken}...`);

    try {
      let txData;
      
      if (selectedToken === 'MOVE') {
        // Basic MOVE transfer (8 decimals)
        const moveAmount = Math.floor(parseFloat(amount) * 100000000).toString();
        txData = {
          type: 'entry_function_payload',
          function: '0x1::aptos_account::transfer_coins',
          type_arguments: ['0x1::aptos_coin::AptosCoin'],
          arguments: [recipient, moveAmount],
        };
      } else {
        // USDC (Fungible Asset) transfer (6 decimals)
        const usdcAmount = Math.floor(parseFloat(amount) * 1000000).toString();
        txData = {
          type: 'entry_function_payload',
          function: '0x1::primary_fungible_store::transfer',
          type_arguments: ['0x1::fungible_asset::Metadata'], // RESTORED: Required by Movement Bardock
          arguments: [USDC_METADATA, recipient, usdcAmount],
        };
      }

      const hash = await sendMovementTransaction(
        txData,
        moveWallet.address,
        moveWallet.publicKey,
        signRawHash as any
      );

      toast.success(`${selectedToken} transfer successful!`, { id: toastId });
      setShowSendForm(false);
      setRecipient('');
      setAmount('');
      
      // Refresh after a short delay
      setTimeout(() => handleSync(true), 2000);
    } catch (error: any) {
      console.error('Send failed:', error);
      toast.error('Send failed: ' + (error.message || 'Unknown error'), { id: toastId });
    } finally {
      setSending(false);
    }
  };

  // INITIAL SYNC ON MOUNT
  useEffect(() => {
    if (activeWalletId) {
      loadData();
      // Auto-sync once on mount to get latest from blockchain
      handleSync(true);
    }
  }, [activeWalletId]);

  // PERIODIC BACKGROUND POLLING (Every 30 seconds)
  useEffect(() => {
    if (!activeWalletId) return;

    const intervalId = setInterval(() => {
      console.log('🔄 Performing periodic background wallet sync...');
      handleSync(true);
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [activeWalletId]);

  if (!activeWalletId) return null;

  // Prioritize USDC.e balance for display
  const usdcBalance = balances.find(b => b.tokenSymbol === 'USDC.e');
  const moveBalance = balances.find(b => b.tokenSymbol === 'MOVE');
  
  const usdcValue = usdcBalance 
    ? (parseFloat(usdcBalance.balance) / Math.pow(10, usdcBalance.decimals)).toFixed(2)
    : '0.00';
  
  const moveValue = moveBalance 
    ? (parseFloat(moveBalance.balance) / Math.pow(10, moveBalance.decimals)).toFixed(2)
    : '0.00';

  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-6">
      <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-700 text-white">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">Native Token</p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-2xl font-bold">{moveValue}</h2>
                <span className="text-sm font-medium opacity-90">MOVE</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] opacity-80 uppercase tracking-wider font-semibold">Stablecoin</p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-2xl font-bold">{usdcValue}</h2>
                <span className="text-sm font-medium opacity-90">USDC</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => handleSync(false)}
            disabled={syncing}
            className={`p-2 bg-white/20 hover:bg-white/30 rounded-full transition-all ${syncing ? 'animate-spin' : ''}`}
            title="Sync with Blockchain"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-[10px] opacity-70 font-mono break-all">
          Wallet: {getMovementWallet(privyUser)?.address || activeWalletId}
        </p>
        
        <div className="mt-4 flex gap-2">
          <button 
            onClick={() => setShowSendForm(!showSendForm)}
            className="flex-1 py-2 px-4 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send Assets
          </button>
        </div>

        {showSendForm && (
          <div className="mt-4 p-3 bg-black/10 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <label className="text-[10px] uppercase font-bold opacity-70">Token</label>
              <div className="flex gap-2 mt-1">
                <button 
                  onClick={() => setSelectedToken('MOVE')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded border ${
                    selectedToken === 'MOVE' 
                      ? 'bg-white text-blue-600 border-white' 
                      : 'bg-transparent text-white border-white/20 hover:bg-white/5'
                  }`}
                >
                  MOVE
                </button>
                <button 
                  onClick={() => setSelectedToken('USDC')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded border ${
                    selectedToken === 'USDC' 
                      ? 'bg-white text-blue-600 border-white' 
                      : 'bg-transparent text-white border-white/20 hover:bg-white/5'
                  }`}
                >
                  USDC
                </button>
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold opacity-70">Recipient Address</label>
              <input 
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full mt-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded text-sm placeholder:opacity-50 focus:outline-none focus:ring-1 focus:ring-white/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold opacity-70">Amount ({selectedToken})</label>
              <input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.5"
                className="w-full mt-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded text-sm placeholder:opacity-50 focus:outline-none focus:ring-1 focus:ring-white/50"
              />
            </div>
            <button 
              onClick={handleSend}
              disabled={sending}
              className="w-full py-2 bg-white text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {sending ? 'Sending...' : `Confirm Transfer`}
            </button>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Recent Activity</h3>
        {loading && !syncing ? (
          <div className="flex justify-center py-4">
            <div className="animate-pulse flex space-x-2">
              <div className="h-2 w-2 bg-gray-300 rounded-full"></div>
              <div className="h-2 w-2 bg-gray-300 rounded-full"></div>
              <div className="h-2 w-2 bg-gray-300 rounded-full"></div>
            </div>
          </div>
        ) : transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-full ${
                    tx.txType === 'CREDIT' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {tx.txType === 'CREDIT' ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">
                      {tx.txType === 'CREDIT' ? 'Deposit' : 'Payment'}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(tx.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${tx.txType === 'CREDIT' ? 'text-green-600' : 'text-gray-800'}`}>
                    {tx.txType === 'CREDIT' ? '+' : '-'}
                    {(() => {
                      const isUSDC = tx.tokenSymbol?.toLowerCase().includes('usdc');
                      const divisor = isUSDC ? 1000000 : 100000000;
                      const decimals = isUSDC ? 2 : 2;
                      const amount = parseFloat(tx.amount) / divisor;
                      const symbol = isUSDC ? 'USDC' : 'MOVE';
                      return `${amount.toFixed(decimals)} ${symbol}`;
                    })()}
                  </p>
                  <a 
                    href={`https://explorer.movementnetwork.xyz/txn/${tx.txHash}?network=bardock+testnet`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[9px] text-blue-500 hover:underline font-mono"
                  >
                    {tx.txHash.substring(0, 6)}...{tx.txHash.substring(tx.txHash.length - 4)}
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-4 italic">No transactions detected yet.</p>
        )}
      </div>
    </div>
  );
};

