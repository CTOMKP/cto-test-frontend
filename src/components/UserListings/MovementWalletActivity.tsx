import React, { useEffect, useState, useCallback } from 'react';
import { movementWalletService, WalletBalance, WalletTransaction } from '../../services/movementWalletService';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

export const MovementWalletActivity: React.FC = () => {
  const { user } = useAuth();
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const walletId = user?.walletId;

  const loadData = useCallback(async (showLoading = true) => {
    if (!walletId) return;
    
    try {
      if (showLoading) setLoading(true);
      const [balanceData, txData] = await Promise.all([
        movementWalletService.getBalance(walletId),
        movementWalletService.getTransactions(walletId, 5)
      ]);
      setBalances(balanceData);
      setTransactions(txData);
    } catch (error) {
      console.error('Failed to load wallet data:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [walletId]);

  const handleSync = async () => {
    if (!walletId) return;
    
    setSyncing(true);
    try {
      toast.loading('Syncing with Movement blockchain...', { id: 'wallet-sync' });
      
      // 1. Poll for new transactions (Detect funding/payments)
      await movementWalletService.pollTransactions(walletId);
      
      // 2. Refresh local data
      await loadData(false);
      
      toast.success('Wallet synced successfully', { id: 'wallet-sync' });
    } catch (error: any) {
      console.error('Sync failed:', error);
      toast.error('Sync failed: ' + (error.message || 'Unknown error'), { id: 'wallet-sync' });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!walletId) return null;

  const moveBalance = balances.find(b => b.tokenSymbol === 'MOVE');
  const displayBalance = moveBalance 
    ? (parseFloat(moveBalance.balance) / Math.pow(10, moveBalance.decimals)).toFixed(2)
    : '0.00';

  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-6">
      <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-700 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-80 uppercase tracking-wider font-semibold">Movement Balance</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold">{displayBalance}</h2>
              <span className="text-sm font-medium opacity-90">MOVE</span>
            </div>
          </div>
          <button 
            onClick={handleSync}
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
          Wallet: {moveBalance?.walletId || walletId}
        </p>
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
                    {tx.txType === 'CREDIT' ? '+' : '-'}{(parseFloat(tx.amount) / 1e8).toFixed(1)} MOVE
                  </p>
                  <a 
                    href={`https://explorer.movementnetwork.xyz/txn/${tx.txHash}?network=testnet`} 
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

