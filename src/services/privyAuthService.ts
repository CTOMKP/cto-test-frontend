import { usePrivy } from '@privy-io/react-auth';

export const usePrivyAuth = () => {
  const {
    ready,
    authenticated,
    user,
    login,
    logout,
    getAccessToken,
  } = usePrivy();

  const getAuthToken = async () => {
    if (authenticated) {
      return await getAccessToken();
    }
    return null;
  };

  const isAuthenticated = () => {
    return ready && authenticated;
  };

  const getUser = () => {
    return user;
  };

  return {
    ready,
    authenticated,
    user,
    login,
    logout,
    getAuthToken,
    isAuthenticated,
    getUser,
  };
};


