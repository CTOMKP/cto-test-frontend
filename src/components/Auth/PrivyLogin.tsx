import React, { useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { privyService } from '../../services/privyService';
import { ROUTES } from '../../utils/constants';

export const PrivyLogin: React.FC = () => {
  const { login, authenticated, getAccessToken, user } = usePrivy();
  const navigate = useNavigate();

  useEffect(() => {
    // If user is authenticated with Privy, sync with backend
    if (authenticated && user) {
      handlePrivySync();
    }
  }, [authenticated, user]);

  const handlePrivySync = async () => {
    try {
      toast.loading('Syncing with CTO backend...');
      
      // Get Privy access token
      const privyToken = await getAccessToken();
      
      if (!privyToken) {
        toast.error('Failed to get Privy token');
        return;
      }

      // Sync with CTO backend
      const result = await privyService.syncUser(privyToken);

      toast.dismiss();
      toast.success('Successfully authenticated!');
      
      // Redirect to profile
      navigate(ROUTES.profile);
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || 'Failed to sync with backend');
      console.error('Privy sync error:', error);
    }
  };

  const handleLogin = async () => {
    try {
      await login();
      // handlePrivySync will be called automatically via useEffect
    } catch (error) {
      console.error('Privy login error:', error);
      toast.error('Failed to login with Privy');
    }
  };

  if (authenticated) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Connecting to CTO backend...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={handleLogin}
        className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors font-semibold flex items-center justify-center space-x-2"
      >
        <span>🔐</span>
        <span>Continue with Privy</span>
      </button>

      <div className="text-center text-sm text-gray-500">
        Secure authentication powered by Privy
      </div>
    </div>
  );
};


