# Hyperliquid Trading Interface

A simple trading interface for Hyperliquid that supports Market, Limit, Scale, and TWAP orders with leverage and margin mode controls.

## Features

- **Order Types**: Market, Limit, Scale, TWAP orders
- **Leverage Control**: Update leverage up to 9x
- **Margin Modes**: Switch between Isolated and Cross margin
- **Take Profit/Stop Loss**: Support for TP/SL orders
- **Real-time Data**: Account balance, position, and liquidation price
- **Dark Theme**: Matches Hyperliquid's trading interface design

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **SDK**: Hyperliquid SDK by nomeida
- **Build Tool**: Vite

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Private Key

Edit `src/config/config.ts` and replace the placeholder private key with your actual wallet private key:

```typescript
export const CONFIG = {
  // Replace with your actual private key
  PRIVATE_KEY: "0xYOUR_PRIVATE_KEY_HERE",
  
  // Use testnet for development
  USE_TESTNET: true,
  
  // Other configuration...
}
```

**⚠️ Important Security Notes:**
- Never commit your private key to version control
- Use testnet for development and testing
- For production, use environment variables or secure key management

### 3. Development Mode

The application currently uses a **mock SDK** for development due to Vite compatibility issues with the Hyperliquid package. This allows you to:

- Test the UI and user interactions
- See all the trading interface features
- Verify the order flow and state management

**To use the real SDK:**
1. The mock will be replaced with the actual Hyperliquid SDK
2. All trading operations will connect to the real Hyperliquid network
3. You'll need to provide a valid private key for authentication

### 4. Get Testnet Tokens

For development, you can get testnet tokens from the project maintainer or use the Hyperliquid testnet faucet.

### 5. Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Usage

### Trading Interface

1. **Select Order Type**: Choose between Market, Limit, Scale, or TWAP
2. **Set Side**: Choose Buy/Long or Sell/Short
3. **Enter Size**: Input order size in USD or BTC
4. **Configure Options**:
   - Set leverage (up to 9x)
   - Choose margin mode (Isolated/Cross)
   - Enable Reduce Only if needed
   - Set Take Profit/Stop Loss prices
5. **Submit Order**: Click "Enable Trading" to place the order

### Supported Order Types

- **Market Orders**: Execute immediately at current market price
- **Limit Orders**: Execute at specified price or better
- **Scale Orders**: Place multiple orders at different price levels
- **TWAP Orders**: Execute orders over time to reduce market impact

### Leverage and Margin

- **Leverage**: Adjust leverage from 1x to 9x
- **Margin Mode**: 
  - **Isolated**: Risk is limited to the specific position
  - **Cross**: Uses entire account balance as collateral

## API Integration

The application uses the [Hyperliquid SDK](https://github.com/nomeida/hyperliquid) for all trading operations:

- Order placement and management
- Leverage and margin updates
- Account information retrieval
- Real-time position tracking

## Development

### Project Structure

```
src/
├── components/
│   └── TradingInterface.tsx    # Main trading interface
├── hooks/
│   └── useTrading.ts          # Trading logic and state management
├── services/
│   └── hyperliquidService.ts  # SDK integration service
├── config/
│   └── config.ts              # Configuration and constants
└── App.tsx                    # Main application component
```

### Key Components

- **TradingInterface**: Main UI component matching Hyperliquid's design
- **useTrading**: Custom hook managing trading state and SDK operations
- **hyperliquidService**: Service layer for SDK integration
- **config**: Configuration management for private keys and settings

## Testing

1. **Testnet Testing**: Use testnet for all development and initial testing
2. **Mainnet Testing**: Only test on mainnet with small amounts
3. **Order Verification**: Check orders on [Hyperliquid Explorer](https://app.hyperliquid.xyz/explorer)

## Safety Considerations

- Always test on testnet first
- Start with small amounts on mainnet
- Verify all orders before submission
- Monitor positions and liquidation prices
- Use appropriate risk management

## Troubleshooting

### Common Issues

1. **SDK Initialization Failed**
   - Check private key format (must be 64 hex characters with 0x prefix)
   - Ensure network connectivity
   - Verify testnet/mainnet configuration

2. **Order Submission Failed**
   - Check account balance
   - Verify order parameters
   - Ensure sufficient margin

3. **Leverage Update Failed**
   - Check current position size
   - Verify margin requirements
   - Ensure account has sufficient balance

### Debug Mode

Enable debug logging by opening browser developer tools and checking the console for detailed error messages.

## License

MIT License

## Disclaimer

This is a demonstration project for educational purposes. Trading cryptocurrencies involves significant risk. Always do your own research and never trade with money you cannot afford to lose.
