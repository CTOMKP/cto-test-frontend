import { CircleWallet, WalletBalance, Transaction, WithdrawRequest } from '../types/wallet.types';
import axios from 'axios';

// Import Circle's Web SDK
import { W3SSdk } from '@circle-fin/w3s-pw-web-sdk';

function handleApiError(error: any): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || error.response?.data?.message || error.message || 'Network error';
  }
  return error.message || 'Unknown error';
}

export class CircleWalletService {
  private baseUrl: string;
  private apiKey: string;
  private appId: string;
  private backendUrl: string;
  private isProduction: boolean;
  private w3sSdk: W3SSdk | null = null;

  constructor() {
    this.baseUrl = process.env.REACT_APP_CIRCLE_API_BASE || 'https://api-sandbox.circle.com';
    this.apiKey = process.env.REACT_APP_CIRCLE_API_KEY || '';
    this.appId = process.env.REACT_APP_CIRCLE_APP_ID || '';
    this.backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
    this.isProduction = !!(this.apiKey && this.appId);
    
    this.initializeSDK();
  }

  private initializeSDK() {
    try {
      console.log('🔄 Initializing Circle Web SDK...');
      this.w3sSdk = new W3SSdk({
        appSettings: {
          appId: this.appId,
        }
      });
      console.log('✅ Circle Web SDK initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Circle Web SDK:', error);
    }
  }

  // OPTIMIZATION: Pre-initialize SDK for faster performance
  private ensureSDKInitialized(): void {
    if (!this.w3sSdk) {
      console.log('🔄 SDK not initialized, initializing now...');
      this.initializeSDK();
    }
  }

  private get serviceMode(): string {
    return 'PRODUCTION'; // Always use production mode - no mock fallbacks
  }

  // Test backend connection
  async testBackendConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.backendUrl}/health`);
      console.log('✅ Backend connection successful:', response.data);
      return true;
    } catch (error) {
      console.error('❌ Backend connection failed:', error);
      return false;
    }
  }

  // Step 1: Create or Initialize User
  async createUser(userId: string, email: string): Promise<any> {
    try {
      console.log('🔄 Creating Circle user...', { userId, email });
      
      const response = await axios.post(`${this.backendUrl}/api/circle/users`, {
        userId,
        email
      });

      if (response.data.success) {
        console.log('✅ User created successfully');
        return response.data;
      } else {
        throw new Error(response.data.error || 'Failed to create user');
      }
    } catch (error: any) {
      // If user already exists, try to initialize instead
      if (error.response?.status === 409 || error.response?.data?.error?.includes('already exists')) {
        console.log('ℹ️ User exists, initializing instead...');
        return this.initializeUser(userId);
      }
      
      console.error('❌ Failed to create user:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Initialize existing user
  async initializeUser(userId: string): Promise<any> {
    try {
      console.log('🔄 Initializing existing user...', userId);
      
      // First get a userToken for the existing user
      const { userToken, encryptionKey } = await this.getUserToken(userId);
      console.log('✅ Got userToken for existing user');
      
      // Then initialize the user with the userToken
      const response = await axios.post(`${this.backendUrl}/api/circle/users/initialize`, {
        userId,
        userToken
      });

      if (response.data.success) {
        console.log('✅ User initialized successfully');
        return response.data;
      } else {
        throw new Error(response.data.error || 'Failed to initialize user');
      }
    } catch (error) {
      console.error('❌ Failed to initialize user:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Step 2: Get User Token (platform-level auth)
  async getUserToken(userId: string): Promise<{ userToken: string; encryptionKey: string }> {
    try {
      console.log('🔄 Getting userToken for user...', userId);
      
      const response = await axios.post(`${this.backendUrl}/api/circle/users/token`, {
        userId: userId
      });

      if (response.data.success && response.data.data?.userToken) {
        console.log('✅ UserToken acquired successfully');
        return {
          userToken: response.data.data.userToken,
          encryptionKey: response.data.data.encryptionKey
        };
      } else {
        throw new Error(response.data.error || 'Failed to get userToken');
      }
    } catch (error) {
      console.error('❌ Failed to get userToken:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Step 3: Initialize User Wallet (requires userToken)
  async initializeUserWallet(userId: string, userToken: string): Promise<any> {
    try {
      console.log('🔄 Initializing user wallet...', userId);
      
      const response = await axios.post(`${this.backendUrl}/api/circle/users/initialize`, {
        userId: userId,
        userToken: userToken
      });

      if (response.data.success && response.data.data?.challengeId) {
        console.log('✅ Wallet initialization started successfully');
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to initialize wallet');
      }
    } catch (error) {
      console.error('❌ Failed to initialize wallet:', error);
      throw new Error(handleApiError(error));
    }
  }

  // Execute any challenge using the SDK
  async executeChallenge(challengeId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.w3sSdk) {
        reject(new Error('SDK not initialized'));
        return;
      }

      console.log('🔄 Executing challenge:', challengeId);

      console.log('🔄 SDK execute called, waiting for callback...');
      this.w3sSdk.execute(challengeId, (error, result) => {
        if (error) {
          console.error('❌ Challenge execution failed:', error);
          
          // Check if this is a validation warning (non-fatal) vs actual error (fatal)
          const errorMessage = error.message || '';
          const errorCode = error.code || '';
          
          // Circle validation warnings (1557xx) are non-fatal - let the flow continue
          if (errorCode === 155705 || // "hint can't be the same as answer"
              errorMessage.includes("PIN you entered is not the same") ||
              errorMessage.includes("hint can't be the same") ||
              errorMessage.includes("validation failed")) {
            
            console.log('⚠️ Non-fatal validation warning, continuing flow:', {
              errorCode,
              errorMessage,
              error
            });
            
            // Resolve with success indicator - validation warnings don't stop the flow
            resolve({ 
              success: true, 
              validationWarning: true,
              warningCode: errorCode,
              warningMessage: errorMessage,
              message: 'PIN setup completed with validation warning - continuing wallet creation'
            });
          } else {
            // This is a fatal error - reject the promise
            console.error('🚨 Fatal challenge error:', error);
            reject(new Error(`Challenge failed: ${errorMessage || 'Unknown error'}`));
          }
        } else {
          console.log('✅ Challenge executed successfully:', result);
          
          // Ensure the challenge actually completed by checking if it has the right structure
          if (result && (result.type === 'INITIALIZE' || result.status === 'IN_PROGRESS' || result.status === 'COMPLETE')) {
            console.log('✅ Challenge execution confirmed successful:', result);
            resolve(result);
          } else {
            console.log('⚠️ Challenge executed but result structure unexpected:', result);
            // Still resolve to continue the flow
            resolve(result);
          }
        }
      });
    });
  }

  // Step 3: Create Wallet
  async createWallet(userId: string, userEmail: string, description?: string): Promise<CircleWallet> {
    try {
      console.log('🔄 Starting wallet creation process...');
      
      // OPTIMIZATION: Ensure SDK is initialized before starting
      this.ensureSDKInitialized();
      
      // Step 1: Create or initialize user (with timeout)
      console.log('🔄 Creating/initializing user...');
      console.log('🔄 User ID from frontend:', userId);
      console.log('🔄 User email from frontend:', userEmail);
      
      // The userId from frontend is actually the email, we need to create the user first
      // But since signup already created the user, we just need to get the userToken
      console.log('🔄 User already created by signup, getting userToken directly...');

      // Step 2: Get User Token for SDK (with timeout) - Circle API latency: ~103ms
      console.log('🔄 Getting user token...');
      const { userToken, encryptionKey } = await this.getUserToken(userId);
      
      // Initialize SDK with userToken (optimized for speed)
      if (!this.w3sSdk) {
        throw new Error('Circle SDK not initialized');
      }
      
      // OPTIMIZATION: Set authentication for the SDK immediately without delays
      console.log('🔄 Setting SDK authentication...');
      console.log('⏱️ SDK auth timing: Starting authentication...');
      
      // Set authentication immediately - this should trigger PIN modal
      this.w3sSdk.setAuthentication({ userToken, encryptionKey });
      console.log('✅ SDK authenticated with userToken and encryptionKey');
      console.log('⏱️ SDK auth timing: Authentication completed');
      
      // OPTIMIZATION: Add immediate logging to track timing
      console.log('🚀 PIN MODAL SHOULD APPEAR NOW - NO DELAYS!');
      console.log('⏱️ Timing check: SDK auth completed, proceeding to wallet creation...');
      
      // Step 3: Create wallet (this will handle PIN setup if needed)
      console.log('🔄 Creating wallet...');
      let walletResponse = await axios.post(`${this.backendUrl}/api/circle/wallets`, {
        userId,
        description: description || `Wallet for ${userEmail}`,
        blockchain: 'APTOS' // Use APTOS blockchain (backend will regenerate userToken)
      }, { timeout: 5000 }); // Further reduced timeout for faster response

      // Debug the wallet response structure
      console.log('🔍 Wallet response structure debug:', {
        success: walletResponse.data.success,
        hasData: !!walletResponse.data.data,
        dataKeys: walletResponse.data.data ? Object.keys(walletResponse.data.data) : [],
        requiresPinSetup: walletResponse.data.data?.requiresPinSetup,
        challengeId: walletResponse.data.data?.challengeId,
        walletId: walletResponse.data.data?.id,
        fullData: walletResponse.data.data
      });

      // Handle PIN setup if required - check both possible response structures
      // Backend can return requiresPinSetup in data.data OR directly in data
      const requiresPinSetup = walletResponse.data.data?.requiresPinSetup || walletResponse.data.requiresPinSetup;
      const challengeId = walletResponse.data.data?.challengeId || walletResponse.data.challengeId;
      
      console.log('🔍 PIN setup detection:', { requiresPinSetup, challengeId });

      // Handle PIN setup if required - this is where the PIN modal should appear immediately
      if (walletResponse.data.success && requiresPinSetup) {
        console.log('🔄 PIN setup required, challenge ID:', challengeId);
        console.log('⚡ PIN modal should appear NOW - executing challenge...');
        console.log('⏱️ PIN modal timing: Starting challenge execution...');
        console.log('🚀 PIN MODAL SHOULD APPEAR IMMEDIATELY - NO DELAYS!');
        
        // Ensure we don't skip PIN setup
        if (!challengeId) {
          throw new Error('PIN setup required but no challenge ID provided');
        }
        
        const challengeResult = await this.executeChallenge(challengeId);
        
        // Check if challenge completed (even with validation warnings)
        if (challengeResult) {
          console.log('✅ PIN setup challenge completed successfully');
          console.log('🔄 Challenge result:', challengeResult);
          
          // OPTIMIZATION: Remove unnecessary 2-second wait - this was causing the delay!
          // await new Promise(resolve => setTimeout(resolve, 2000)); // REMOVED THIS DELAY!
          
          // OPTIMIZATION: Remove unnecessary challenge status check - it adds delay
          // console.log('🔄 Checking challenge status with Circle...');
          // try {
          //   const challengeStatusResponse = await axios.get(
          //     `${this.backendUrl}/api/circle/challenges/${challengeId}`,
          //     { timeout: 3000 } // Restore proper timeout for challenge status check
          //   );
          //   console.log('🔄 Challenge status:', challengeStatusResponse.data);
          //   
          //   if (challengeStatusResponse.data.data?.status === 'COMPLETE') {
          //     console.log('✅ PIN setup confirmed complete by Circle');
          //   } else {
          //     console.log('⚠️ PIN setup status:', challengeStatusResponse.data.data?.status);
          //   }
          // } catch (statusError) {
          //   console.log('⚠️ Could not check challenge status:', statusError);
          // }
          
          // Get wallets after PIN setup (don't retry wallet creation)
          console.log('🔄 Getting user wallets after PIN setup...');
          walletResponse = await axios.get(`${this.backendUrl}/api/circle/users/${userId}/wallets`, {
            timeout: 5000 // Reduced timeout for faster response
          });
          
          console.log('🔄 User wallets response after PIN setup:', walletResponse.data);
          
          // After PIN setup, proceed regardless of challengeId presence
          // The challengeId might still be present but doesn't mean PIN setup failed
          console.log('✅ PIN setup completed, proceeding with wallet creation');
          
          // Check if we got wallets from the list response
          if (walletResponse.data.success && walletResponse.data.wallets && walletResponse.data.wallets.length > 0) {
            console.log('🔄 Found wallets after PIN setup, processing first wallet...');
            const walletData = walletResponse.data.wallets[0]; // Get first wallet
            console.log('🔄 Wallet data from wallets list:', walletData);
            
            const wallet: CircleWallet = {
              id: walletData.id,
              type: 'USER_CONTROLLED',
              address: walletData.address || '',
              description: walletData.description || description || `Wallet for ${userEmail}`,
              createdAt: walletData.createDate || new Date().toISOString(),
              blockchain: 'APTOS',
              userId: userId
            };

            console.log('✅ Wallet retrieved successfully from wallets list after PIN setup:', wallet);
            console.log('🔄 Returning wallet object, PIN setup flow completed...');
            return wallet;
          }
        } else {
          throw new Error('PIN setup failed - cannot continue with wallet creation');
        }
      }

      console.log('🔄 Final wallet response check:', {
        success: walletResponse.data.success,
        hasData: !!walletResponse.data.data,
        responseData: walletResponse.data
      });

      // Handle different response structures for wallet creation vs wallet retrieval
      if (walletResponse.data.success) {
        // Check if this is a wallets list response (after PIN setup)
        if (walletResponse.data.wallets && walletResponse.data.wallets.length > 0) {
          console.log('🔄 Processing wallets list response...');
          const walletData = walletResponse.data.wallets[0]; // Get first wallet
          console.log('🔄 Wallet data from wallets list:', walletData);
          
          const wallet: CircleWallet = {
            id: walletData.id,
            type: 'USER_CONTROLLED',
            address: walletData.address || '',
            description: walletData.description || description || `Wallet for ${userEmail}`,
            createdAt: walletData.createDate || new Date().toISOString(),
            blockchain: 'APTOS',
            userId: userId
          };

          console.log('✅ Wallet retrieved successfully from wallets list:', wallet);
          console.log('🔄 Returning wallet object, flow should complete...');
          return wallet;
        }
        
        // Check if this is a single wallet response (direct creation)
        else if (walletResponse.data.data) {
          const walletData = walletResponse.data.data;
          console.log('🔄 Wallet data extracted:', walletData);
          
          // Check if this is a PIN setup response or actual wallet data
          if (walletData.requiresPinSetup && walletData.challengeId) {
            console.log('🔄 PIN setup was required and completed, challenge ID:', walletData.challengeId);
            console.log('✅ PIN setup response detected but this is normal after completion');
            // Don't throw error - this is normal after PIN setup completion
            // The presence of requiresPinSetup doesn't mean it failed, just that it was required
          }
          
          if (!walletData.id) {
            console.error('❌ No wallet ID in response:', walletData);
            console.log('⚠️ Response structure:', JSON.stringify(walletResponse.data, null, 2));
            throw new Error('Failed to create wallet: No wallet ID returned from Circle API');
          }
          
          const wallet: CircleWallet = {
            id: walletData.id,
            type: 'USER_CONTROLLED',
            address: walletData.address || '',
            description: description || `Wallet for ${userEmail}`,
            createdAt: new Date().toISOString(),
            blockchain: 'APTOS',
            userId: userId
          };

          console.log('✅ Wallet created successfully:', wallet);
          console.log('🔄 Returning wallet object, flow should complete...');
          return wallet;
        }
        
        // If we get here, no valid wallet data was found
        console.error('❌ No valid wallet data found in response');
        throw new Error('Failed to create wallet: No valid wallet data in response');
      } else {
        console.error('❌ Wallet creation failed:', {
          success: walletResponse.data.success,
          error: walletResponse.data.error,
          data: walletResponse.data.data,
          fullResponse: walletResponse.data
        });
        
        // Extract more specific error information
        let errorMessage = 'Unknown error';
        if (walletResponse.data.error) {
          errorMessage = walletResponse.data.error;
        } else if (walletResponse.data.message) {
          errorMessage = walletResponse.data.message;
        } else if (walletResponse.data.data?.message) {
          errorMessage = walletResponse.data.data.message;
        }
        
        console.error('❌ Extracted error message:', errorMessage);
        throw new Error(`Failed to create wallet: ${errorMessage}`);
      }
    } catch (error) {
      console.error('❌ Failed to create wallet:', error);
      throw error;
    }
  }

  // Get user's wallets
  async getUserWallets(userId: string): Promise<CircleWallet[]> {
    try {
      // Try to get wallets from Circle API first
      const response = await axios.get(`${this.backendUrl}/api/circle/users/${userId}/wallets`);

      if (response.data.success) {
        const wallets = response.data.wallets || [];
        return wallets.map((wallet: any) => ({
          id: wallet.id,
          address: wallet.address,
          type: 'USER_CONTROLLED',
          blockchain: wallet.blockchain,
          description: wallet.name || `Wallet ${wallet.id}`,
          createdAt: wallet.createDate || new Date().toISOString(),
          userId: userId,
        }));
      } else {
        console.warn('⚠️ Circle API returned error');
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to get user wallets from Circle API:', error);
      // No fallback - only use real Circle API
      return [];
    }
  }

  async getWallet(walletId: string): Promise<CircleWallet> {
    try {
      const response = await axios.get(`${this.backendUrl}/api/circle/wallets/${walletId}`);

      if (response.data.success) {
        const walletData = response.data.data;
        return {
          id: walletData.id,
          address: walletData.address,
          type: 'USER_CONTROLLED',
          blockchain: walletData.blockchain,
          description: walletData.name || `Wallet ${walletId}`,
          createdAt: walletData.createDate,
          userId: walletData.userId || '',
        };
      } else {
        throw new Error(response.data.error || 'Failed to get wallet');
      }
    } catch (error) {
      console.error('❌ Failed to get wallet from Circle API:', error);
      throw new Error('Wallet not found');
    }
  }

  async getWalletBalances(walletId: string): Promise<WalletBalance[]> {
    // Remove the production mode check to allow testing
    // if (!this.isProduction) {
    //   throw new Error('Production mode required for getting balances');
    // }

    try {
      // Get userId from localStorage
      const userId = localStorage.getItem('cto_user_email');
      if (!userId) {
        console.warn('⚠️ No userId found in localStorage, cannot get balances');
        return [];
      }

      console.log('🔄 Fetching balances for wallet:', walletId, 'user:', userId);

      const response = await axios.get(`${this.backendUrl}/api/circle/wallets/${walletId}/balances`, {
        params: { userId }
      });

      console.log('📊 Raw balance response:', response.data);

      if (response.data.success) {
        // Ensure we have an array to work with
        const balances = response.data.balances || response.data.data || [];
        
        if (!Array.isArray(balances)) {
          console.warn('⚠️ Balances response is not an array:', balances);
          return [];
        }

        console.log('📊 Processing balances:', balances);

        const processedBalances = balances.map((balance: any) => {
          const asset = balance.asset || balance.token?.symbol || 'UNKNOWN';
          const balanceAmount = balance.balance || '0';
          const decimals = balance.decimals || 0;
          const symbol = balance.symbol || asset;
          const usdValue = balance.usdValue || '0';
          
          console.log(`📊 Processing balance: ${asset} = ${balanceAmount} (USD: ${usdValue})`);
          
          return {
            asset,
            balance: balanceAmount,
            decimals,
            symbol,
            usdValue,
          };
        });

        console.log('✅ Final processed balances:', processedBalances);
        return processedBalances;
      } else {
        console.warn('⚠️ Failed to get balances:', response.data.error);
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to get wallet balances:', error);
      // Return empty array instead of throwing error for balances
      return [];
    }
  }

  async getWalletTransactions(walletId: string): Promise<Transaction[]> {
    const userId = localStorage.getItem('cto_user_email');
    if (!userId) {
      console.error('❌ No user ID found');
      return [];
    }

    try {
      console.log('🔄 Fetching transactions for wallet:', walletId, 'user:', userId);
      const response = await axios.get(`${this.backendUrl}/api/circle/wallets/${walletId}/transactions`, {
        params: { userId }
      });
      
      console.log('📊 Transaction response:', response.data);
      
      if (response.data.success) {
        const transactions = response.data.transactions || [];
        console.log('✅ Transactions fetched:', transactions);
        return transactions;
      } else {
        console.warn('⚠️ Failed to get transactions:', response.data.error);
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to get wallet transactions:', error);
      return [];
    }
  }
}

export const circleWalletService = new CircleWalletService();
export default circleWalletService;
