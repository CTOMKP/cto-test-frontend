import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthState, LoginCredentials, SignUpCredentials, User } from '../types/auth.types';
import { authService } from '../services/authService';
import { ROUTES } from '../utils/constants';
import toast from 'react-hot-toast';

// Session configuration
const TOKEN_REFRESH_INTERVAL = 12 * 60 * 1000; // Refresh token every 12 minutes (before 15min expiry)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // Logout after 30 minutes of inactivity

export const useAuth = () => {
  console.log('useAuth hook initializing...');
  
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  const navigate = useNavigate();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Auto-refresh JWT token before expiration
  const startTokenRefresh = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    refreshIntervalRef.current = setInterval(async () => {
      const token = localStorage.getItem('cto_auth_token');
      if (token && authState.isAuthenticated) {
        try {
          console.log('🔄 Auto-refreshing JWT token...');
          const response = await authService.refreshToken();
          localStorage.setItem('cto_auth_token', response.access_token);
          console.log('✅ JWT token refreshed successfully');
        } catch (error) {
          console.error('❌ Token refresh failed:', error);
          // If refresh fails, logout user
          toast.error('Session expired. Please login again.');
          logout();
        }
      }
    }, TOKEN_REFRESH_INTERVAL);
  }, [authState.isAuthenticated]);

  // Track user activity and logout on inactivity
  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();

    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }

    if (authState.isAuthenticated) {
      inactivityTimeoutRef.current = setTimeout(() => {
        const inactiveTime = Date.now() - lastActivityRef.current;
        if (inactiveTime >= INACTIVITY_TIMEOUT) {
          console.log('⏱️ User inactive for 30 minutes, logging out...');
          toast.error('Session expired due to inactivity');
          logout();
        }
      }, INACTIVITY_TIMEOUT);
    }
  }, [authState.isAuthenticated]);

  // Setup activity listeners
  useEffect(() => {
    if (authState.isAuthenticated) {
      const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
      
      const handleActivity = () => {
        resetInactivityTimer();
      };

      activityEvents.forEach(event => {
        document.addEventListener(event, handleActivity);
      });

      // Start token refresh interval
      startTokenRefresh();
      
      // Start inactivity timer
      resetInactivityTimer();

      return () => {
        activityEvents.forEach(event => {
          document.removeEventListener(event, handleActivity);
        });
        
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
        
        if (inactivityTimeoutRef.current) {
          clearTimeout(inactivityTimeoutRef.current);
        }
      };
    }
  }, [authState.isAuthenticated, startTokenRefresh, resetInactivityTimer]);

  // Check authentication status on mount (only once)
  useEffect(() => {
    console.log('useAuth useEffect triggered, checking auth status...');
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - only run once on mount

  const checkAuthStatus = useCallback(async () => {
    console.log('🔄 checkAuthStatus called');
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      // First check localStorage for existing auth data
      const storedEmail = localStorage.getItem('cto_user_email');
      const storedToken = localStorage.getItem('cto_auth_token');
      const storedWalletId = localStorage.getItem('cto_wallet_id');
      
      console.log('🔄 Checking localStorage for auth data:');
      console.log('🔄 storedEmail:', storedEmail);
      console.log('🔄 storedToken:', storedToken);
      console.log('🔄 storedWalletId:', storedWalletId);
      
      // Authenticate immediately only if we also have a token
      if (storedEmail && storedWalletId && storedToken) {
        console.log('✅ Found user with wallet and token, immediately authenticated');
        const user: User = {
          id: storedEmail,
          email: storedEmail,
          walletId: storedWalletId,
          createdAt: localStorage.getItem('cto_user_created') || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        console.log('✅ Authentication state set immediately from wallet + token');
        return;
      }
      
      if (storedEmail && storedToken) {
        // User has stored auth data, consider them authenticated
        console.log('✅ Found stored auth data, user is authenticated');
        const user: User = {
          id: storedEmail,
          email: storedEmail,
          walletId: storedWalletId || '',
          createdAt: localStorage.getItem('cto_user_created') || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        console.log('✅ Authentication state set from localStorage');
        return;
      }
      
      // If no localStorage data, try to get current user from API
      let user: User | null = null;
      try {
        console.log('Attempting to get current user from API...');
        user = await authService.getCurrentUser();
        console.log('API call result:', user);
      } catch (error) {
        console.log('API call failed:', error);
        // No fallback - only use real API
        user = null;
      }

      if (user) {
        console.log('User found, setting authenticated state');
        console.log('🔄 User details:', user);
        console.log('🔄 User ID:', user.id);
        console.log('🔄 User email:', user.email);
        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        console.log('✅ Authenticated state set successfully');
      } else {
        console.log('No user found, setting unauthenticated state');
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
        console.log('✅ Unauthenticated state set successfully');
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Authentication check failed',
      });
    }
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    console.log('Login called with credentials:', credentials);
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      let response;
      try {
        console.log('Attempting API login...');
        response = await authService.login(credentials);
        console.log('API login successful:', response);
      } catch (error) {
        console.log('API login failed:', error);
        // No fallback - only use real API
        throw error;
      }

      // Store user data in localStorage
      localStorage.setItem('cto_user_email', response.user.email);
      localStorage.setItem('cto_user_created', response.user.createdAt);
      if (response.user.walletId) {
        localStorage.setItem('cto_wallet_id', response.user.walletId);
      }
      if (response.user.avatarUrl) {
        localStorage.setItem('cto_user_avatar_url', response.user.avatarUrl);
        localStorage.setItem('profile_avatar_url', response.user.avatarUrl);
      }
      localStorage.setItem('cto_auth_token', response.token);

      console.log('✅ User data stored in localStorage after login');
      
      setAuthState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      toast.success('Login successful!');
      
      // Navigate to profile after successful login
      navigate(ROUTES.profile);
      
      return response;
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setAuthState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      toast.error(errorMessage);
      throw error;
    }
  }, [navigate]);

  const signup = useCallback(async (credentials: SignUpCredentials) => {
    console.log('Signup called with credentials:', credentials);
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      let response;
      try {
        console.log('Attempting API signup...');
        response = await authService.signup(credentials);
        console.log('API signup successful:', response);
      } catch (error) {
        console.log('API signup failed:', error);
        // Don't fall back to mock - let the error propagate
        throw error;
      }

      console.log('🔄 Setting authentication state after signup...');
      console.log('🔄 Response user:', response.user);
      console.log('🔄 Response user ID:', response.user?.id);
      
      setAuthState({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      console.log('✅ Authentication state set after signup');
      
      // Store user data in localStorage
      localStorage.setItem('cto_user_email', response.user.email);
      localStorage.setItem('cto_user_created', response.user.createdAt);
      if (response.user.walletId) {
        localStorage.setItem('cto_wallet_id', response.user.walletId);
      }
      localStorage.setItem('cto_auth_token', response.token);
      
      console.log('✅ User data stored in localStorage after signup');
      
      toast.success('Account created successfully!');
      // Remove automatic navigation - let the component handle it after wallet creation
      // navigate(ROUTES.profile);
      
      return response;
    } catch (error) {
      console.error('Signup error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Signup failed';
      setAuthState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      toast.error(errorMessage);
      throw error;
    }
  }, [navigate]);

  const logout = useCallback(async () => {
    console.log('Logout called...');
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      // Clear all localStorage data first
      localStorage.removeItem('cto_user_email');
      localStorage.removeItem('cto_user_created');
      localStorage.removeItem('cto_wallet_id');
      localStorage.removeItem('cto_auth_token');
      
      console.log('✅ All localStorage data cleared');
      
      // Clear auth state
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });

      console.log('✅ Auth state cleared');
      
      // Try to call logout API (but don't wait for it)
      try {
        await authService.logout();
      } catch (apiError) {
        console.log('Logout API failed, but continuing with local cleanup:', apiError);
      }
      
      toast.success('Logged out successfully');
      
      // Force redirect to login page
      window.location.href = ROUTES.login;
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear everything and redirect
      localStorage.removeItem('cto_user_email');
      localStorage.removeItem('cto_user_created');
      localStorage.removeItem('cto_wallet_id');
      localStorage.removeItem('cto_auth_token');
      
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      
      // Force redirect to login page
      window.location.href = ROUTES.login;
    }
  }, []);

  const updateUser = useCallback(async (userId: string, updates: Partial<User>) => {
    console.log('Update user called:', { userId, updates });
    try {
      const updatedUser = await authService.updateUser(userId, updates);
      
      setAuthState(prev => ({
        ...prev,
        user: updatedUser,
      }));

      toast.success('Profile updated successfully');
      return updatedUser;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
      toast.error(errorMessage);
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    console.log('Clearing error...');
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  const refreshAuth = useCallback(() => {
    console.log('Manual auth refresh requested...');
    checkAuthStatus();
  }, [checkAuthStatus]);

  console.log('useAuth hook current state:', authState);

  return {
    ...authState,
    login,
    signup,
    logout,
    updateUser,
    clearError,
    refreshAuth,
    checkAuthStatus,
  };
};
