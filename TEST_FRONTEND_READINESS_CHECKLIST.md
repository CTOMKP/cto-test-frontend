# Test Frontend Readiness Checklist - User Listing Flow

## Status: ✅ READY FOR TESTING

The test frontend (`cto-frontend-old-fresh`) is ready to test the complete user listing creation flow with Movement payment integration.

---

## ✅ Implemented Components

### 1. **Main Wizard Component** ✅
- **File**: `src/components/UserListings/CreateUserListingNew.tsx`
- ✅ 3-step wizard flow orchestration
- ✅ State management for all steps
- ✅ Network selection (9 networks supported)
- ✅ Automatic progression to Step 2 if scan succeeds (risk_score >= 50)
- ✅ Draft ID management with localStorage

### 2. **Step 1: Token Scan** ✅
- **File**: `src/components/UserListings/steps/Step1Scan.tsx`
- ✅ Network selection dropdown
- ✅ Contract address input with paste button
- ✅ Scanning progress animation
- ✅ Results display with tier, risk score, metadata
- ✅ **Risk score validation: Blocks if score < 50**
- ✅ Error messages for low scores
- ✅ Passes contract address to parent

### 3. **Step 2: Listing Details** ✅
- **File**: `src/components/UserListings/steps/Step2Details.tsx`
- ✅ Logo upload (1:1 ratio, min 400x400px)
- ✅ Banner upload (3:1 ratio, min 600px width)
- ✅ Title, Description, Bio fields
- ✅ Social links (Twitter, Telegram, Website, Discord)
- ✅ Presigned S3 upload implementation
- ✅ Draft creation/update logic
- ✅ Validation for required fields

### 4. **Step 3: Roadmap & Payment** ✅
- **File**: `src/components/UserListings/steps/Step3Roadmap.tsx`
- ✅ Roadmap title, description, additional links
- ✅ **Complete Movement payment integration**
- ✅ Automatic payment flow initiation
- ✅ Payment verification
- ✅ Automatic retry after payment
- ✅ Navigation to "My Listings" on success

### 5. **Movement Payment Service** ✅
- **File**: `src/services/movementPaymentService.ts`
- ✅ `createListingPayment(listingId)` - Creates payment
- ✅ `verifyPayment(paymentId, txHash)` - Verifies payment
- ✅ JWT authentication
- ✅ Handles wrapped backend responses

### 6. **Movement Wallet Utilities** ✅
- **File**: `src/lib/movement-wallet.ts`
- ✅ `getMovementWallet(user)` - Gets Privy Movement wallet
- ✅ `sendMovementTransaction()` - Signs and sends transactions
- ✅ Uses Aptos SDK for transaction building
- ✅ Privy integration with `signRawHash`

### 7. **User Listings Service** ✅
- **File**: `src/services/userListingsService.ts`
- ✅ All endpoints integrated: scan, create, update, publish, mine, delete
- ✅ Proper response unwrapping (TransformInterceptor)
- ✅ TypeScript types match backend DTOs

### 8. **My Listings Page** ✅
- **File**: `src/components/UserListings/MyUserListings.tsx`
- ✅ Lists user's listings
- ✅ Payment button for DRAFT listings
- ✅ Status display (DRAFT, PENDING_APPROVAL, PUBLISHED)
- ✅ Delete functionality

---

## ✅ Payment Flow Implementation

### Complete Movement Payment Flow:

1. **User completes Step 3** → Clicks "Submit Listing"
2. **Backend checks payment** → Returns "Payment required" error
3. **Frontend catches error** → Initiates Movement payment:
   - Creates payment via `movementPaymentService.createListingPayment()`
   - Gets Privy Movement wallet
   - Signs transaction with Privy `signRawHash`
   - Submits to Movement testnet
4. **Payment verification**:
   - Waits 3 seconds
   - Calls `movementPaymentService.verifyPayment()`
5. **Automatic publishing**:
   - Retries `publish()` endpoint
   - Listing status → PENDING_APPROVAL
   - Redirects to "My Listings"

---

## ✅ Risk Score Validation

- **Backend**: `MIN_QUALIFYING_SCORE = 50` ✅
- **Frontend Step1Scan**: Checks `risk_score >= 50` ✅
- **Frontend CreateUserListingNew**: Auto-progresses if score >= 50 ✅
- **Alignment**: ✅ All checks are consistent

---

## ⚙️ Required Environment Variables

Ensure these are set in `.env` or `.env.local`:

```bash
# Backend URL
REACT_APP_BACKEND_URL=http://localhost:3001
# Or for production: https://api.ctomarketplace.com

# Privy Authentication
REACT_APP_PRIVY_APP_ID=your_privy_app_id

# Movement Network (optional, has defaults)
REACT_APP_MOVEMENT_NODE_URL=https://full.testnet.movementinfra.xyz/v1
```

**Note**: Privy configuration is typically done in the Privy dashboard, not via env vars.

---

## 🧪 Testing Checklist

### Prerequisites
- [ ] Backend running on `localhost:3001` (or production URL)
- [ ] User logged in with Privy
- [ ] Movement wallet created (automatic via Privy)
- [ ] Movement wallet funded with test MOV tokens

### Test Flow
- [ ] **Step 1 - Scan**: 
  - [ ] Enter valid Solana contract address
  - [ ] Scan completes successfully
  - [ ] Risk score >= 50: Can proceed to Step 2
  - [ ] Risk score < 50: Blocked with error message

- [ ] **Step 2 - Details**:
  - [ ] Enter title and description (required)
  - [ ] Upload logo and banner (optional)
  - [ ] Add social links (optional)
  - [ ] Draft created successfully
  - [ ] Can proceed to Step 3

- [ ] **Step 3 - Roadmap & Payment**:
  - [ ] Enter roadmap details (optional)
  - [ ] Click "Submit Listing"
  - [ ] Payment flow initiates automatically
  - [ ] Privy prompts for transaction signature
  - [ ] Transaction signed and submitted
  - [ ] Payment verified successfully
  - [ ] Listing published (status: PENDING_APPROVAL)
  - [ ] Redirected to "My Listings"

- [ ] **My Listings Page**:
  - [ ] Listing visible with PENDING_APPROVAL status
  - [ ] Payment button not shown (already paid)
  - [ ] Can view listing details

---

## 🐛 Known Limitations / Notes

1. **GMGN Data Missing**: The backend transformation doesn't have GMGN data (creator info), but this won't block scoring - it will use defaults.

2. **LP Lock Percentage**: Estimated from lock duration (not exact percentage), but scoring still works.

3. **Movement Wallet Funding**: Users need to manually fund Movement wallets with test tokens from faucets (see `MOVEMENT_WALLET_FUNDING_GUIDE.md`).

4. **Tier Names**: Backend now returns lowercase tier names ('stellar', 'bloom', etc.) - frontend should handle this correctly.

---

## 📝 Files Modified for Alignment

### Backend Changes (Not yet pushed):
- ✅ `src/scan/services/scan.service.ts` - Uses Pillar1RiskScoringService
- ✅ `src/scan/scan.module.ts` - Imports TokenVettingModule
- ✅ Data transformation to TokenVettingData format

### Frontend Status:
- ✅ Already using `risk_score >= 50` validation
- ✅ Already has Movement payment integration
- ✅ Already has all 3 steps implemented
- ✅ Already handles draft creation/updates
- ✅ Already handles payment flow

---

## ✅ Conclusion

**The test frontend is READY FOR TESTING!**

All components are implemented and aligned with the backend changes:
- ✅ Risk score validation (>= 50)
- ✅ 3-step wizard flow
- ✅ Movement payment integration
- ✅ Draft management
- ✅ Payment verification
- ✅ Status handling

**Next Steps:**
1. ✅ Backend changes are ready (not yet pushed)
2. ✅ Test frontend is ready
3. 🔄 Test the complete flow end-to-end
4. 🔄 Verify Movement payment works correctly
5. 🔄 Fix any issues found
6. 🔄 Then implement in main frontend

---

## 📚 Related Documentation

- `MOVEMENT_WALLET_FUNDING_GUIDE.md` - How to fund Movement wallets
- `reference/AGENT_HANDOVER_SUMMARY.md` - Implementation details
- `RISK_SCORE_ALIGNMENT_COMPLETE.md` - Backend alignment details
- `USER_LISTING_FLOW_SUMMARY.md` - Complete flow documentation

