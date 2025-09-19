# Hyperliquid Trading Interface

A simple trading interface for Hyperliquid that supports Market, Limit, Scale, and TWAP orders with advanced leverage and margin mode controls, real-time price updates, and sophisticated order management.

## 🖼️ Interface Preview

Here's what the trading interface looks like:

![Hyperliquid Trading Interface](ScreenshotUI.png)

*The interface features a dark theme with teal/green accents, showing Margin Mode (Cross), Leverage control (9x with risk indicator), Market/Limit order selection, Buy/Sell buttons, and comprehensive order parameters.*

## 📹 Demo Videos

Watch these demonstration videos to understand the functionality:

- **[Market Order Demo](https://www.loom.com/share/47cff0dc410b4dcc86b35a1323d59077?sid=a79e74a0-07de-46c6-95a8-24ba1c8c859f)** - See how to execute orders immediately at current market price

- **[Limit Order Demo](https://www.loom.com/share/8392967a459e47fea42ba7a4d8c1fbc4?sid=dca3765e-0c26-4b68-ac4d-11dc3c2a3f4c)** - Understand how to place orders at specific price levels

- **[TWAP Order Demo](https://www.loom.com/share/f113a7fc83764f188b9828587bd3aaf6?sid=4f8c6cbf-881f-4cd3-9fbd-d8a99e0e269c)** - See how to execute orders over time to reduce market impact

- **[Scale Order Demo](https://www.loom.com/share/5feaa6e04e904bc5bd75d53d2f387994?sid=c364f19f-f0f5-46b6-bb41-9dafb2a5d4b6)** - Learn how to place multiple orders at different price levels with size skew

## 🔄 Recent Updates

- **[Precision & Decimal Fix Demo](https://drive.google.com/file/d/1jZEvcNyBDtyQbFbmB4gEG_Gkl6RDAIIf/view?usp=drive_link)** - See the latest improvements for price and size decimal precision handling



### Precision & Decimal Handling Improvements
- **Enhanced Price Precision**: Implemented proper `pxDecimals` validation for all order types
- **Size Decimal Validation**: Added `szDecimals` support with dynamic precision from API metadata
- **Smart Error Messages**: Improved validation feedback with specific error messages for different coins
- **DOGE Coin Support**: Fixed integer-only validation for DOGE (szDecimals: 0)
- **Scale Order Precision**: Enhanced sub-order price and size calculations with proper decimal handling
- **TWAP Order Improvements**: Updated sub-order size distribution using dynamic `szDecimals`
- **Current Position Display**: Fixed position size formatting to use correct decimal precision
- **Input Validation**: Added real-time validation for all 4 order types with disabled submit buttons for invalid inputs

## ✨ Features

- **Order Types**: Market, Limit, Scale, TWAP orders with advanced validation
- **Leverage Control**: Dynamic leverage updates up to 10x with risk indicators
- **Margin Modes**: Switch between Isolated and Cross margin
- **Real-time Data**: Live price feeds, account balance, and position tracking
- **Advanced UI**: Dark theme, toast notifications, responsive design
- **Security**: Environment variable configuration for private keys

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Modern web browser

### 1. Install Dependencies
```bash
git clone <repository-url>
cd hyperliquid-minidemo
npm install
```

### 2. Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit your private key
nano .env
```

Set your private key in `.env`:
```env
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
USE_TESTNET=true
DEFAULT_COIN=BTC-PERP
```

### 3. Run the Application

This application requires both a backend server and a frontend development server to run properly.

#### Start Backend Server
```bash
# Start the backend server (Node.js)
node server-new.js

# The backend API will be available at:
# http://localhost:3000
```

#### Start Frontend Development Server
```bash
# In a new terminal, start the frontend development server
npm run dev

# The frontend application will be available at:
# http://localhost:5173
```

#### Complete Setup
You need to run both servers simultaneously:
1. **Terminal 1**: Run `node server-new.js` (Backend API)
2. **Terminal 2**: Run `npm run dev` (Frontend React app)

The frontend will communicate with the backend API to handle trading operations.

### 4. Run Tests (Optional)
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

## 📚 Documentation

- **[Environment Variables Setup](ENV_SETUP.md)** - Complete setup guide
- **[Test Coverage Report](src/__tests__/TEST_COVERAGE_REPORT.md)** - Testing details

## 🛠️ Development

### Available Scripts
```bash
# Frontend Development
npm run dev          # Start frontend development server (Vite)
npm run build        # Build frontend for production
npm run preview      # Preview production build
npm test            # Run tests
npm run test:coverage # Run tests with coverage
npm run lint        # Check code quality

# Backend Server
node server-new.js   # Start backend API server (Node.js)
```

### Project Structure
```
src/
├── components/          # React components
├── hooks/              # Custom React hooks
├── services/           # API services
├── config/             # Configuration files
└── __tests__/          # Test files
```

## 🔒 Security

- Never commit private keys to version control
- Always use testnet for development
- Keep your `.env` file secure
- Use environment variables for production

## 📄 License

MIT License

## ⚠️ Disclaimer

This is a demonstration project for educational purposes. Trading cryptocurrencies involves significant risk. Always do your own research and never trade with money you cannot afford to lose.