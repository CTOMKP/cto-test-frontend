# 🧪 Testing Guide - CTO Marketplace Mini App

## 🚀 Getting Started

### 1. Start the Backend
```bash
cd cto-backend
npm run dev
```
Backend runs on: `http://localhost:3001`

### 2. Start the Frontend
```bash
cd cto-frontend
npm install
npm run dev
```
Frontend runs on: `http://localhost:3000`

---

## ✅ Testing Checklist

### **Phase 1: User Registration & Wallet Setup**

1. **Register a New User**
   - Go to `http://localhost:3000/signup`
   - Create account
   - ✅ **Expected:** User created, Circle wallet created automatically

2. **Login**
   - Go to `http://localhost:3000/login`
   - Login with your credentials
   - ✅ **Expected:** Redirect to profile page

3. **Check Wallet**
   - Go to Profile page
   - View wallet balance
   - ✅ **Expected:** See USDC and APT balances (should be 0)

---

### **Phase 2: Fund Your Wallet**

4. **Get Wallet Address**
   - In Profile, copy your wallet address
   - ✅ **Expected:** Aptos wallet address visible

5. **Fund with Test USDC** (Options)
   
   **Option A: Use Circle Faucet**
   - Go to Circle's testnet faucet
   - Request test USDC
   - Send to your wallet address

   **Option B: Use Aptos Testnet Faucet**
   - Go to Aptos faucet
   - Get test APT
   - Use Swap feature to swap APT for USDC

6. **Verify Balance**
   - Refresh profile page
   - ✅ **Expected:** See USDC balance updated

---

### **Phase 3: Create and Pay for Listing**

7. **Create a Listing**
   - Go to "Create Listing" (`/user-listings/create`)
   - Enter Solana contract address (use a real token from Solscan)
   - Example: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (USDC)
   - Complete all steps
   - ✅ **Expected:** Listing created with status "DRAFT"

8. **View Your Listings**
   - Go to "My Listings" (`/user-listings/mine`)
   - ✅ **Expected:** See your DRAFT listing with "Pay $50 to Publish" button

9. **Pay for Listing** 🆕
   - Click "Pay $50 to Publish" button
   - Review payment details
   - Click "Pay 50 USDC"
   - ✅ **Expected:** 
     - Payment initiated message
     - Payment ID displayed
     - Blockchain confirmation pending

10. **Verify Payment** 🆕
    - Wait 10 seconds (auto-verify runs)
    - OR click "Check Payment Status" manually
    - ✅ **Expected:**
      - Payment status changes to "COMPLETED"
      - Listing status changes to "PUBLISHED"
      - Success message shown

---

### **Phase 4: Withdraw USDC** 🆕

11. **Withdraw Funds**
    - Go to Profile > Withdraw Section
    - Enter destination address (your external Aptos wallet)
    - Enter amount to withdraw
    - Click "Withdraw"
    - ✅ **Expected:**
      - Balance check performed
      - Withdrawal initiated
      - Transaction ID provided
      - Funds transferred to external wallet

---

### **Phase 5: Token Swap** (Already Implemented)

12. **Swap Tokens**
    - Go to `/swap`
    - Select tokens (USDC ↔ APT)
    - Enter amount
    - Execute swap
    - ✅ **Expected:** Swap completed, balance updated

---

### **Phase 6: Admin Dashboard** 🆕

13. **Make Your User an Admin**
    ```bash
    cd cto-backend
    npx prisma studio
    ```
    - Open User table
    - Find your user
    - Change `role` to "ADMIN"
    - Save

14. **Access Admin Dashboard**
    - Go to `/admin`
    - ✅ **Expected:** See admin dashboard with:
      - Statistics (users, listings, revenue, boosts)
      - Pending listings tab
      - Payments tab
      - Ad boosts tab

15. **Test Admin Approval**
    - Create a second test account
    - Create a listing with that account
    - Pay for the listing
    - Login as admin
    - Go to Admin Dashboard > Pending Listings
    - Click "Approve" or "Reject"
    - ✅ **Expected:**
      - Listing status updated
      - Listing appears in published/rejected section

---

### **Phase 7: Payment History**

16. **View Payment History**
    - In Profile, check transaction history
    - ✅ **Expected:** See all payments (listings, withdrawals)

---

## 🐛 Troubleshooting

### Issue: "Insufficient balance"
**Solution:** Fund your wallet with at least 60 USDC (50 for listing + gas fees)

### Issue: "Payment stuck at PENDING"
**Solution:** 
- Circle testnet can be slow (5-15 minutes)
- Click "Check Payment Status" button
- Wait and try again

### Issue: "Admin dashboard shows 401"
**Solution:** 
- Ensure your user role is set to "ADMIN" in database
- Logout and login again

### Issue: "Wallet not found"
**Solution:**
- Ensure you completed signup fully
- Check if wallet was created in Profile page
- Try creating wallet again

---

## 📊 Test Data

### Sample Solana Tokens (for testing listings)
```
USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
SOL: So11111111111111111111111111111111111111112
BONK: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
WIF: EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm
```

### Test Scenarios

#### Scenario 1: Happy Path
1. Register → 2. Fund wallet → 3. Create listing → 4. Pay for listing → 5. Listing published

#### Scenario 2: Admin Approval
1. Create listing → 2. Pay for listing → 3. Admin approves → 4. Listing visible on marketplace

#### Scenario 3: Withdrawal
1. Have balance → 2. Withdraw to external wallet → 3. Verify on blockchain explorer

---

## 🎯 New Features to Test

### ✅ **1. Withdraw USDC** (MVP Requirement #2)
- Test withdrawing USDC to external wallet
- Verify balance deduction
- Check transaction on Aptos explorer

### ✅ **2. Listing Payment** (MVP Requirement #3)
- Create listing
- Pay 50 USDC
- Verify payment processing
- Check listing status changes to PUBLISHED

### ✅ **3. Admin Dashboard** (MVP Requirement #5)
- View dashboard statistics
- Approve/reject pending listings
- View payment history
- Monitor active ad boosts

---

## 📝 Notes

- **IMPORTANT:** Make sure `PLATFORM_WALLET_ADDRESS` is set in backend `.env`
- Backend must be running for all API calls
- Circle testnet transactions can take 5-15 minutes
- Admin features require ADMIN role in database

---

## ✨ Success Criteria

**All features working if:**
- ✅ User can register and create wallet
- ✅ User can fund wallet with USDC
- ✅ User can create and pay for listing (50 USDC)
- ✅ Payment completes and listing is published
- ✅ User can withdraw USDC to external wallet
- ✅ Admin can view dashboard
- ✅ Admin can approve/reject listings
- ✅ Transaction history is visible

**Ready for hackathon demo! 🚀**

