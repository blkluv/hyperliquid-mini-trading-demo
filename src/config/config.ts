// Configuration for Hyperliquid trading interface
// IMPORTANT: Replace with your actual private key for testing
// For production, use environment variables or secure key management

export const CONFIG = {
  // Private key for the wallet (replace with your actual private key)
  // Format: "0x" + 64 character hex string
  // IMPORTANT: Replace this with your actual private key for real trading
  PRIVATE_KEY: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  
  // Use testnet for development, mainnet for production
  USE_TESTNET: true,
  
  // Default trading pair
  DEFAULT_COIN: "BTC-PERP",
  
  // Available trading pairs
  AVAILABLE_COINS: [
    { symbol: "BTC-PERP", name: "Bitcoin", icon: "₿" },
    { symbol: "ETH-PERP", name: "Ethereum", icon: "Ξ" },
    { symbol: "DOGE-PERP", name: "Dogecoin", icon: "Ð" },
    { symbol: "SOL-PERP", name: "Solana", icon: "◎" },
    { symbol: "AVAX-PERP", name: "Avalanche", icon: "🔺" },
    { symbol: "MATIC-PERP", name: "Polygon", icon: "⬟" },
    { symbol: "LINK-PERP", name: "Chainlink", icon: "🔗" },
    { symbol: "UNI-PERP", name: "Uniswap", icon: "🦄" },
    { symbol: "AAVE-PERP", name: "Aave", icon: "👻" },
    { symbol: "CRV-PERP", name: "Curve", icon: "🌊" }
  ],
  
  // Default leverage
  DEFAULT_LEVERAGE: 9,
  
  // Default margin mode
  DEFAULT_MARGIN_MODE: "cross" as "isolated" | "cross",
  
  // API endpoints
  HYPERLIQUID_MAINNET_URL: "https://api.hyperliquid.xyz",
  HYPERLIQUID_TESTNET_URL: "https://api.testnet.hyperliquid.xyz",
}

// Helper function to get the correct API URL
export const getApiUrl = () => {
  return CONFIG.USE_TESTNET ? CONFIG.HYPERLIQUID_TESTNET_URL : CONFIG.HYPERLIQUID_MAINNET_URL
}

// Helper function to validate private key format
export const isValidPrivateKey = (privateKey: string): boolean => {
  return /^0x[a-fA-F0-9]{64}$/.test(privateKey)
}
