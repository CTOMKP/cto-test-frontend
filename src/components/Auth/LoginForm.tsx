import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';
import toast from 'react-hot-toast';
import axios from 'axios'; // Added axios import

interface LoginFormData {
  email: string;
  password: string;
}

// Check if Google OAuth is available
const isGoogleOAuthAvailable = () => {
  // Try multiple ways to get the client ID
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || 
                   (window as any).__GOOGLE_CLIENT_ID__ ||
                   '360848317756-hbdh4aogfukc37nuec91a0m802j60fcm.apps.googleusercontent.com';
  
  console.log('🔍 Google OAuth Check:', {
    clientId,
    exists: !!clientId,
    type: typeof clientId,
    processEnv: process.env.REACT_APP_GOOGLE_CLIENT_ID,
    windowGlobal: (window as any).__GOOGLE_CLIENT_ID__
  });
  
  return !!clientId;
};

export const LoginForm: React.FC = () => {
  const [isGoogleOAuthInProgress, setIsGoogleOAuthInProgress] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<LoginFormData>();

  // Clear error message when user starts typing
  const emailValue = watch('email');
  const passwordValue = watch('password');
  
  // Track previous values to detect actual typing
  const [prevEmailValue, setPrevEmailValue] = useState('');
  const [prevPasswordValue, setPrevPasswordValue] = useState('');
  
  useEffect(() => {
    // Only clear error if user actually types NEW content
    if (loginError && ((emailValue !== prevEmailValue) || (passwordValue !== prevPasswordValue))) {
      console.log('🧹 Clearing error because user typed new content:', { 
        emailValue, 
        prevEmailValue, 
        passwordValue, 
        prevPasswordValue 
      });
      setLoginError(null);
    }
    
    // Update previous values
    setPrevEmailValue(emailValue);
    setPrevPasswordValue(passwordValue);
  }, [emailValue, passwordValue, loginError, prevEmailValue, prevPasswordValue]);

  // Debug: Log loginError state changes
  useEffect(() => {
    console.log('🔍 loginError state changed to:', loginError);
  }, [loginError]);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setLoginError(null); // Clear any previous errors
    
    console.log('🔍 Login attempt started for:', data.email);
    
    try {
      await login(data);
      console.log('✅ Login successful');
      // Navigation will be handled by the auth state change
      // No need for manual navigation or delays
    } catch (error) {
      console.error('❌ Login failed:', error);
      
      // Extract error message and set it for display
      let errorMessage = 'Login failed. Please try again.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        console.log('🔍 Error is Error instance:', errorMessage);
      } else if (typeof error === 'string') {
        errorMessage = error;
        console.log('🔍 Error is string:', errorMessage);
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
        console.log('🔍 Error has message property:', errorMessage);
      }
      
      // Set specific messages for common error cases
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        console.log('🔍 Setting 401 error message:', errorMessage);
      } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        errorMessage = 'User not found. Please check your email address.';
        console.log('🔍 Setting 404 error message:', errorMessage);
      } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
        errorMessage = 'Server error. Please try again later.';
        console.log('🔍 Setting 500 error message:', errorMessage);
      }
      
      console.log('🔍 Final error message to display:', errorMessage);
      setLoginError(errorMessage);
      console.log('🔍 loginError state set to:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = () => {
    toast('Apple Sign-In coming soon!');
  };

  // Temporarily disable Google OAuth - transitioning to Privy
  const handleGoogleSignIn = false 
    ? useGoogleLogin({
        onSuccess: async (response) => {
          try {
            console.log('🚀 Google OAuth success, response:', response);
            
            // Set OAuth in progress (shows overlay, keeps body visible)
            setIsGoogleOAuthInProgress(true);
            
            // Get user info from Google immediately
            const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: {
                Authorization: `Bearer ${response.access_token}`,
              },
            }).then(res => res.json());
            
            console.log('Google user info:', userInfo);
            
            if (userInfo.email) {
              console.log('🚀 Google OAuth flow started for:', userInfo.email);
              
              // Check if user exists by trying to get their wallets
              const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';
              // Exchange Google account for backend-issued JWT
              try {
                const googleLoginRes = await axios.post(`${backendUrl}/api/auth/google-login`, {
                  email: userInfo.email,
                  providerId: userInfo.id || userInfo.sub,
                });
                const jwtToken = googleLoginRes.data?.access_token || googleLoginRes.data?.token || '';
                if (jwtToken) {
                  localStorage.setItem('cto_auth_token', jwtToken);
                }
                const authHeaders = jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {};
              } catch (e) {
                console.error('Failed to exchange Google login for backend JWT', e);
              }
              
              try {
                // Fallback timer: if nothing happens within 6s, go to SignUp with context
                const emailParam = encodeURIComponent(userInfo.email);
                const fallbackTimer = setTimeout(() => {
                  console.log('⏱️ Fallback redirect to signup after timeout');
                  window.location.replace(`/signup?google=1&email=${emailParam}`);
                }, 6000);

                console.log('🔄 Checking if user exists by getting wallets:', userInfo.email);
                const token = localStorage.getItem('cto_auth_token');
                const walletsResponse = await axios.get(`${backendUrl}/api/circle/users/${userInfo.email}/wallets`, { timeout: 6000, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
                
                if (walletsResponse.data.wallets && walletsResponse.data.wallets.length > 0) {
                  // User exists and has wallets - IMMEDIATE redirect to profile
                  console.log('✅ User exists with wallets, IMMEDIATE redirect to profile');
                  
                  // Store user info in localStorage
                  localStorage.setItem('cto_user_email', userInfo.email);
                  localStorage.setItem('cto_user_created', new Date().toISOString());
                  
                  if (walletsResponse.data.wallets[0]?.id) {
                    localStorage.setItem('cto_wallet_id', walletsResponse.data.wallets[0].id);
                  }
                  
                  // IMMEDIATE redirect - no React routing, no useAuth interference
                  console.log('🚀 IMMEDIATE redirect to profile using window.location');
                  clearTimeout(fallbackTimer);
                  window.location.replace('/profile');
                  return;
                } else {
                  // User exists but no wallet - redirect to signup
                  console.log('⚠️ User exists but no wallet, redirecting to signup');
                  
                  // Store user info for wallet creation
                  localStorage.setItem('cto_user_email', userInfo.email);
                  localStorage.setItem('cto_user_created', new Date().toISOString());
                  
                  // IMMEDIATE redirect to signup with Google OAuth context via query params
                  console.log('🚀 IMMEDIATE redirect to signup using window.location with query params');
                  clearTimeout(fallbackTimer);
                  window.location.replace(`/signup?google=1&email=${emailParam}`);
                  return;
                }
              } catch (walletsError) {
                // User doesn't exist - create account and redirect to signup
                console.log('🔄 User does not exist, creating new account...');
                
                try {
                  const token = localStorage.getItem('cto_auth_token');
                  const signupResponse = await axios.post(`${backendUrl}/api/circle/users`, {
                    userId: userInfo.email,
                    email: userInfo.email,
                    password: 'google_oauth_user'
                  }, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
                  
                  if (signupResponse.data.success) {
                    console.log('✅ New user account created successfully');
                    
                    // Store user info
                    localStorage.setItem('cto_user_email', userInfo.email);
                    localStorage.setItem('cto_user_created', new Date().toISOString());
                    
                    // IMMEDIATE redirect to signup with Google OAuth context via query params
                    console.log('🚀 IMMEDIATE redirect to signup using window.location with query params');
                    const emailParam = encodeURIComponent(userInfo.email);
                    window.location.replace(`/signup?google=1&email=${emailParam}`);
                    return;
                  } else {
                    throw new Error('Failed to create user account');
                  }
                } catch (signupError) {
                  console.error('Failed to create user account:', signupError);
                  // Restore body display on error
                  document.body.style.display = '';
                  setIsGoogleOAuthInProgress(false);
                  toast.error('Failed to create account. Please try again.');
                }
              }
            } else {
              // Restore body display on error
              document.body.style.display = '';
              setIsGoogleOAuthInProgress(false);
              toast.error('Failed to get user information from Google');
            }
          } catch (error) {
            console.error('Google OAuth error:', error);
            // Restore body display on error
            document.body.style.display = '';
            setIsGoogleOAuthInProgress(false);
            toast.error('Google sign-in failed. Please try again.');
          }
        },
        onError: (error) => {
          console.error('Google OAuth error:', error);
          toast.error('Google sign-in failed. Please try again.');
        }
      })
    : () => {
        toast('Google Sign-In is not configured');
      };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      {/* Show loading state during Google OAuth */}
      {isGoogleOAuthInProgress && (
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-2xl font-bold text-gray-900 mb-2">Signing you in...</p>
          <p className="text-gray-600">Please wait while we complete your authentication.</p>
        </div>
      )}

      {/* Hide the main form during Google OAuth */}
      {!isGoogleOAuthInProgress && (
        <>
          {/* Background decorative elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
            <div className="absolute top-40 left-40 w-80 h-80 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
          </div>

          {/* Main form card */}
          <div className="relative w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h1>
                <p className="text-gray-600">
                  Don't have an account?{' '}
                  <Link
                    to={ROUTES.signup}
                    className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    Sign up
                  </Link>
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                    Email address
                  </label>
                  <input
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Please enter a valid email address',
                      },
                    })}
                    type="email"
                    id="email"
                    placeholder="Email"
                    className={`w-full px-4 py-3 border rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      errors.email ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-900 mb-2">
                    Password
                  </label>
                  <input
                    {...register('password', {
                      required: 'Password is required',
                    })}
                    type="password"
                    id="password"
                    placeholder="Password"
                    className={`w-full px-4 py-3 border rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      errors.password ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>
                  )}
                </div>

                {/* Login Error Message */}
                {loginError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-red-700">{loginError}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="rememberMe"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-900">
                      Remember me
                    </label>
                  </div>
                  <Link
                    to={ROUTES.forgotPassword}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Primary Login Button */}
                <button
                  type="submit"
                  disabled={!isValid || isLoading}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-200 ${
                    isValid && !isLoading
                      ? 'bg-blue-600 hover:bg-blue-700 transform hover:scale-[1.02]'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Signing in...</span>
                    </div>
                  ) : (
                    'SIGN IN'
                  )}
                </button>
              </form>

              {/* Separator */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">or</span>
                </div>
              </div>

              {/* Social Login Buttons */}
              <div className="space-y-3">
                {/* Google - Only show if OAuth is available */}
                {isGoogleOAuthAvailable() && (
                  <button
                    onClick={() => handleGoogleSignIn()}
                    className="w-full flex items-center justify-center space-x-3 py-3 px-4 border border-gray-300 rounded-xl bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-200"
                  >
                    <div className="w-5 h-5">
                      <svg viewBox="0 0 24 24" className="w-5 h-5">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </div>
                    <span className="font-medium">Continue with Google</span>
                  </button>
                )}
              </div>

              {/* Terms */}
              <div className="mt-8 text-center">
                <p className="text-xs text-gray-500">
                  By continuing, you agree to our{' '}
                  <a href="#" className="text-blue-600 hover:text-blue-700 underline">
                    Terms of Use & Privacy Policy
                  </a>
                  .
                </p>
              </div>


            </div>
          </div>
        </>
      )}
    </div>
  );
};
