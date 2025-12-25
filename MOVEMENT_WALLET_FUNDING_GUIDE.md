# Movement Wallet Funding Guide

## Overview

This guide explains how to fund your Movement wallet with test tokens (MOV) to make payments for user listings and other CTO Marketplace features.

## How to Get Test MOV Tokens

Movement Network uses the native MOV token for payments. Test tokens are available through Movement testnet faucets.

### Option 1: Movement Testnet Faucet (Recommended)

1. **Get Your Movement Wallet Address**
   - Log in to CTO Marketplace
   - Go to your Profile page
   - Find your Movement wallet address (starts with `0x`)
   - Copy the address

2. **Visit Movement Testnet Faucet**
   - Check Movement Network documentation for official testnet faucet URL
   - Common faucet URLs:
     - `https://faucet.movementlabs.xyz` (if available)
     - Check Movement Labs Discord/Telegram for latest faucet links
   
3. **Request Test Tokens**
   - Paste your wallet address
   - Request test MOV tokens
   - Wait for confirmation (usually 1-2 minutes)

### Option 2: Manual Transfer from Admin

If you're testing locally, an admin can manually send test tokens:

1. Admin uses a funded Movement testnet wallet
2. Sends MOV tokens to your wallet address
3. Balance updates automatically (within 5 minutes) or refresh your profile

### Option 3: Third-Party Faucets

Check Movement ecosystem resources:
- Movement Labs Discord
- Movement Network Telegram
- Movement documentation sites

## Checking Your Balance

1. **Via Profile Page**
   - Go to `/profile`
   - Look for Movement wallet section
   - Balance will show in MOV tokens

2. **Via API**
   - Balance is automatically synced every 5 minutes
   - Or manually refresh on profile page

## Payment Requirements

### For User Listings

- **Payment Amount**: Default is 1 MOV (100000000 in smallest unit, 8 decimals)
- **Minimum Balance**: You need at least 1 MOV + small amount for gas fees
- **Recommended**: Keep at least 2-3 MOV tokens for testing

### Payment Flow

1. Create a user listing (scan → details → roadmap)
2. Click "Submit Listing (Payment Required Next)"
3. System automatically initiates Movement payment flow
4. Privy wallet prompts for transaction signature
5. Sign transaction using your Movement wallet
6. Payment is verified automatically
7. Listing status changes to "PENDING_APPROVAL"

## Troubleshooting

### Issue: "No Movement wallet found"

**Solution:**
- Ensure you're logged in with Privy
- Movement wallets are created automatically during Privy login
- Check Profile page to see if Movement wallet exists
- If missing, try logging out and back in

### Issue: "Insufficient balance"

**Solution:**
- Request more test tokens from faucet
- Check your balance on Profile page
- Ensure you have at least 2-3 MOV tokens

### Issue: "Balance not updating"

**Solution:**
- Wait 5 minutes (automatic sync interval)
- Refresh Profile page manually
- Check Movement testnet explorer to verify transaction

### Issue: "Payment stuck at PENDING"

**Solution:**
- Check transaction on Movement testnet explorer
- Verify transaction was confirmed
- Try refreshing payment status
- Contact support if issue persists

## Technical Details

### Token Details

- **Token Name**: MOV (Movement)
- **Decimals**: 8
- **Network**: Movement Testnet
- **Contract**: Native token (no contract address needed)

### Balance Sync

- Automatic sync: Every 5 minutes via cron job
- Manual sync: Refresh Profile page
- API endpoint: `/api/wallet/movement/poll/:walletId`

### Payment Detection

System automatically detects funding by:
1. Comparing old balance vs new balance
2. Recording CREDIT transaction if balance increased
3. Updating database with new balance

## Additional Resources

- Movement Network Documentation: Check official Movement Labs docs
- Movement Testnet Explorer: For verifying transactions
- CTO Marketplace Support: Contact for assistance

## Testing Checklist

- [ ] Movement wallet created (via Privy login)
- [ ] Wallet address visible on Profile page
- [ ] Requested test tokens from faucet
- [ ] Balance updated (check Profile page)
- [ ] Created test listing
- [ ] Initiated payment flow
- [ ] Signed transaction with Privy
- [ ] Payment verified successfully
- [ ] Listing status changed to PENDING_APPROVAL

