// Demo configuration for testing the Hyperliquid trading interface
// This file contains example configurations and helper functions

export const DEMO_CONFIG = {
  // Example private key (DO NOT USE IN PRODUCTION)
  // Replace with your actual private key for testing
  EXAMPLE_PRIVATE_KEY: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  
  // Testnet configuration
  TESTNET_CONFIG: {
    privateKey: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    useTestnet: true,
    defaultCoin: "BTC-PERP",
    defaultLeverage: 1,
    defaultMarginMode: "isolated" as const
  },
  
  // Mainnet configuration (for production testing)
  MAINNET_CONFIG: {
    privateKey: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    useTestnet: false,
    defaultCoin: "BTC-PERP",
    defaultLeverage: 1,
    defaultMarginMode: "isolated" as const
  }
}

// Helper function to validate private key format
export const validatePrivateKey = (privateKey: string): boolean => {
  return /^0x[a-fA-F0-9]{64}$/.test(privateKey)
}

// Helper function to get demo account info
export const getDemoAccountInfo = () => {
  return {
    availableToTrade: 1000,
    currentPosition: '0.00000 BTC',
    liquidationPrice: 'N/A',
    orderValue: 'N/A',
    marginRequired: 0,
    slippage: 'Est: 0% / Max: 8.00%',
    fees: '0.0432% / 0.0144%'
  }
}

// Example order configurations
export const EXAMPLE_ORDERS = {
  marketBuy: {
    coin: 'BTC-PERP',
    is_buy: true,
    sz: '0.001',
    order_type: { limit: { tif: 'Ioc' } },
    reduce_only: false
  },
  
  limitSell: {
    coin: 'BTC-PERP',
    is_buy: false,
    sz: '0.001',
    limit_px: '50000',
    order_type: { limit: { tif: 'Gtc' } },
    reduce_only: false
  }
}

// Safety warnings for live trading
export const SAFETY_WARNINGS = [
  "⚠️ This is a demonstration interface. Always test on testnet first.",
  "⚠️ Never trade with money you cannot afford to lose.",
  "⚠️ Verify all order parameters before submission.",
  "⚠️ Monitor your positions and liquidation prices.",
  "⚠️ Use appropriate risk management strategies."
]
