import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { PrivyProvider } from '@privy-io/react-auth';
import { PrivyLoginPage } from './components/Auth/PrivyLoginPage';
import { PrivyProfilePage } from './components/Profile/PrivyProfilePage';
import { ListingsPage } from './components/Listing/ListingsPage';
import CreateUserListingNew from './components/UserListings/CreateUserListingNew';
import { MyUserListings } from './components/UserListings/MyUserListings';
import { UserListingDetail } from './components/UserListings/UserListingDetail';
import { ListingDetail } from './components/Listing/ListingDetail';
import UserWormholeBridge from './components/UserWormholeBridge';
import TokenSwap from './components/TokenSwap';
import BackendIndicator from './components/common/BackendIndicator';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { PFPGenerator } from './components/PFP/PFPGenerator';
import { AnimatedPFPIcon } from './components/PFP/AnimatedPFPIcon';
import MarketDashboard from './components/Marketplace/MarketDashboard';
import { TwoPhaseTesting } from './components/TwoPhaseTesting';
import { useAuth } from './hooks/useAuth';
import { ROUTES } from './utils/constants';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <p className="text-gray-600 mb-4">
              The application encountered an error. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
            {this.state.error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-gray-500">Error Details</summary>
                <pre className="mt-2 text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) { return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div></div>; }
  return isAuthenticated ? <>{children}</> : <Navigate to={ROUTES.login} replace />;
};

// Public Route Component (redirects if already authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) { return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div></div>; }
  return isAuthenticated ? <Navigate to={ROUTES.profile} replace /> : <>{children}</>;
};

// Signup Route Component (accessible even after authentication for wallet creation)
const SignupRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) { 
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div></div>;
  }
  
  // OPTIMIZATION: Immediately check for wallet in localStorage to prevent signup page flash
  const hasWallet = localStorage.getItem('cto_wallet_id');
  const hasEmail = localStorage.getItem('cto_user_email');
  
  // If user has both email and wallet, redirect immediately to profile
  if (hasEmail && hasWallet) {
    console.log('🔄 User has wallet and email, immediately redirecting to profile from signup route');
    return <Navigate to={ROUTES.profile} replace />;
  }
  
  // Only redirect if user has an actual wallet (not just auth data)
  if (isAuthenticated) {
    if (hasWallet) {
      console.log('🔄 User has wallet, redirecting to profile from signup route');
      return <Navigate to={ROUTES.profile} replace />;
    }
  }
  
  // Allow access to signup for everyone else
  return <>{children}</>;
};

// App Content Component (moved inside Router context)
const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading, checkAuthStatus } = useAuth();

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path={ROUTES.home} element={<ListingsPage />} />
      <Route path={ROUTES.login} element={<PrivyLoginPage />} />
      <Route path={ROUTES.signup} element={<PrivyLoginPage />} />
      <Route path={ROUTES.profile} element={<ProtectedRoute><PrivyProfilePage /></ProtectedRoute>} />
      <Route path={ROUTES.createUserListing} element={<ProtectedRoute><CreateUserListingNew /></ProtectedRoute>} />
      <Route path={ROUTES.myUserListings} element={<ProtectedRoute><MyUserListings /></ProtectedRoute>} />
      <Route path="/bridge" element={<ProtectedRoute><UserWormholeBridge /></ProtectedRoute>} />
      <Route path="/swap" element={<ProtectedRoute><TokenSwap /></ProtectedRoute>} />
      <Route path="/pfp" element={<ProtectedRoute><PFPGenerator /></ProtectedRoute>} />
      <Route path="/market" element={<MarketDashboard />} />
      <Route path="/two-phase-test" element={<TwoPhaseTesting />} />
      <Route path={ROUTES.admin} element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      {/* User listing public detail route */}
      <Route path="/user-listings/:id" element={<UserListingDetail />} />
      {/* Public listing detail route */}
      <Route path="/listing/:contractAddress" element={<ListingDetail />} />
      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  const privyAppId = process.env.REACT_APP_PRIVY_APP_ID;
  
  // Debug: Log Privy App ID
  console.log('Privy App ID:', privyAppId);
  
  if (!privyAppId) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h1>
          <p className="text-gray-600 mb-4">
            Privy App ID is not configured. Please check your environment variables.
          </p>
        </div>
      </div>
    );
  }
  
  // Add global error handler for Privy
  React.useEffect(() => {
    const handlePrivyError = (event: ErrorEvent) => {
      if (event.error?.message?.includes('walletProxy')) {
        console.warn('Privy walletProxy error - this is usually temporary:', event.error);
        event.preventDefault(); // Prevent the error from showing in console
      }
      
      // Handle OAuth timeout errors
      if (event.error?.message?.includes('TimeoutError') || 
          event.error?.message?.includes('oauth') ||
          event.error?.message?.includes('auth.privy.io')) {
        console.warn('Privy OAuth error - this might be temporary:', event.error);
        // Don't prevent the error, let the component handle it
      }
    };

    window.addEventListener('error', handlePrivyError);
    return () => window.removeEventListener('error', handlePrivyError);
  }, []);

  return (
    <ErrorBoundary>
      <PrivyProvider
        appId={privyAppId}
        config={{
          loginMethods: ['email', 'wallet', 'google', 'twitter', 'discord'],
          appearance: {
            theme: 'dark',
            accentColor: '#8B5CF6',
            logo: '/logo.png',
            showWalletLoginFirst: true,
          },
          embeddedWallets: {
            ethereum: {
              createOnLogin: 'users-without-wallets',
            },
          },
        }}
      >
        <Router>
          <AppContent />
          <BackendIndicator />
          <AnimatedPFPIcon />
          <Toaster position="top-right" />
        </Router>
      </PrivyProvider>
    </ErrorBoundary>
  );
};

export default App;
