# Setup Local Environment for Testing

## ⚠️ IMPORTANT: Create .env file for Frontend

The frontend is currently pointing to **production** (`https://api.ctomarketplace.com`). 

You need to create a `.env` file in `cto-frontend-old-fresh/` with:

```env
# Backend URL - Point to localhost for local testing
REACT_APP_BACKEND_URL=http://localhost:3001

# Circle Programmable Wallets Configuration
REACT_APP_CIRCLE_API_KEY=TEST_API_KEY:da4473a762c09430aa795c2269e993f7:4bb214206ac0fe0f3416f18d973d1ed4
REACT_APP_CIRCLE_ENVIRONMENT=sandbox
REACT_APP_CIRCLE_API_BASE=https://api.circle.com/v1/w3s

# Aptos Blockchain Configuration
REACT_APP_APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1
REACT_APP_APTOS_NETWORK=testnet

# Privy Configuration
REACT_APP_PRIVY_APP_ID=cmgv7721s00s3l70cpci2e2sa
```

## Quick Setup Commands

### 1. Create Frontend .env File
```powershell
cd cto-frontend-old-fresh
# Create .env file with the content above
```

### 2. Start Backend
```powershell
cd cto-backend-old-fresh
$env:DATABASE_URL="postgresql://postgres:PHYSICS1234@localhost:5432/cto_db?schema=public"
npm run dev
```

### 3. Start Frontend (in new terminal)
```powershell
cd cto-frontend-old-fresh
npm start
```

## Verify Backend URL

After creating `.env`, the frontend will use `http://localhost:3001` instead of production.

You can verify by checking:
- Browser console logs
- Network tab (should show requests to `localhost:3001`)

