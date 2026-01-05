import React from 'react';

interface AccountRecoveryHelperProps {
  children: React.ReactNode;
  show: boolean;
}

/**
 * Helper component to guide users through fixing "Account Not Found" errors
 * when Movement Network Indexer and Fullnode are out of sync
 */
export const AccountRecoveryHelper: React.FC<AccountRecoveryHelperProps> = ({ 
  children, 
  show 
}) => {
  if (!show) return null;
  
  return (
    <div className="bg-blue-50 border border border-blue-200 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold text-blue-900 mb-2">💡 Account Recovery Helper</h3>
      <div className="text-sm text-gray-700 space-y-2">
        <p>
          <strong>Can't send transactions?</strong> This usually happens when your wallet exists in the Indexer 
          (transaction history) but not on the current Fullnode state.
        </p>
        <div className="bg-yellow-50 border border border-yellow-200 rounded p-3 mt-3">
          <h4 className="font-semibold text-yellow-900">Quick Fix:</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li>Send a small amount of MOVE to your wallet address first</li>
            <li>This "activates" your account on the current testnet state</li>
            <li>Try your transaction again - it should work now!</li>
          </ol>
        </div>
        <div className="bg-gray-50 border border border-gray-200 rounded p-3 mt-3">
          <h4 className="font-semibold text-gray-900">Technical Explanation:</h4>
          <p className="text-sm">
            Movement Network uses two systems: <strong>Indexer</strong> (records history) and 
            <strong>Fullnode</strong> (handles live transactions). When they get out of sync, 
            the Fullnode might not know your account exists yet, even though the Indexer has your transactions.
          </p>
          <p className="text-sm mt-2">
            Your wallet exists in the Indexer (that's why you see transaction history), but the Fullnode returns 
            "Account not found" until you make your first deposit.
          </p>
        </div>
      </div>
      {children}
    </div>
  );
};



