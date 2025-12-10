# Wallet Sign-In Testing Guide

## ✅ Current Status
- Movement wallet creation: **WORKING** ✅
- Backend sync: **WORKING** ✅
- Database storage: **NEEDS VERIFICATION**

## Step 1: Verify Database Entry

**In Coolify Postgres Terminal:**
```sql
psql -U postgres -d postgres

-- Check MOVEMENT wallets
SELECT id, address, blockchain, type, "userId", "createdAt" 
FROM "Wallet" 
WHERE blockchain = 'MOVEMENT' 
ORDER BY "createdAt" DESC 
LIMIT 5;

-- Verify user-wallet relationship
SELECT u.email, w.address, w.blockchain, w.type
FROM "User" u
JOIN "Wallet" w ON w."userId" = u.id
WHERE w.blockchain = 'MOVEMENT'
ORDER BY w."createdAt" DESC
LIMIT 5;
```

**Expected Result:**
- Your wallet address: `0x6d0f1710e278f4d0293b866b60c0595a0fa8726920b6a48ce2bc5644c505a3b2`
- `blockchain` = `MOVEMENT`
- `type` = `PRIVY_EMBEDDED`

## Step 2: Test Wallet Sign-In Flow

### Test Case 1: Fresh Login with Wallet Option

1. **Logout** from current session (click Logout button)

2. **Clear browser data** (optional but recommended):
   - Open DevTools (F12)
   - Application tab → Clear storage → Clear site data

3. **Navigate to login page**: `http://localhost:3000/login`

4. **Click "🔐 Login with Privy"**

5. **Privy modal should show** with these options:
   - 📧 Email
   - 🔗 Wallet (MetaMask, Coinbase Wallet, etc.)
   - 🌐 Google
   - 🐦 Twitter
   - 💬 Discord

6. **Select "Wallet" option**

7. **Choose a wallet**:
   - **MetaMask** (if installed)
   - **Coinbase Wallet** (if installed)
   - **Privy Embedded Wallet** (creates new wallet)

8. **Complete wallet connection**:
   - Approve connection in wallet extension
   - Sign message if prompted

9. **Expected Flow**:
   - ✅ Privy authenticates
   - ✅ Movement wallet created automatically
   - ✅ Backend sync happens
   - ✅ Redirected to profile page
   - ✅ See both Ethereum and Movement wallets

### Test Case 2: Sign-In with Existing Wallet

1. **Use a wallet you've connected before** (e.g., MetaMask)

2. **Click "Login with Privy" → "Wallet" → Select your wallet**

3. **Expected**:
   - ✅ Quick authentication (no new wallet creation)
   - ✅ Backend sync
   - ✅ Redirected to profile
   - ✅ See existing wallets

### Test Case 3: Multiple Wallet Connections

1. **After logging in**, go to Profile page

2. **Check if you can connect additional wallets**:
   - Look for "Connect Wallet" button
   - Try connecting a different wallet (e.g., if you used MetaMask, try Coinbase)

3. **Expected**:
   - ✅ New wallet appears in wallet list
   - ✅ Backend syncs new wallet
   - ✅ Database shows multiple wallets for same user

## Step 3: Verify Console Logs

**Open Browser DevTools → Console** and look for:

### Successful Flow:
```
🔄 Starting OAuth login...
✅ Movement wallet created: { address: '0x...', ... }
🔄 Syncing Privy user with backend...
✅ Backend sync successful: { success: true, ... }
💼 Saved wallets to localStorage: [...]
```

### Wallet Sign-In Specific:
```
🔗 Connecting wallet...
✅ Wallet connected: 0x...
🔄 Creating Movement wallet...
✅ Movement wallet created
```

## Step 4: Verify Network Requests

**Open DevTools → Network tab** and check:

1. **Privy API calls**:
   - `auth.privy.io` - Authentication
   - Should return 200 OK

2. **Backend sync**:
   - `POST /api/auth/privy/sync`
   - Status: 200
   - Response includes: `{ success: true, wallets: [...] }`

3. **Wallet data**:
   - Check response includes Movement wallet
   - `blockchain: "MOVEMENT"` in wallet objects

## Step 5: Database Verification After Wallet Sign-In

**After completing wallet sign-in**, run:

```sql
-- Check latest wallet entries
SELECT 
  w.id,
  w.address,
  w.blockchain,
  w.type,
  u.email,
  w."createdAt"
FROM "Wallet" w
JOIN "User" u ON w."userId" = u.id
ORDER BY w."createdAt" DESC
LIMIT 10;
```

**Expected**:
- New wallet entry with `blockchain = 'MOVEMENT'`
- Linked to your user account
- `type = 'PRIVY_EMBEDDED'` or `'EXTERNAL'` depending on wallet type

## Troubleshooting

### Issue: Wallet option not showing in Privy modal
- **Check**: `loginMethods` includes `'wallet'` in `App.tsx`
- **Fix**: Already configured ✅

### Issue: Wallet connection fails
- **Check**: Wallet extension is installed and unlocked
- **Check**: Browser console for Privy errors
- **Check**: Network tab for failed API calls

### Issue: Movement wallet not created after wallet sign-in
- **Check**: Console for `🔄 Creating Movement wallet...`
- **Check**: User already has Movement wallet (check `getMovementWallet`)
- **Fix**: Code should skip creation if wallet exists ✅

### Issue: Backend sync fails
- **Check**: Backend is running at `https://api.ctomarketplace.com`
- **Check**: CORS is configured correctly
- **Check**: Network tab for sync endpoint errors

## Success Criteria

✅ **Wallet sign-in works if:**
1. Privy modal shows "Wallet" option
2. User can connect external wallet (MetaMask, etc.)
3. Authentication succeeds
4. Movement wallet is created/verified
5. Backend sync completes
6. User redirected to profile
7. Database shows wallet with `MOVEMENT` blockchain
8. Profile page displays both wallets

## Next Steps After Testing

1. **If all tests pass**: Document any edge cases found
2. **If tests fail**: Note specific error messages and steps to reproduce
3. **Performance**: Note any delays or timeouts
4. **UX**: Note any confusing UI elements or flows


