import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../hooks/useAuth';
import { useCircleWallet } from '../../hooks/useCircleWallet';
import { ROUTES } from '../../utils/constants';
import toast from 'react-hot-toast';
import { QRCodeDisplay } from '../Wallet/QRCodeDisplay';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';

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

interface SignUpFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

export const SignUpForm: React.FC = () => {
  const { signup, isLoading } = useAuth();
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [signupError, setSignupError] = useState<string>('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  
  // Initialize wallet hook without userId (we'll pass it directly to createWallet)
  const { createWallet, isCreatingWallet: walletCreating } = useCircleWallet();
  const navigate = useNavigate();
  const location = useLocation();

  // Immediate redirect check - prevent any rendering if user has wallet
  useEffect(() => {
    const walletId = localStorage.getItem('cto_wallet_id');
    const authToken = localStorage.getItem('cto_auth_token');
    
    if (authToken && walletId) {
      console.log('🔄 SignUpForm: User already has wallet, redirecting immediately');
      setShouldRedirect(true);
      navigate(ROUTES.profile, { replace: true });
      return;
    }
  }, [navigate]);

  // If should redirect, don't render anything
  if (shouldRedirect) {
    return null;
  }

  // Check if user came from Google OAuth
  const [isGoogleOAuthUser, setIsGoogleOAuthUser] = useState(false);
  const [googleUserEmail, setGoogleUserEmail] = useState<string>('');

  // Check for Google OAuth user on component mount and from navigation/query params
  useEffect(() => {
    const checkUserStatus = async () => {
      const storedEmail = localStorage.getItem('cto_user_email');
      const authToken = localStorage.getItem('cto_auth_token');
      const walletId = localStorage.getItem('cto_wallet_id');

      // 1) Detect via query params (authoritative)
      const params = new URLSearchParams(window.location.search);
      const googleParam = params.get('google');
      const emailParam = params.get('email');
      if (googleParam === '1' && emailParam) {
        console.log('🔄 Detected Google OAuth user via query params:', emailParam);
        setIsGoogleOAuthUser(true);
        setGoogleUserEmail(emailParam);
        if (walletId) {
          console.log('🔄 User already has wallet, redirecting to profile');
          navigate(ROUTES.profile, { replace: true });
          return;
        }
        // Clean URL (remove query params) to avoid re-triggering on refresh
        window.history.replaceState({}, document.title, window.location.pathname);
        setIsCheckingAuth(false);
        return;
      }

      // 2) Detect via navigation state (legacy path)
      const isFromGoogleOAuth = location.state?.isGoogleOAuth;
      const userEmailFromState = location.state?.userEmail;
      if (isFromGoogleOAuth && userEmailFromState) {
        console.log('🔄 Detected Google OAuth user from navigation state:', userEmailFromState);
        setIsGoogleOAuthUser(true);
        setGoogleUserEmail(userEmailFromState);
        if (walletId) {
          console.log('🔄 User already has wallet, redirecting to profile');
          navigate(ROUTES.profile, { replace: true });
          return;
        }
        window.history.replaceState({}, document.title);
        setIsCheckingAuth(false);
        return;
      }

      // 3) Detect via localStorage (fallback)
      if (storedEmail && authToken) {
        setGoogleUserEmail(storedEmail);
        // Consider token google if it starts with google_token_ or backend issued
        setIsGoogleOAuthUser(authToken.startsWith('google_token_') || authToken.length > 20);
        console.log('🔄 Detected user from localStorage:', storedEmail);
        if (walletId) {
          console.log('🔄 User already has wallet, redirecting to profile');
          navigate(ROUTES.profile, { replace: true });
          return;
        }
      }

      setIsCheckingAuth(false);
    };

    checkUserStatus();
  }, [navigate, location.state]);

  // Refresh authentication state after successful wallet creation
  const { refreshAuth } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    setValue,
  } = useForm<SignUpFormData>({
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: ''
    }
  });

  // Pre-fill email for Google OAuth users
  useEffect(() => {
    if (googleUserEmail) {
      setValue('email', googleUserEmail);
      setValue('password', 'google_oauth_user');
      setValue('confirmPassword', 'google_oauth_user');
    }
  }, [googleUserEmail, setValue]);

  // Custom validation for Google OAuth users
  const isFormValid = () => {
    if (isGoogleOAuthUser) {
      // For Google OAuth users, only email is required
      return !!googleUserEmail;
    } else {
      // For regular users, all fields are required
      return watch('email') && watch('password') && watch('confirmPassword');
    }
  };

  const onSubmit = async (data: SignUpFormData) => {
    console.log('🔄 onSubmit called with data:', data);
    console.log('🔄 Current signupError state:', signupError);
    console.log('🔄 Is Google OAuth user:', isGoogleOAuthUser);
    
    try {
      setIsCreatingWallet(true);
      setSignupError(''); // Clear any previous errors
      console.log('🔄 Cleared signupError, new state should be empty');
      
      if (isGoogleOAuthUser) {
        // Google OAuth user - skip signup, go straight to wallet creation
        console.log('🔄 Google OAuth user detected, skipping signup, creating wallet directly...');
        
        const userEmail = data.email;
        console.log('🔄 Creating wallet for Google OAuth user:', userEmail);
        
        try {
          // Create wallet directly for Google OAuth user
          const wallet = await createWallet(userEmail, userEmail);
          console.log('✅ Wallet created successfully for Google OAuth user:', wallet);
          
          // Store wallet info
          localStorage.setItem('cto_wallet_id', wallet.id);
          localStorage.setItem('cto_wallet_address', wallet.address || '');
          
          setWalletAddress(wallet.address);
          toast.success('Wallet created successfully! Redirecting to dashboard...');
          
          // Refresh authentication state before redirecting
          refreshAuth();
          
          // Redirect to dashboard
          console.log('✅ Redirecting Google OAuth user to dashboard');
          navigate(ROUTES.profile);
        } catch (error) {
          console.error('❌ Wallet creation failed for Google OAuth user:', error);
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          if (errorMessage.includes('PIN setup required before wallet creation')) {
            // This is normal - PIN setup is in progress
            console.log('🔄 PIN setup in progress for Google OAuth user');
            toast('Completing PIN setup...', { icon: '🔐' });
            // Don't redirect - let the PIN setup complete
            return; // Exit early to prevent fallback check
          }
          
          // Only run fallback check if NOT a PIN setup issue
          try {
            console.log('⚠️ Checking if wallet exists for Google OAuth user...');
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';
            const walletsResponse = await axios.get(`${backendUrl}/api/circle/users/${userEmail}/wallets`);
            
            if (walletsResponse.data.success && walletsResponse.data.wallets && walletsResponse.data.wallets.length > 0) {
              console.log('✅ Wallet found in fallback check for Google OAuth user');
              const walletData = walletsResponse.data.wallets[0];
              
              // Store wallet info in localStorage
              localStorage.setItem('cto_wallet_id', walletData.id);
              localStorage.setItem('cto_user_email', userEmail);
              localStorage.setItem('cto_user_created', new Date().toISOString());
              localStorage.setItem('cto_wallet_address', walletData.address || '');
              
              // DON'T show success toast here - wallet was already created
              console.log('✅ Wallet recovered from fallback, redirecting...');
              
              // Refresh authentication state and redirect
              refreshAuth();
              setTimeout(() => {
                navigate(ROUTES.profile);
              }, 100);
              return;
            }
          } catch (fallbackError) {
            console.log('⚠️ Fallback wallet check failed for Google OAuth user:', fallbackError);
          }
          
          toast.error(`Wallet creation failed: ${errorMessage}`);
        }
      } else {
        // Regular user - normal signup flow
        console.log('Starting signup process for regular user...');
        console.log('Form data:', data);
        
        // Create user account
        console.log('🔄 About to call signup with:', { 
          email: data.email, 
          password: data.password, 
          confirmPassword: data.confirmPassword
        });
        
        const authResponse = await signup({ 
          email: data.email, 
          password: data.password, 
          confirmPassword: data.confirmPassword
        });
        
        console.log('🔄 Signup response received:', authResponse);
        
        console.log('=== SIGNUP DEBUG INFO ===');
        console.log('Full authResponse:', authResponse);
        console.log('authResponse type:', typeof authResponse);
        console.log('authResponse keys:', Object.keys(authResponse || {}));
        console.log('User object:', authResponse?.user);
        console.log('User object type:', typeof authResponse?.user);
        console.log('User object keys:', Object.keys(authResponse?.user || {}));
        console.log('User ID:', authResponse?.user?.id);
        console.log('User ID type:', typeof authResponse?.user?.id);
        console.log('User ID truthy check:', !!authResponse?.user?.id);
        console.log('=== END DEBUG INFO ===');
        
        // Check if signup actually succeeded
        if (!authResponse?.user?.id) {
          console.error('❌ Signup failed: No user ID in response');
          throw new Error('Signup failed: No user ID returned');
        }
        
        console.log('✅ Signup confirmed successful with user ID:', authResponse.user.id);
        
        // Create Circle wallet for the new user
        if (authResponse?.user && authResponse.user.id) {
          console.log('Creating wallet for user ID:', authResponse.user.id);
          
          try {
            // Start wallet creation process
            console.log('🔄 Starting wallet creation...');
            
            // Create wallet (this will handle PIN setup if needed)
            const wallet = await createWallet(authResponse.user.id, data.email);
            console.log('✅ Wallet created successfully:', wallet);
            
            // Store wallet ID in localStorage for dashboard access
            localStorage.setItem('cto_wallet_id', wallet.id);
            localStorage.setItem('cto_user_email', data.email);
            localStorage.setItem('cto_user_created', new Date().toISOString());
            localStorage.setItem('cto_wallet_address', wallet.address || '');
            
            // CRITICAL FIX: Set auth token after successful wallet creation
            const authToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
            localStorage.setItem('cto_auth_token', authToken);
            
            console.log('🔄 localStorage saved successfully');
            
            setWalletAddress(wallet.address);
            toast.success('Account and wallet created successfully! Redirecting to dashboard...');
            
            // Force authentication state update using refreshAuth
            refreshAuth();
            
            // Navigate to profile
            console.log('✅ Redirecting to dashboard');
            navigate(ROUTES.profile);
          } catch (error) {
            console.error('❌ Wallet creation error:', error);
            
            // Check if this is a PIN setup error (which is normal and expected)
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            if (errorMessage.includes('PIN setup required before wallet creation')) {
              // This is normal - PIN setup is in progress, don't show error
              console.log('🔄 PIN setup in progress, waiting for completion...');
              toast('Completing PIN setup...', { icon: '🔐' });
              // Don't redirect - let the PIN setup complete
              return; // Exit early to prevent fallback check
            }
            
            // Only run fallback check if NOT a PIN setup issue
            if (authResponse?.user?.id) {
              console.log('⚠️ Wallet creation failed, checking if wallet exists...');
              
              // Check if wallet was actually created despite the error (fallback check)
              try {
                const backendUrl = process.env.REACT_APP_BACKEND_URL || 'https://api.ctomarketplace.com';
                const walletsResponse = await axios.get(`${backendUrl}/api/circle/users/${data.email}/wallets`);
                
                if (walletsResponse.data.success && walletsResponse.data.wallets && walletsResponse.data.wallets.length > 0) {
                  console.log('✅ Wallet found in fallback check');
                  const walletData = walletsResponse.data.wallets[0];
                  
                  // Store wallet info in localStorage
                  localStorage.setItem('cto_wallet_id', walletData.id);
                  localStorage.setItem('cto_user_email', data.email);
                  localStorage.setItem('cto_user_created', new Date().toISOString());
                  localStorage.setItem('cto_wallet_address', walletData.address || '');
                  
                  // DON'T show success toast here - wallet was already created
                  console.log('✅ Wallet recovered from fallback, redirecting...');
                  
                  // Refresh authentication state and redirect
                  refreshAuth();
                  setTimeout(() => {
                    navigate(ROUTES.profile);
                  }, 100);
                  return;
                }
              } catch (fallbackError) {
                console.log('⚠️ Fallback wallet check failed:', fallbackError);
              }
              
              toast.error('Account created but wallet creation failed. Please try again.');
            } else {
              toast.error('Wallet creation failed. Please try again.');
            }
          }
        } else {
          console.error('User object missing or invalid:', authResponse?.user);
          console.error('authResponse structure:', JSON.stringify(authResponse, null, 2));
          throw new Error('User ID is required to create wallet');
        }
      }
    } catch (error) {
      console.error('Signup error:', error);
      
      // Check if this is the "Account already exists" error
      const errorMessage = error instanceof Error ? error.message : 'Failed to create account. Please try again.';
      
      if (errorMessage.includes('Account already exists')) {
        setSignupError('Account already exists. Please login instead.');
      } else if (errorMessage.includes('User ID is required to create wallet')) {
        // This means signup succeeded but wallet creation failed
        console.log('⚠️ Signup succeeded but wallet creation failed');
        toast.error('Account created but wallet creation failed. Please try again.');
        // Don't redirect - let user retry or complete PIN setup
      } else {
        setSignupError(errorMessage);
        toast.error('Failed to create account. Please try again.');
      }
    } finally {
      setIsCreatingWallet(false);
    }
  };

  const handleAppleSignIn = () => {
    toast('Apple Sign-In coming soon!');
  };

  // Temporarily disable Google OAuth - transitioning to Privy
  const googleLogin: any = false ? useGoogleLogin({
    onSuccess: async (response) => {
          try {
            console.log('🚀 Google OAuth success, response:', response);
            
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
              
              try {
                console.log('🔄 Checking if user exists by getting wallets:', userInfo.email);
                const walletsResponse = await axios.get(`${backendUrl}/api/circle/users/${userInfo.email}/wallets`);
                
                if (walletsResponse.data.wallets && walletsResponse.data.wallets.length > 0) {
                  // User exists and has wallets - redirect to profile
                  console.log('✅ User exists with wallets, redirecting to profile');
                  
                  // Store user info in localStorage
                  localStorage.setItem('cto_user_email', userInfo.email);
                  localStorage.setItem('cto_user_created', new Date().toISOString());
                  localStorage.setItem('cto_auth_token', `google_token_${Date.now()}`);
                  
                  if (walletsResponse.data.wallets[0]?.id) {
                    localStorage.setItem('cto_wallet_id', walletsResponse.data.wallets[0].id);
                  }
                  
                  // Redirect to profile
                  navigate(ROUTES.profile);
                  return;
                } else {
                  // Empty wallets array means user exists but has no wallets - create wallet
                  console.log('🔄 Empty wallets array - user exists but has no wallets, redirecting to signup for wallet creation...');
                  
                  // Store user info
                  localStorage.setItem('cto_user_email', userInfo.email);
                  localStorage.setItem('cto_user_created', new Date().toISOString());
                  localStorage.setItem('cto_auth_token', `google_token_${Date.now()}`);
                  
                  // Redirect to signup for wallet creation with proper state
                  navigate(ROUTES.signup, { 
                    state: { 
                      isGoogleOAuth: true, 
                      userEmail: userInfo.email 
                    } 
                  });
                  return;
                }
              } catch (walletsError) {
                // API call failed - this means user doesn't exist in Circle
                console.log('🔄 User does not exist in Circle (wallets endpoint failed), creating new account...');
                
                try {
                  const signupResponse = await axios.post(`${backendUrl}/api/circle/users`, {
                    userId: userInfo.email,
                    email: userInfo.email,
                    password: 'google_oauth_user'
                  });
                  
                  if (signupResponse.data.success) {
                    console.log('✅ New user account created successfully');
                    
                    // Store user info
                    localStorage.setItem('cto_user_email', userInfo.email);
                    localStorage.setItem('cto_user_created', new Date().toISOString());
                    localStorage.setItem('cto_auth_token', `google_token_${Date.now()}`);
                    
                    // Redirect to wallet creation page instead of general signup
                    // This will show the "Complete Your Account" page directly
                    navigate(ROUTES.signup, { 
                      state: { 
                        isGoogleOAuth: true, 
                        userEmail: userInfo.email 
                      } 
                    });
                    return;
                  } else {
                    throw new Error('Failed to create user account');
                  }
                } catch (signupError) {
                  console.error('Failed to create user account:', signupError);
                  toast.error('Failed to create account. Please try again.');
                }
              }
            } else {
              toast.error('Failed to get user info from Google');
            }
          } catch (error) {
            console.error('Google OAuth error:', error);
            toast.error('Google sign-in failed. Please try again.');
          }
        },
        onError: (error) => {
          console.error('Google OAuth error:', error);
          toast.error('Google sign-in failed. Please try again.');
        }
      }) : undefined;

  const handleGoogleSignIn = () => {
    if (!isGoogleOAuthAvailable()) {
      toast.error('Google OAuth not available');
      return;
    }
    
    // Trigger the Google OAuth flow
    googleLogin();
  };

  const handleSkipFunding = () => {
    setShowFundingModal(false);
    toast.success('Welcome to CTO Marketplace! You can fund your wallet later.');
    navigate(ROUTES.profile);
  };

  const handleConfirmFunding = () => {
    setShowFundingModal(false);
    toast.success('Great! Your wallet is ready to receive funds.');
    navigate(ROUTES.profile);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Loading State */}
      {isCheckingAuth && (
        <div className="relative w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Checking your account status...</p>
          </div>
        </div>
      )}

      {/* Main form card - only show when not checking auth */}
      {!isCheckingAuth && (
        <div className="relative w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {isGoogleOAuthUser ? 'Complete Your Account' : 'Sign up'}
              </h1>
              <p className="text-gray-600">
                {isGoogleOAuthUser ? (
                  <>
                    Welcome! Let's create your Circle wallet to get started.
                    <br />
                    <span className="text-sm text-gray-500">Signed in with: {googleUserEmail}</span>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <Link
                      to={ROUTES.login}
                      className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >
                      Log in
                    </Link>
                  </>
                )}
              </p>
            </div>

            {/* Email Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* For Google OAuth users, show a simplified form that focuses on wallet creation */}
              {isGoogleOAuthUser ? (
                <div className="text-center">
                  <div className="mb-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-gray-600 mb-4">
                      Your Google account is connected and ready for wallet creation.
                    </p>
                  </div>
                  
                  {/* Hidden email field for form submission */}
                  <input type="hidden" {...register('email')} />
                  <input type="hidden" {...register('password')} />
                  <input type="hidden" {...register('confirmPassword')} />
                </div>
              ) : (
                <>
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

                  {/* Password Fields - Only show for regular users */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-900 mb-2">
                      Password
                    </label>
                    <input
                      {...register('password', {
                        required: 'Password is required',
                        minLength: {
                          value: 8,
                          message: 'Password must be at least 8 characters long'
                        },
                        pattern: {
                          value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                          message: 'Password must contain at least one lowercase letter, one uppercase letter, and one number'
                        }
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

                  {/* Confirm Password Field */}
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-900 mb-2">
                      Confirm Password
                    </label>
                    <input
                      {...register('confirmPassword', {
                        required: 'Please confirm your password',
                        validate: (value) => value === watch('password') || 'Passwords do not match'
                      })}
                      type="password"
                      id="confirmPassword"
                      placeholder="Confirm Password"
                      className={`w-full px-4 py-3 border rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        errors.confirmPassword ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.confirmPassword && (
                      <p className="mt-2 text-sm text-red-600">{errors.confirmPassword.message}</p>
                    )}
                  </div>
                </>
              )}




              {/* Submit Button */}
              <button
                type="submit"
                disabled={!isFormValid() || isLoading || isCreatingWallet}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all ${
                  !isFormValid() || isLoading || isCreatingWallet
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transform hover:scale-105'
                }`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Creating account...
                  </span>
                ) : isCreatingWallet ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Creating wallet...
                  </span>
                ) : isGoogleOAuthUser ? (
                  'Create Wallet'
                ) : (
                  'Create Account'
                )}
              </button>

              {/* Signup Error Display */}
              {signupError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600 font-medium">
                    {signupError}
                  </p>
                </div>
              )}
            </form>

            {/* Separator - Only show for regular users */}
            {!isGoogleOAuthUser && (
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">or</span>
                </div>
              </div>
            )}

            {/* Social Login Buttons - Only show for regular users */}
            {!isGoogleOAuthUser && (
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
            )}

            {/* Terms - Show for all users */}
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
      )}

      {/* Funding Modal */}
      {showFundingModal && walletAddress && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to CTO Marketplace!</h2>
            <p className="text-gray-700 mb-6">
              Your Circle wallet has been created. You can now start using the platform.
            </p>
            <div className="flex justify-center">
              <QRCodeDisplay 
                data={{ address: walletAddress }}
                title="Your New Wallet"
                description="Scan this QR code to send funds to your wallet"
              />
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleSkipFunding}
                className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 transition-colors duration-200"
              >
                Skip Funding
              </button>
              <button
                onClick={handleConfirmFunding}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200"
              >
                Confirm Funding
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}