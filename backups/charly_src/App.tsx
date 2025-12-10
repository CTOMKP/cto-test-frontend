import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { SignUpForm } from './components/Auth/SignUpForm';
import { LoginForm } from './components/Auth/LoginForm';
import ForgotPasswordForm from './components/Auth/ForgotPasswordForm';
import { ProfilePage } from './components/Profile/ProfilePage';
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
      <Route path={ROUTES.home} element={<Navigate to={ROUTES.login} replace />} />
      <Route path={ROUTES.login} element={<PublicRoute><LoginForm /></PublicRoute>} />
      <Route path={ROUTES.signup} element={<SignupRoute><SignUpForm /></SignupRoute>} />
      <Route path={ROUTES.forgotPassword} element={<PublicRoute><ForgotPasswordForm /></PublicRoute>} />
      <Route path={ROUTES.profile} element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={ROUTES.login} replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  
  // Debug: Log the client ID to console
  console.log('Google Client ID:', googleClientId);
  
  // If no Google client ID, render without Google OAuth
  if (!googleClientId) {
    console.warn('No Google Client ID found, rendering without Google OAuth');
    return (
      <ErrorBoundary>
        <Router>
          <AppContent />
        </Router>
      </ErrorBoundary>
    );
  }
  
  return (
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={googleClientId}>
        <Router>
          <AppContent />
        </Router>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  );
};

export default App;
