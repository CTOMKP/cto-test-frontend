# CTO Marketplace - Circle Programmable Wallet Integration

A complete React application demonstrating Circle Programmable Wallets integration with the Aptos blockchain for the CTO Marketplace platform.

## 🚀 Features

### Authentication System
- **User Registration**: Email/password signup with automatic Circle wallet creation
- **User Login**: Secure authentication with session management
- **Protected Routes**: Route protection based on authentication status

### Circle Wallet Integration
- **User-Controlled Wallets**: Automatic wallet creation upon signup
- **Aptos Blockchain**: Configured specifically for Aptos network
- **Balance Management**: Real-time balance display for APT and USDC
- **QR Code Generation**: Easy wallet funding with scannable QR codes

### Wallet Operations
- **Fund Withdrawal**: Send funds to external Aptos addresses
- **Transaction History**: Track all wallet transactions
- **Address Management**: Copy wallet addresses with one click
- **Security Features**: User-controlled wallet with secure key management

### User Experience
- **Modern UI**: Clean, responsive design with Tailwind CSS
- **Mobile Responsive**: Optimized for all device sizes
- **Loading States**: Smooth loading animations and feedback
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Toast Notifications**: Real-time feedback for all operations

## 🛠️ Tech Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React Context API with custom hooks
- **Routing**: React Router v6 with protected routes
- **Form Handling**: React Hook Form with validation
- **Notifications**: React Hot Toast
- **Blockchain**: Aptos SDK integration
- **Wallet Service**: Circle Programmable Wallets SDK
- **HTTP Client**: Axios for API communication
- **Build Tool**: Webpack with hot reload

## 📋 Prerequisites

- Node.js 16+ and npm
- Circle developer account with API keys
- Aptos blockchain access (mainnet or testnet)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd CTO-CircleWallet
npm install
```

### 2. Environment Configuration

Copy the environment example file and configure your API keys:

```bash
cp env.example .env
```

Edit `.env` with your actual values:

```bash
# Circle Programmable Wallets Configuration
REACT_APP_CIRCLE_APP_ID=your_circle_app_id_here
REACT_APP_CIRCLE_API_KEY=your_circle_api_key_here
REACT_APP_CIRCLE_ENVIRONMENT=sandbox
REACT_APP_CIRCLE_API_BASE=https://api-sandbox.circle.com

# Aptos Blockchain Configuration
REACT_APP_APTOS_NODE_URL=https://fullnode.mainnet.aptoslabs.com/v1
REACT_APP_APTOS_NETWORK=mainnet

# Authentication API Configuration
REACT_APP_AUTH_API_BASE=http://localhost:3001
```

### 3. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### 4. Build for Production

```bash
npm run build
```

## �� Configuration

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Circle Programmable Wallets Configuration
REACT_APP_CIRCLE_APP_ID=your_circle_app_id_here
REACT_APP_CIRCLE_API_KEY=your_circle_api_key_here
REACT_APP_CIRCLE_ENVIRONMENT=sandbox
REACT_APP_CIRCLE_API_BASE=https://api-sandbox.circle.com

# Aptos Blockchain Configuration
REACT_APP_APTOS_NODE_URL=https://fullnode.mainnet.aptoslabs.com/v1
REACT_APP_APTOS_NETWORK=mainnet

# Authentication API Configuration
REACT_APP_AUTH_API_BASE=http://localhost:3001
```

### Circle Wallet Setup

1. **App ID**: This is your unique Circle application identifier for User Controlled Wallets
2. **API Key**: This is your backend authentication key for Circle API requests
3. **Environment**: Use `sandbox` for testing, `production` for live deployment
4. **API Base**: The Circle API endpoint (sandbox or production)

**Note**: Both the App ID and API Key are required for production Circle Wallet integration. If either is missing, the application will fall back to mock services for development purposes.

### Aptos Configuration

- **Mainnet**: Use `https://fullnode.mainnet.aptoslabs.com/v1`
- **Testnet**: Use `https://fullnode.testnet.aptoslabs.com/v1`
- **Devnet**: Use `https://fullnode.devnet.aptoslabs.com/v1`

## 📱 Usage

### Demo Credentials

For testing purposes, use these demo credentials:
- **Email**: `test@example.com`
- **Password**: `Password123`

### User Flow

1. **Sign Up**: Create account and automatically get a Circle wallet
2. **Wallet Creation**: System creates user-controlled wallet on Aptos
3. **Funding**: QR code modal appears for easy wallet funding
4. **Profile Management**: View balances, wallet info, and manage funds
5. **Withdrawals**: Send funds to external Aptos addresses

## 🏗️ Project Structure

```
src/
├── components/
│   ├── Auth/
│   │   ├── SignUpForm.tsx      # User registration with wallet creation
│   │   └── LoginForm.tsx       # User authentication
│   ├── Wallet/
│   │   ├── QRCodeDisplay.tsx   # QR code generation for funding
│   │   └── WithdrawModal.tsx   # Fund withdrawal interface
│   └── Profile/
│       ├── ProfilePage.tsx     # Main profile dashboard
│       ├── BalanceSection.tsx  # Balance display and management
│       └── WalletInfo.tsx      # Wallet details and information
├── hooks/
│   ├── useAuth.ts              # Authentication state management
│   └── useCircleWallet.ts      # Circle wallet operations
├── services/
│   ├── authService.ts          # Authentication API calls
│   ├── circleWallet.ts         # Circle wallet API integration
│   └── aptosService.ts         # Aptos blockchain operations
├── types/
│   ├── auth.types.ts           # Authentication type definitions
│   └── wallet.types.ts         # Wallet and blockchain types
├── utils/
│   ├── constants.ts            # Application constants
│   └── helpers.ts              # Utility functions
├── App.tsx                     # Main application component
└── index.tsx                   # Application entry point
```

## 🔐 Security Features

- **No Private Key Storage**: Private keys are never stored locally
- **Secure Authentication**: JWT-based session management
- **Input Validation**: Comprehensive form validation and sanitization
- **Error Boundaries**: Graceful error handling without exposing sensitive data
- **HTTPS Enforcement**: All API calls use secure connections

## 🧪 Testing

### Manual Testing Checklist

- [ ] User registration flow
- [ ] Circle wallet creation
- [ ] QR code generation and display
- [ ] Balance fetching and display
- [ ] Fund withdrawal process
- [ ] Error handling scenarios
- [ ] Mobile responsiveness
- [ ] Authentication flow

### Test Scenarios

1. **New User Journey**
   - Sign up → Wallet creation → Funding modal → Profile page

2. **Returning User Journey**
   - Login → Profile page → Balance refresh → Withdrawal

3. **Error Scenarios**
   - Invalid credentials
   - Network failures
   - Invalid addresses
   - Insufficient funds

## 🚀 Deployment

### Production Build

```bash
npm run build
```

### Environment Variables

Ensure all production environment variables are properly set:
- Circle API keys
- Aptos node URLs
- Authentication endpoints

### CORS Configuration

Configure your Circle API endpoints to allow requests from your domain.

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production build

### Mock Services

The application includes mock services for development:
- Mock authentication (demo credentials)
- Mock wallet creation
- Mock balance data
- Mock transaction processing

### Adding New Features

1. **New Components**: Add to appropriate directory in `src/components/`
2. **New Services**: Create in `src/services/` and add types
3. **New Hooks**: Add to `src/hooks/` for reusable logic
4. **New Types**: Extend existing type files or create new ones

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For issues and questions:
1. Check the documentation
2. Review existing issues
3. Create a new issue with detailed information

## 🔮 Roadmap

- [ ] Transaction history display
- [ ] Multiple asset support
- [ ] Wallet backup/recovery
- [ ] Dark/light mode toggle
- [ ] Advanced security features
- [ ] Mobile app version
- [ ] Integration with more blockchains

---

**Built with ❤️ for the CTO Marketplace platform**
