# Movement Network Testing Guide

## Prerequisites
- ✅ Backend deployed and running at `https://api.ctomarketplace.com`
- ✅ Database migration completed (MOVEMENT enum added)
- ✅ Frontend running at `http://localhost:3000`
- ✅ Privy App ID configured in `.env.development.local`

## Testing Steps

### 1. Test Movement Wallet Creation

**Step 1: Login with Privy**
1. Navigate to `http://localhost:3000/login`
2. Login using any method (email, Google, Twitter, etc.)
3. After successful login, check the browser console for:
   ```
   🔄 Creating Movement wallet...
   ✅ Movement wallet created: { address: '0x...', ... }
   ```

**Step 2: Verify Wallet Creation**
- Check browser console for success messages
- The wallet should be created automatically after Privy login
- If wallet already exists, you'll see: `✅ Movement wallet already exists: 0x...`

### 2. Verify Backend Sync

**Step 1: Check Backend API Response**
1. Open browser DevTools → Network tab
2. Look for API call to `/api/auth/privy/sync` or `/api/auth/privy/wallets`
3. Verify the response includes:
   ```json
   {
     "wallets": [
       {
         "address": "0x...",
         "blockchain": "MOVEMENT",
         "type": "PRIVY_EMBEDDED"
       }
     ]
   }
   ```

**Step 2: Check Console Logs**
- Look for: `✅ Synced with backend successfully`
- Check for any error messages

### 3. Verify Database Entry

**Step 1: Connect to Coolify Postgres Terminal**
1. Go to Coolify → PostgreSQL database → Terminal
2. Connect: `psql -U postgres -d postgres`

**Step 2: Check Wallet Entry**
```sql
-- Check if wallet was saved with MOVEMENT blockchain
SELECT id, address, blockchain, type, "userId" 
FROM "Wallet" 
WHERE blockchain = 'MOVEMENT' 
ORDER BY "createdAt" DESC 
LIMIT 5;
```

**Expected Result:**
- Should see your wallet address
- `blockchain` column should show `MOVEMENT`
- `type` should show `PRIVY_EMBEDDED`

**Step 3: Check User-Wallet Relationship**
```sql
-- Verify user has the wallet linked
SELECT u.email, w.address, w.blockchain, w.type
FROM "User" u
JOIN "Wallet" w ON w."userId" = u.id
WHERE w.blockchain = 'MOVEMENT'
ORDER BY w."createdAt" DESC
LIMIT 5;
```

### 4. Test Wallet Functionality

**Step 1: Check Wallet Balance**
1. After login, navigate to Profile page
2. Look for Movement wallet section
3. Check if wallet address is displayed
4. Verify balance shows (may be 0 if new wallet)

**Step 2: Test Transaction Signing (if implemented)**
- If you have transaction signing functionality, test it
- Check console for any errors

### 5. Test Multiple Wallets

**Test Case: Multiple Login Sessions**
1. Login with a different account
2. Verify a new Movement wallet is created
3. Check database to confirm both wallets exist
4. Verify each wallet is linked to the correct user

### 6. Error Scenarios

**Test Case: Wallet Creation Failure**
1. Temporarily break Privy connection
2. Try to login
3. Verify error handling shows user-friendly message
4. Check console for error logs

**Test Case: Backend Sync Failure**
1. Temporarily stop backend
2. Login and create wallet
3. Verify frontend handles error gracefully
4. Check for retry logic or error messages

## Expected Console Output

### Successful Flow:
```
🔄 Creating Movement wallet...
✅ Movement wallet created: { address: '0x...', ... }
✅ Movement wallet already exists: 0x...
🔄 Syncing with backend...
✅ Synced with backend successfully
```

### Error Flow:
```
❌ Failed to create Movement wallet: [error message]
⚠️ Wallet creation failed: [error]
🔄 Retrying backend sync...
```

## Verification Checklist

- [ ] Movement wallet created automatically after Privy login
- [ ] Wallet address displayed in Profile page
- [ ] Backend API receives wallet data
- [ ] Database entry created with `blockchain = 'MOVEMENT'`
- [ ] Wallet linked to correct user
- [ ] No console errors during wallet creation
- [ ] Error handling works if wallet creation fails

## Troubleshooting

### Issue: Wallet not created
- **Check**: Privy App ID is configured correctly
- **Check**: Movement Network is enabled in Privy Console
- **Check**: Browser console for Privy errors

### Issue: Backend sync fails
- **Check**: Backend is running at `https://api.ctomarketplace.com`
- **Check**: CORS is configured correctly
- **Check**: Network tab for API errors

### Issue: Database entry missing
- **Check**: Database migration was completed
- **Check**: Backend logs for database errors
- **Check**: Wallet sync endpoint is working

## Next Steps After Testing

1. **If all tests pass**: 
   - Document any issues found
   - Test with production backend
   - Prepare for deployment

2. **If tests fail**:
   - Check error logs
   - Verify configuration
   - Review implementation against reference code


