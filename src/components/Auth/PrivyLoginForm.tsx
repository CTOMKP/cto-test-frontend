import React from 'react';
import { usePrivyAuth } from '../../services/privyAuthService';

const PrivyLoginForm: React.FC = () => {
  const { login, logout, authenticated, ready, user } = usePrivyAuth();

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Privy...</p>
        </div>
      </div>
    );
  }

  if (authenticated && user) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center mb-6">Welcome!</h2>
        <div className="space-y-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-green-800">
              <strong>Logged in as:</strong> {user.email?.address || user.phone?.number || 'User'}
            </p>
          </div>
          <button
            onClick={logout}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center mb-6">CTO Marketplace</h2>
      <p className="text-gray-600 text-center mb-6">
        Connect your wallet to access the marketplace
      </p>
      <button
        onClick={login}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
      >
        Connect Wallet
      </button>
    </div>
  );
};

export default PrivyLoginForm;


