const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: './env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Circle API Configuration
const CIRCLE_API_BASE = process.env.CIRCLE_API_BASE || 'https://api.circle.com/v1/w3s';
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY;
const CIRCLE_APP_ID = process.env.CIRCLE_APP_ID;

// File path for storing user credentials
const CREDENTIALS_FILE = path.join(__dirname, 'user_credentials.json');

// In-memory storage for user credentials (will be loaded from file)
let userCredentials = new Map();

// Load user credentials from file on startup
async function loadUserCredentials() {
  try {
    const data = await fs.readFile(CREDENTIALS_FILE, 'utf8');
    const credentials = JSON.parse(data);
    userCredentials = new Map(Object.entries(credentials));
    console.log(`✅ Loaded ${userCredentials.size} user credentials from file`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('📁 No credentials file found, starting with empty storage');
      userCredentials = new Map();
    } else {
      console.error('❌ Error loading credentials file:', error.message);
      userCredentials = new Map();
    }
  }
}

// Save user credentials to file
async function saveUserCredentials() {
  try {
    const credentials = Object.fromEntries(userCredentials);
    await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
    console.log(`💾 Saved ${userCredentials.size} user credentials to file`);
  } catch (error) {
    console.error('❌ Error saving credentials file:', error.message);
  }
}

// Initialize credentials on startup
loadUserCredentials();

// Headers for Circle API - CORRECTED
const getCircleHeaders = (userToken = null) => {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CIRCLE_API_KEY}`,
  };
  
  if (userToken) {
    headers['X-User-Token'] = userToken;
  }
  
  return headers;
};

// Utility function for API error handling
const handleCircleApiError = (error, operation) => {
  console.error(`Circle API Error (${operation}):`, {
    status: error.response?.status,
    statusText: error.response?.statusText,
    data: error.response?.data,
    message: error.message
  });
  
  return {
    success: false,
    error: error.response?.data?.message || error.message || 'Unknown error',
    code: error.response?.status || 500
  };
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Circle Wallet Backend'
  });
});



// Remove the authenticateToken middleware function entirely

// Remove the generateToken function entirely

// 1. Create User (Simplified - just step 1)
app.post('/api/circle/users', async (req, res) => {
  try {
    const { userId, email, password, blockchain = 'APTOS' } = req.body;
    
    console.log('Creating Circle user:', { userId, email, blockchain });
    
    // Store password directly
    userCredentials.set(userId, password);
    
    // Save credentials to file
    await saveUserCredentials();
    
    console.log('🔐 User credentials stored for:', userId);
    
    // Check if user already exists in Circle
    console.log('🔍 Checking if user already exists in Circle...');
    try {
      const existingUserResponse = await axios.get(
        `${CIRCLE_API_BASE}/users/${userId}`,
        { headers: getCircleHeaders() }
      );
      
      if (existingUserResponse.data.data) {
        const existingUser = existingUserResponse.data.data;
        console.log('✅ User already exists in Circle:', existingUser);
        
        // Check if user has wallets
        console.log('🔍 Checking if user has wallets...');
        try {
          const walletsResponse = await axios.get(
            `${CIRCLE_API_BASE}/wallets`,
            { 
              headers: {
                ...getCircleHeaders(),
                'X-User-Token': 'temp' // We'll get a real token later
              }
            }
          );
          
          const hasWallets = walletsResponse.data.data?.wallets && walletsResponse.data.data.wallets.length > 0;
          console.log('🔍 User wallets status:', { hasWallets, walletCount: walletsResponse.data.data?.wallets?.length || 0 });
          
          if (!hasWallets) {
            console.log('🔄 User exists but has no wallets - continuing signup process');
            
            // User exists but no wallets - continue with signup
            res.json({
              success: true,
              message: 'User exists but has no wallets - continuing signup',
              user: {
                id: userId,
                email: email,
                status: 'exists_no_wallets',
                circleUserId: existingUser.id,
                pinStatus: existingUser.pinStatus
              },
              requiresWalletCreation: true
            });
            return;
          } else {
            console.log('❌ User exists and has wallets - cannot continue signup');
            res.status(409).json({
              success: false,
              error: 'User already exists and has wallets. Please login instead.'
            });
            return;
          }
        } catch (walletsError) {
          console.log('⚠️ Error checking wallets, assuming user can continue signup:', walletsError.response?.data);
          // If we can't check wallets, allow user to continue signup
          res.json({
            success: true,
            message: 'User exists - continuing signup',
            user: {
              id: userId,
              email: email,
              status: 'exists_continue',
              circleUserId: existingUser.id,
              pinStatus: existingUser.pinStatus
            },
            requiresWalletCreation: true
          });
          return;
        }
      }
    } catch (existingUserError) {
      if (existingUserError.response?.status === 404) {
        console.log('✅ User does not exist in Circle - creating new user');
        // User doesn't exist, continue with creation
      } else {
        console.log('⚠️ Error checking existing user, continuing with creation:', existingUserError.response?.data);
        // If we can't check, continue with creation
      }
    }
    
    // Create user in Circle API
    console.log('🔄 Step 1: Creating user...');
    
    const requestBody = { userId };
    console.log('📤 Request body being sent to Circle:', requestBody);
    
    const userResponse = await axios.post(
      `${CIRCLE_API_BASE}/users`,
      requestBody,
      { headers: getCircleHeaders() }
    );
    
    console.log('✅ User created successfully:', userResponse.data);
    
    res.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: userId,
        email: email,
        status: 'created',
        circleUserId: userResponse.data.data.id,
        pinStatus: userResponse.data.data.pinStatus
      },
      requiresWalletCreation: true
    });
    
  } catch (error) {
    console.error('❌ User creation failed:', error.response?.data || error.message);
    
    // Check if this is a "user already exists" error from Circle
    if (error.response?.data?.code === 155101) {
      console.log('🔄 Circle says user exists - checking if we can continue signup');
      
      try {
        // Try to get the existing user to see if we can continue
        const existingUserResponse = await axios.get(
          `${CIRCLE_API_BASE}/users/${userId}`,
          { headers: getCircleHeaders() }
        );
        
        if (existingUserResponse.data.data) {
          const existingUser = existingUserResponse.data.data;
          console.log('✅ Found existing user:', existingUser);
          
          // Allow user to continue signup if they don't have wallets
          console.log('🔄 User exists - allowing to continue signup process');
          
          res.json({
            success: true,
            message: 'User exists - continuing signup',
            user: {
              id: userId,
              email: email,
              status: 'exists_continue',
              circleUserId: existingUser.id,
              pinStatus: existingUser.pinStatus
            },
            requiresWalletCreation: true
          });
          return;
        }
      } catch (checkError) {
        console.log('⚠️ Could not check existing user:', checkError.response?.data);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
});

// 2. Login User
app.post('/api/circle/users/login', async (req, res) => {
  try {
    const { userId, email, password } = req.body;
    
    // Use email as primary identifier if userId is not provided
    const userIdentifier = email || userId;
    
    console.log('User login attempt:', { userId, email, userIdentifier });
    
    if (!userIdentifier) {
      console.log('❌ No user identifier provided');
      return res.status(400).json({ 
        success: false, 
        error: 'Email or userId is required' 
      });
    }
    
    // Check if user exists and verify password
    if (!userCredentials.has(userIdentifier)) {
      console.log('❌ User not found:', userIdentifier);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
    
    const storedPassword = userCredentials.get(userIdentifier);
    const isValidPassword = (password === storedPassword);
    
    if (!isValidPassword) {
      console.log('❌ Password verification failed for user:', userIdentifier);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }
    
    console.log('✅ Password verified for user:', userIdentifier);
    
    // Return user info and a simple token (not JWT)
    const user = {
      userId: userIdentifier, // Use the identifier for the user object
      email: email || userIdentifier // Use email if provided, otherwise use identifier
    };
    
    // Generate a simple token (just a random string for now)
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    res.json({
      success: true,
      user: user,
      token: token
    });
    
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// Remove the /me and /logout endpoints entirely since they're no longer needed

// 5. Forgot Password - Reset Password
app.post('/api/circle/users/forgot-password', async (req, res) => {
  try {
    const { userId, email, newPassword } = req.body;
    
    // Use email as primary identifier if userId is not provided
    const userIdentifier = email || userId;
    
    console.log('Password reset request for user:', { userId, email, userIdentifier });
    
    if (!userIdentifier) {
      console.log('❌ No user identifier provided for password reset');
      return res.status(400).json({ 
        success: false, 
        error: 'Email or userId is required' 
      });
    }
    
    // Check if user exists
    if (!userCredentials.has(userIdentifier)) {
      console.log('❌ User not found for password reset:', userIdentifier);
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Update password in memory and file
    userCredentials.set(userIdentifier, newPassword);
    await saveUserCredentials();
    
    console.log('✅ Password updated for user:', userIdentifier);
    
    res.json({
      success: true,
      message: 'Password updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Password reset failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reset password' 
    });
  }
});

// 5. Get User Token (platform-level auth)
app.post('/api/circle/users/token', async (req, res) => {
  try {
    const { userId } = req.body;
    
    console.log('Getting userToken for user:', userId);
    
    // STEP 2: Get userToken (platform-level auth with API key)
    console.log('🔄 Step 2: Getting userToken...');
    const tokenResponse = await axios.post(
      `${CIRCLE_API_BASE}/users/token`,
      { userId },
      { headers: getCircleHeaders() }
    );

    if (!tokenResponse.data.data?.userToken) {
      throw new Error('Failed to get userToken from Circle');
    }

    const userToken = tokenResponse.data.data.userToken;
    const encryptionKey = tokenResponse.data.data.encryptionKey;
    console.log('✅ UserToken acquired:', userToken.substring(0, 20) + '...');

    res.json({
      success: true,
      data: {
        userToken: userToken,
        encryptionKey: encryptionKey,
        userId: userId
      }
    });
  } catch (error) {
    console.error('Failed to get userToken:', error.response?.data);
    res.status(error.response?.status || 500).json(
      handleCircleApiError(error, 'get userToken')
    );
  }
});

// 3. Initialize User Wallet (requires userToken)
app.post('/api/circle/users/initialize', async (req, res) => {
  try {
    const { userId, userToken } = req.body;
    
    if (!userToken) {
      return res.status(400).json({
        success: false,
        error: 'userToken is required for user initialization'
      });
    }
    
    console.log('Initializing user wallet:', userId);
    
    // STEP 3: Initialize user wallet (requires BOTH platform API key + userToken)
    console.log('🔄 Step 3: Initializing wallet...');
    const headersWithUserToken = {
      ...getCircleHeaders(),
      'X-User-Token': userToken
    };

    const requestBody = {
      accountType: "EOA",
      blockchains: ["APTOS-TESTNET"],
      idempotencyKey: uuidv4()
    };

    const response = await axios.post(
      `${CIRCLE_API_BASE}/user/initialize`,
      requestBody,
      { headers: headersWithUserToken }
    );

    console.log('✅ Wallet initialization started:', response.data);
    
    res.json({
      success: true,
      data: response.data.data,
      challengeId: response.data.data.challengeId,
    });
  } catch (error) {
    console.error('Failed to initialize user:', error.response?.data);
    res.status(error.response?.status || 500).json(
      handleCircleApiError(error, 'initialize user')
    );
  }
});

// 3. Create Wallet (After user is created/initialized)
app.post('/api/circle/wallets', async (req, res) => {
  try {
    const { userId, description, blockchain = 'APTOS' } = req.body;
    
    console.log('Creating wallet for user:', { userId, description, blockchain });
    console.log('📤 Full request body received:', req.body);

    // REGENERATE userToken right before wallet creation to avoid expiration
    console.log('🔄 Regenerating fresh userToken for wallet creation...');
    let freshUserToken;
    try {
      const tokenResponse = await axios.post(
        `${CIRCLE_API_BASE}/users/token`,
        { userId },
        { headers: getCircleHeaders() }
      );
      
      if (!tokenResponse.data.data?.userToken) {
        throw new Error('Failed to get fresh userToken from Circle');
      }
      
      freshUserToken = tokenResponse.data.data.userToken;
      console.log('✅ Fresh userToken acquired:', freshUserToken.substring(0, 20) + '...');
    } catch (error) {
      console.error('Failed to get fresh userToken:', error.response?.data);
      return res.status(500).json({
        success: false,
        error: 'Failed to get fresh userToken for wallet creation'
      });
    }
    
    // Create headers with the fresh userToken
    const headersWithUserToken = {
      ...getCircleHeaders(),
      'X-User-Token': freshUserToken
    };
    
    // Convert blockchain to the correct format for Circle API
    let circleBlockchain = blockchain;
    if (blockchain === 'APTOS') {
      circleBlockchain = 'APTOS-TESTNET'; // Use testnet for TEST_API_KEY
    }
    
    // Try to create wallet directly first
    console.log('🔄 Attempting to create wallet...');
    try {
      const response = await axios.post(
        `${CIRCLE_API_BASE}/user/wallets`,
        {
          userId: userId,
          blockchains: [circleBlockchain],
          count: 1,
          walletSetId: `wallet-set-${userId}-${Date.now()}`,
          idempotencyKey: uuidv4()
        },
        { 
          headers: headersWithUserToken,
          timeout: 5000
        }
      );
      
      console.log('✅ Wallet created successfully:', response.data);
      
      // Check if this is a real wallet creation or just a challengeId
      if (response.data.data?.wallets && response.data.data.wallets.length > 0) {
        // Real wallet was created - return wallet details
        const wallet = response.data.data.wallets[0];
        res.json({
          success: true,
          data: {
            id: wallet.id,
            address: wallet.address || '',
            type: 'USER_CONTROLLED',
            blockchain: circleBlockchain,
            description: description || `Wallet for ${userId}`,
            createDate: new Date().toISOString()
          },
          message: 'Wallet created successfully'
        });
      } else if (response.data.data?.challengeId) {
        // PIN setup required - return challenge
        res.json({
          success: true,
          data: {
            challengeId: response.data.data.challengeId,
            requiresPinSetup: true
          },
          message: 'PIN setup required before wallet creation'
        });
      } else {
        // Unknown response format
        res.json({
          success: true,
          data: response.data.data,
          message: 'Wallet creation response received'
        });
      }
    } catch (walletError) {
      console.log('Wallet creation failed, checking if PIN setup is required:', walletError.response?.data);
      console.log('Full wallet error response:', {
        status: walletError.response?.status,
        data: walletError.response?.data,
        message: walletError.response?.data?.message,
        code: walletError.response?.data?.code
      });
      
      // If wallet creation fails with "User has not set up a PIN yet", 
      // then we need to initialize the user for PIN setup
      if (walletError.response?.data?.code === 155110) {
        console.log('🔄 PIN setup required, initializing user...');
        try {
          const initResponse = await axios.post(
            `${CIRCLE_API_BASE}/user/initialize`,
            {
              accountType: "EOA",
              blockchains: [circleBlockchain],
              idempotencyKey: uuidv4()
            },
            { 
              headers: headersWithUserToken,
              timeout: 3000
            }
          );
          
          if (initResponse.data.data?.challengeId) {
            console.log('✅ User initialization returned PIN setup challenge');
            // Return the challenge ID for PIN setup
            return res.json({
              success: true,
              message: 'PIN setup required before wallet creation',
              challengeId: initResponse.data.data.challengeId,
              requiresPinSetup: true
            });
          }
        } catch (initError) {
          console.error('Failed to initialize user for PIN setup:', initError.response?.data);
        }
      }
      
      // If we get here, return the original wallet creation error
      res.status(walletError.response?.status || 500).json({
        success: false,
        error: walletError.response?.data?.message || 'Failed to create wallet',
        code: walletError.response?.status || 500,
        details: walletError.response?.data
      });
    }
  } catch (error) {
    console.error('Failed to create wallet:', error);
    console.error('Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
    
    // Handle different types of errors
    if (error.response) {
      // Circle API returned an error response
      res.status(error.response.status).json({
        success: false,
        error: error.response.data?.message || error.response.data?.error || 'Circle API error',
        code: error.response.status,
        details: error.response.data
      });
    } else if (error.request) {
      // Request was made but no response received
      res.status(500).json({
        success: false,
        error: 'No response from Circle API',
        code: 500
      });
    } else {
      // Something else happened
      res.status(500).json({
        success: false,
        error: error.message || 'Unknown error occurred',
        code: 500
      });
    }
  }
});

// 4. Get Wallet Transactions (MUST come before general wallet route)
app.get('/api/circle/wallets/:walletId/transactions', async (req, res) => {
  const { walletId } = req.params;
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }

  try {
    console.log(`Getting transactions for wallet: ${walletId} for user: ${userId}`);
    
    // Get user token first
    let freshUserToken;
    try {
      const tokenResponse = await axios.post(
        `${CIRCLE_API_BASE}/users/token`,
        { userId },
        { headers: getCircleHeaders() }
      );
      if (!tokenResponse.data.data?.userToken) {
        throw new Error('Failed to get userToken for transactions');
      }
      freshUserToken = tokenResponse.data.data.userToken;
    } catch (error) {
      console.error('Failed to get userToken for transactions:', error.response?.data);
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    // Try to fetch transactions from Circle API
    try {
      console.log(`🔍 Fetching transactions from: ${CIRCLE_API_BASE}/transactions`);
      console.log(`🔍 Headers: Authorization: Bearer ${CIRCLE_API_KEY.substring(0, 20)}..., X-User-Token: ${freshUserToken.substring(0, 50)}...`);
      
      // Use the correct Circle API endpoint: /transactions
      const response = await axios.get(`${CIRCLE_API_BASE}/transactions`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CIRCLE_API_KEY}`,
          'X-User-Token': freshUserToken
        },
        timeout: 15000
      });

      console.log('✅ Transactions response from Circle:', response.data);
      
      if (response.data && response.data.data && response.data.data.transactions) {
        const transactions = response.data.data.transactions
          .filter(tx => tx.walletId === walletId) // Filter by wallet ID
          .map((tx) => {
            // Log the raw transaction to understand the structure
            console.log('🔍 Raw transaction from Circle API:', JSON.stringify(tx, null, 2));
            
            // Extract data based on the actual Circle API response structure
            const amount = tx.amounts && tx.amounts.length > 0 ? tx.amounts[0] : '0';
            
            // Correctly map tokenId to currency based on actual Circle token IDs
            let currency = 'UNKNOWN';
            if (tx.tokenId === 'd457a992-b109-50eb-b5aa-9ef4609e81d2') {
              currency = 'APTOS-TESTNET';
            } else if (tx.tokenId === 'e3cbdafc-42c3-58cc-ae4c-b31dbb10354c') {
              currency = 'USDC';
            } else {
              // Fallback: try to determine from blockchain or other fields
              currency = tx.blockchain === 'APTOS-TESTNET' ? 'APTOS-TESTNET' : 'USDC';
            }
            
            const type = tx.transactionType === 'INBOUND' ? 'deposit' : 
                        tx.transactionType === 'OUTBOUND' ? 'withdrawal' : 'unknown';
            const status = tx.state?.toLowerCase() || 'pending';
            const timestamp = tx.createDate || tx.updateDate || new Date().toISOString();
            const description = tx.operation || `${type} ${amount} ${currency}`;
            const hash = tx.txHash || tx.transactionHash || null;
            
            return {
              id: tx.id,
              type: type,
              status: status,
              amount: amount,
              currency: currency,
              timestamp: timestamp,
              description: description,
              hash: hash,
              // Add additional fields that might be useful
              direction: tx.transactionType,
              walletId: tx.walletId,
              blockchain: tx.blockchain,
              sourceAddress: tx.sourceAddress,
              destinationAddress: tx.destinationAddress,
              blockHeight: tx.blockHeight
            };
          });
        
        console.log('✅ Processed transactions:', transactions);
        res.json({ success: true, transactions });
      } else {
        console.log('⚠️ No transactions found in response, structure:', JSON.stringify(response.data, null, 2));
        res.json({ success: true, transactions: [] });
      }
    } catch (circleApiError) {
      console.error('❌ Circle API transactions endpoint error:', {
        status: circleApiError.response?.status,
        data: circleApiError.response?.data,
        message: circleApiError.message,
        url: circleApiError.config?.url
      });
      
      // Return empty transactions array as fallback
      console.log('🔄 Returning empty transactions array as fallback');
      res.json({ success: true, transactions: [] });
    }
    
  } catch (error) {
    console.error('❌ Failed to get wallet transactions:', error);
    
    // Return empty transactions array instead of error
    console.log('🔄 Returning empty transactions array due to error');
    res.json({ success: true, transactions: [] });
  }
});

// 5. Get Wallet by ID
app.get('/api/circle/wallets/:walletId', async (req, res) => {
  try {
    const { walletId } = req.params;
    
    console.log('Getting wallet:', walletId);
    
    const response = await axios.get(
      `${CIRCLE_API_BASE}/wallets/${walletId}`,
      { headers: getCircleHeaders() }
    );

    console.log('Wallet retrieved:', response.data);
    
    res.json({
      success: true,
      data: response.data.data,
    });
  } catch (error) {
    console.error('Failed to get wallet:', error.response?.data);
    res.status(error.response?.status || 500).json(
      handleCircleApiError(error, 'get wallet')
    );
  }
});

// 6. Get User's Wallets
app.get('/api/circle/users/:userId/wallets', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('Getting wallets for user:', userId);
    
    // Get fresh userToken
    let freshUserToken;
    try {
      const tokenResponse = await axios.post(
        `${CIRCLE_API_BASE}/users/token`,
        { userId },
        { headers: getCircleHeaders() }
      );
      
      if (!tokenResponse.data.data?.userToken) {
        throw new Error('Failed to get userToken');
      }
      
      freshUserToken = tokenResponse.data.data.userToken;
    } catch (error) {
      console.error('Failed to get userToken:', error.response?.data);
      return res.status(500).json({
        success: false,
        error: 'Failed to get userToken'
      });
    }
    
    // Get user's wallets
    const headersWithUserToken = {
      ...getCircleHeaders(),
      'X-User-Token': freshUserToken
    };
    
    try {
      // Try the user-specific endpoint first
      let fullUrl = `${CIRCLE_API_BASE}/users/${userId}/wallets`;
      console.log('🔍 Trying user-specific endpoint:', fullUrl);
      
      let walletsResponse;
      try {
        walletsResponse = await axios.get(fullUrl, { headers: headersWithUserToken });
        console.log('✅ User-specific endpoint succeeded');
      } catch (error) {
        console.log('⚠️ User-specific endpoint failed, trying general wallets endpoint');
        
        // Fallback to general wallets endpoint
        fullUrl = `${CIRCLE_API_BASE}/wallets`;
        console.log('🔍 Trying general wallets endpoint:', fullUrl);
        
        walletsResponse = await axios.get(fullUrl, { headers: headersWithUserToken });
        console.log('✅ General wallets endpoint succeeded');
      }
      
      console.log('🔍 Final endpoint used:', fullUrl);
      console.log('🔍 Headers being sent:', {
        'Content-Type': headersWithUserToken['Content-Type'],
        'Authorization': headersWithUserToken['Authorization'] ? `${headersWithUserToken['Authorization'].substring(0, 20)}...` : 'Missing',
        'X-User-Token': headersWithUserToken['X-User-Token'] ? `${headersWithUserToken['X-User-Token'].substring(0, 20)}...` : 'Missing'
      });
      
      console.log('🔍 Wallets response structure:', JSON.stringify(walletsResponse.data, null, 2));
      console.log('🔍 walletsResponse.data.data:', walletsResponse.data.data);
      console.log('🔍 walletsResponse.data.data?.wallets:', walletsResponse.data.data?.wallets);
      console.log('🔍 walletsResponse.data.data?.wallets?.length:', walletsResponse.data.data?.wallets?.length);
      console.log('Wallets response:', walletsResponse.data);
      
      if (walletsResponse.data.data?.wallets && walletsResponse.data.data.wallets.length > 0) {
        const wallets = walletsResponse.data.data.wallets.map((wallet) => ({
          id: wallet.id,
          address: wallet.address || '',
          type: 'USER_CONTROLLED',
          blockchain: wallet.blockchain || 'APTOS-TESTNET',
          description: wallet.name || `Wallet for ${userId}`,
          createDate: wallet.createDate || new Date().toISOString()
        }));
        
        res.json({
          success: true,
          wallets: wallets,
          message: 'User wallets retrieved successfully'
        });
      } else {
        res.json({
          success: true,
          wallets: [],
          message: 'No wallets found for user'
        });
      }
    } catch (error) {
      console.error('Failed to get user wallets:', error.response?.data);
      res.status(500).json({
        success: false,
        error: 'Failed to get user wallets'
      });
    }
  } catch (error) {
    console.error('Failed to get user wallets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user wallets'
    });
  }
});

// 7. Get Wallet Details (after PIN setup is completed)
app.get('/api/circle/wallets/:userId/details', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('Getting wallet details for user:', userId);
    
    // Get fresh userToken
    let freshUserToken;
    try {
      const tokenResponse = await axios.post(
        `${CIRCLE_API_BASE}/users/token`,
        { userId },
        { headers: getCircleHeaders() }
      );
      
      if (!tokenResponse.data.data?.userToken) {
        throw new Error('Failed to get userToken');
      }
      
      freshUserToken = tokenResponse.data.data.userToken;
    } catch (error) {
      console.error('Failed to get userToken:', error.response?.data);
      return res.status(500).json({
        success: false,
        error: 'Failed to get userToken'
      });
    }
    
    // Get user's wallets
    const headersWithUserToken = {
      ...getCircleHeaders(),
      'X-User-Token': freshUserToken
    };
    
    try {
      const walletsResponse = await axios.get(
        `${CIRCLE_API_BASE}/users/${userId}/wallets`,
        { headers: headersWithUserToken }
      );
      
      console.log('Wallets response:', walletsResponse.data);
      
      if (walletsResponse.data.data?.wallets && walletsResponse.data.data.wallets.length > 0) {
        const wallet = walletsResponse.data.data.wallets[0]; // Get first wallet
        
        console.log('Found wallet:', wallet);
        
        // Get detailed wallet info
        const walletDetailsResponse = await axios.get(
          `${CIRCLE_API_BASE}/wallets/${wallet.id}`,
          { headers: headersWithUserToken }
        );
        
        const walletDetails = walletDetailsResponse.data.data;
        
        res.json({
          success: true,
          data: {
            id: wallet.id,
            address: walletDetails.address || '',
            type: 'USER_CONTROLLED',
            blockchain: walletDetails.blockchain || 'APTOS-TESTNET',
            description: walletDetails.name || `Wallet for ${userId}`,
            createDate: walletDetails.createDate || new Date().toISOString()
          },
          message: 'Wallet details retrieved successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'No wallets found for user'
        });
      }
    } catch (error) {
      console.error('Failed to get wallet details:', error.response?.data);
      res.status(500).json({
        success: false,
        error: 'Failed to get wallet details'
      });
    }
  } catch (error) {
    console.error('Failed to get wallet details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet details'
    });
  }
});

// 8. Get Wallet Balances
app.get('/api/circle/wallets/:walletId/balances', async (req, res) => {
  try {
    const { walletId } = req.params;
    const { userId } = req.query; // Get userId from query params
    
    console.log('Getting balances for wallet:', walletId, 'for user:', userId);
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required to get wallet balances'
      });
    }
    
    // Get fresh userToken for this user
    let freshUserToken;
    try {
      const tokenResponse = await axios.post(
        `${CIRCLE_API_BASE}/users/token`,
        { userId },
        { headers: getCircleHeaders() }
      );
      
      if (!tokenResponse.data.data?.userToken) {
        throw new Error('Failed to get userToken');
      }
      
      freshUserToken = tokenResponse.data.data.userToken;
    } catch (error) {
      console.error('Failed to get userToken for balances:', error.response?.data);
      return res.status(500).json({
        success: false,
        error: 'Failed to get userToken'
      });
    }
    
    // Get wallet balances with userToken
    const headersWithUserToken = {
      ...getCircleHeaders(),
      'X-User-Token': freshUserToken
    };
    
    const response = await axios.get(
      `${CIRCLE_API_BASE}/wallets/${walletId}/balances`,
      { headers: headersWithUserToken }
    );

    console.log('Wallet balances retrieved:', response.data);
    
    // Ensure we return an array even if no balances
    const rawBalances = response.data.data?.tokenBalances || [];
    console.log('Raw token balances from Circle:', rawBalances);
    
    // Transform and calculate USD values for balances
    const balances = rawBalances.map((balance, index) => {
      console.log(`Processing balance ${index}:`, balance);
      
      const tokenSymbol = balance.token?.symbol || 'UNKNOWN';
      const amount = parseFloat(balance.amount) || 0;
      
      console.log(`Token: ${tokenSymbol}, Amount: ${amount}, Raw amount: ${balance.amount}`);
      
      // Calculate USD value based on token type
      let usdValue = 0;
      if (amount > 0) {
        if (tokenSymbol === 'USDC') {
          // 1 USDC ≈ 1 USD (stablecoin)
          usdValue = amount;
        } else if (tokenSymbol === 'APT') {
          // For APT, we'd need real-time price, but for now use a placeholder
          // In production, you'd fetch this from a price API
          usdValue = amount * 10; // Placeholder: 1 APT = $10
        } else {
          // For other tokens, assume 1:1 ratio for now
          usdValue = amount;
        }
      }
      
      const processedBalance = {
        asset: tokenSymbol,
        balance: balance.amount || '0',
        decimals: balance.decimals || 0,
        symbol: tokenSymbol,
        usdValue: usdValue.toFixed(2),
        token: balance.token
      };
      
      console.log(`Processed balance:`, processedBalance);
      return processedBalance;
    });
    
    console.log('Final processed balances with USD values:', balances);
    
    res.json({
      success: true,
      data: balances,
      balances: balances,
    });
  } catch (error) {
    console.error('Failed to get wallet balances:', error.response?.data);
    res.status(error.response?.status || 500).json(
      handleCircleApiError(error, 'get wallet balances')
    );
  }
});

// 9. Get User Token (for frontend SDK initialization)
app.post('/api/circle/users/:userId/token', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('Getting userToken for user:', userId);
    
    const tokenResponse = await axios.post(
      `${CIRCLE_API_BASE}/users/token`,
      { userId },
      { headers: getCircleHeaders() }
    );
    
    if (!tokenResponse.data.data?.userToken) {
      throw new Error('Failed to get userToken');
    }
    
    const userToken = tokenResponse.data.data.userToken;
    const encryptionKey = tokenResponse.data.data.encryptionKey;
    
    console.log('✅ UserToken acquired:', userToken.substring(0, 20) + '...');
    
    res.json({
      success: true,
      data: {
        userToken: userToken,
        encryptionKey: encryptionKey,
        userId: userId
      }
    });
  } catch (error) {
    console.error('Failed to get userToken:', error.response?.data);
    res.status(error.response?.status || 500).json(
      handleCircleApiError(error, 'get userToken')
    );
  }
});

// 10. Get Challenge Status
app.get('/api/circle/challenges/:challengeId', async (req, res) => {
  try {
    const { challengeId } = req.params;
    
    console.log('Getting challenge status:', challengeId);
    
    const response = await axios.get(
      `${CIRCLE_API_BASE}/challenges/${challengeId}`,
      { headers: getCircleHeaders() }
    );

    console.log('Challenge status retrieved:', response.data);
    
    res.json({
      success: true,
      data: response.data.data,
    });
  } catch (error) {
    console.error('Failed to get challenge status:', error.response?.data);
    res.status(error.response?.status || 500).json(
      handleCircleApiError(error, 'get challenge status')
    );
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Circle Wallet Backend running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Circle API Base: ${CIRCLE_API_BASE}`);
  console.log(`🔑 Circle App ID: ${CIRCLE_APP_ID ? 'Configured' : 'Missing'}`);
  console.log(`🔐 Circle API Key: ${CIRCLE_API_KEY ? 'Configured' : 'Missing'}`);
  
  // Debug: Show first few characters of API key
  if (CIRCLE_API_KEY) {
    console.log(`🔍 API Key Preview: ${CIRCLE_API_KEY.substring(0, 20)}...`);
  }
});
