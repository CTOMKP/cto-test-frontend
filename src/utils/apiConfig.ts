// API Configuration utility
export const getBackendUrl = (): string => {
  return process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';
};

export const getBackendEnvironment = (): string => {
  return process.env.REACT_APP_BACKEND_ENV || 'development';
};

export const isProductionBackend = (): boolean => {
  return getBackendEnvironment() === 'production';
};

export const getBackendLabel = (): string => {
  const env = getBackendEnvironment();
  if (env === 'production') {
    return 'Railway (Production)';
  } else {
    return 'Local (Development)';
  }
};