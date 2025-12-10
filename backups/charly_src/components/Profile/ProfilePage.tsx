import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCircleWallet } from '../../hooks/useCircleWallet';
import { BalanceSection } from './BalanceSection';
import { WalletInfo } from './WalletInfo';
import { QRCodeDisplay } from '../Wallet/QRCodeDisplay';
import { TopUpSection } from './TopUpSection';
import { WithdrawSection } from './WithdrawSection';
import { ActivitiesSection } from './ActivitiesSection';
import { formatAddress } from '../../utils/helpers';
import { authService } from '../../services/authService';
import { circleWalletService } from '../../services/circleWallet';
import toast from 'react-hot-toast';

export const ProfilePage: React.FC = () => {
  const { user, logout, isLoading: authLoading, isAuthenticated } = useAuth();
  const { 
    wallet, 
    balances, 
    isLoading: walletLoading, 
    refreshBalances,
    error: walletError,
    clearError
  } = useCircleWallet(user?.id);

  const [showQRModal, setShowQRModal] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('🔄 ProfilePage mounted');
    console.log('🔄 User:', user);
    console.log('🔄 Is Authenticated:', isAuthenticated);
    console.log('🔄 Wallet:', wallet);
    console.log('🔄 Balances:', balances);
    console.log('🔄 Wallet Error:', walletError);
    console.log('🔄 Auth Loading:', authLoading);
    console.log('🔄 Wallet Loading:', walletLoading);
  }, [user, isAuthenticated, wallet, balances, walletError, authLoading, walletLoading]);



  // Check if user is actually authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log('🔄 User not authenticated, redirecting to login');
      // Force redirect to login if not authenticated
      window.location.href = '/login';
    }
  }, [authLoading, isAuthenticated]);

  const handleRefreshBalances = async () => {
    try {
      await refreshBalances();
      toast.success('Balances refreshed!');
    } catch (error) {
      console.error('Failed to refresh balances:', error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cto-purple mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cto-purple mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const hasCircleAppId = !!process.env.REACT_APP_CIRCLE_APP_ID;
  const hasCircleApiKey = !!process.env.REACT_APP_CIRCLE_API_KEY;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Service Mode Indicator */}
      <div className="bg-gradient-to-r from-cto-purple to-primary-600 text-white py-2 px-4 text-center text-sm">
        <div className="flex items-center justify-center space-x-4">
          <span>🆔 Circle App ID: {hasCircleAppId ? '✅' : '❌'}</span>
          <span>🔑 Circle API Key: {hasCircleApiKey ? '✅' : '❌'}</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
              <p className="text-gray-600">Welcome back, {user.email}</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="btn-secondary"
              >
                {showDebug ? 'Hide Debug' : 'Show Debug'}
              </button>
              <button
                onClick={() => setShowQRModal(true)}
                className="btn-secondary"
              >
                Show QR Code
              </button>
              <button
                onClick={handleRefreshBalances}
                disabled={walletLoading}
                className="btn-secondary"
              >
                {walletLoading ? 'Refreshing...' : 'Refresh Balances'}
              </button>
              <button
                onClick={logout}
                className="btn-primary"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Information */}
      {showDebug && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Debug Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium text-yellow-700">User Data:</h4>
                <pre className="bg-white p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(user, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="font-medium text-yellow-700">Wallet Data:</h4>
                <pre className="bg-white p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(wallet, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="font-medium text-yellow-700">Balances:</h4>
                <pre className="bg-white p-2 rounded text-xs overflow-auto">
                  {JSON.stringify(balances, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="font-medium text-yellow-700">Errors:</h4>
                <pre className="bg-white p-2 rounded text-xs overflow-auto">
                  {JSON.stringify({ walletError, authLoading, walletLoading }, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Wallet Info & QR Code */}
          <div className="lg:col-span-1 space-y-6">
            <WalletInfo wallet={wallet} onShowQR={() => setShowQRModal(true)} />
            
            {/* QR Code Button */}
            {wallet && (
              <div className="bg-white rounded-lg shadow p-6">
                <button
                  onClick={() => setShowQRModal(true)}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
                >
                  Show QR Code
                </button>
              </div>
            )}
          </div>

          {/* Right Column - Balances & Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Balance Section */}
            <BalanceSection 
              balances={balances} 
              isLoading={walletLoading}
              onRefresh={handleRefreshBalances}
              walletError={walletError}
              clearError={clearError}
            />

            {/* Top Up Section */}
            {wallet && <TopUpSection wallet={wallet} />}

            {/* Withdraw Section */}
            {wallet && <WithdrawSection wallet={wallet} balances={balances} />}

            {/* Activities Section */}
            {wallet && <ActivitiesSection wallet={wallet} />}
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && wallet && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Fund Your Wallet
                </h3>
                <button
                  onClick={() => setShowQRModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <QRCodeDisplay
                data={{ address: wallet.address }}
                title="Your Wallet Address"
                description="Scan this QR code or copy the address to send funds to your wallet"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
