/**
 * Hyperliquid precision configuration - JavaScript version
 * Provides precision configuration for the Node.js server
 */

// Default precision values
export const DEFAULT_PX_DECIMALS = 4
export const DEFAULT_SZ_DECIMALS = 6

// Asset-specific precision configuration
export const COIN_PRECISION_CONFIG = {
  // PERP contracts
  'DOGE-PERP': { szDecimals: 0, pxDecimals: 5, isPerp: true },
  'JUP-PERP': { szDecimals: 0, pxDecimals: 5, isPerp: true },
  'HYPE-PERP': { szDecimals: 2, pxDecimals: 3, isPerp: true },
  'ARB-PERP': { szDecimals: 0, pxDecimals: 5, isPerp: true },
  'DYDX-PERP': { szDecimals: 0, pxDecimals: 5, isPerp: true },
  'BTC-PERP': { szDecimals: 5, pxDecimals: 0, isPerp: true },
  'ETH-PERP': { szDecimals: 4, pxDecimals: 2, isPerp: true },
  'SOL-PERP': { szDecimals: 2, pxDecimals: 2, isPerp: true },
  'AVAX-PERP': { szDecimals: 2, pxDecimals: 3, isPerp: true },
  'MATIC-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'LINK-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'UNI-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'AAVE-PERP': { szDecimals: 2, pxDecimals: 2, isPerp: true },
  'CRV-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'EIGEN-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'CRV-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'KAITO-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'ASTER-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'BNB-PERP': { szDecimals: 3, pxDecimals: 1, isPerp: true },
  'ATOM-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'ANIME-PERP': { szDecimals: 0, pxDecimals: 6, isPerp: true },
  'PUMP-PERP': { szDecimals: 0, pxDecimals: 6, isPerp: true },


  // SPOT markets
  'DOGE-SPOT': { szDecimals: 0, pxDecimals: 5, isPerp: false },
  'BTC-SPOT': { szDecimals: 5, pxDecimals: 0, isPerp: false },
  'ETH-SPOT': { szDecimals: 2, pxDecimals: 1, isPerp: false },
  'SOL-SPOT': { szDecimals: 2, pxDecimals: 2, isPerp: false },
  'AVAX-SPOT': { szDecimals: 2, pxDecimals: 3, isPerp: false },
  'MATIC-SPOT': { szDecimals: 2, pxDecimals: 4, isPerp: false },
  'LINK-SPOT': { szDecimals: 2, pxDecimals: 4, isPerp: false },
  'UNI-SPOT': { szDecimals: 2, pxDecimals: 4, isPerp: false },
  'AAVE-SPOT': { szDecimals: 2, pxDecimals: 2, isPerp: false },
  'CRV-SPOT': { szDecimals: 2, pxDecimals: 4, isPerp: false },
  'BNB-SPOT': { szDecimals: 2, pxDecimals: 1, isPerp: false },
  'PUMP-SPOT': { szDecimals: 0, pxDecimals: 6, isPerp: false },

  // Base assets (no suffix)
  'DOGE': { szDecimals: 0, pxDecimals: 5, isPerp: false },
  'BTC': { szDecimals: 5, pxDecimals: 0, isPerp: false },
  'ETH': { szDecimals: 2, pxDecimals: 1, isPerp: false },
  'SOL': { szDecimals: 2, pxDecimals: 2, isPerp: false },
  'AVAX': { szDecimals: 2, pxDecimals: 3, isPerp: false },
  'MATIC': { szDecimals: 2, pxDecimals: 4, isPerp: false },
  'LINK': { szDecimals: 2, pxDecimals: 4, isPerp: false },
  'UNI': { szDecimals: 2, pxDecimals: 4, isPerp: false },
  'AAVE': { szDecimals: 2, pxDecimals: 2, isPerp: false },
  'CRV': { szDecimals: 2, pxDecimals: 4, isPerp: false },
  'BNB': { szDecimals: 2, pxDecimals: 1, isPerp: false },
  'ANIME': { szDecimals: 0, pxDecimals: 6, isPerp: false },
  'PUMP': { szDecimals: 0, pxDecimals: 6, isPerp: false },
}

/**
 * Get the full precision configuration for a coin
 */
export function getCoinPrecision(coin) {
  const coinUpper = coin.toUpperCase()
  console.log(`🔍 getCoinPrecision called with: "${coin}" -> "${coinUpper}"`)
  
  // Direct match
  if (COIN_PRECISION_CONFIG[coinUpper]) {
    console.log(`✅ Direct match found for ${coinUpper}:`, COIN_PRECISION_CONFIG[coinUpper])
    return COIN_PRECISION_CONFIG[coinUpper]
  }
  
  // Try different coin format variants
  const variants = [
    coinUpper,
    coinUpper.replace('-PERP', ''),
    coinUpper.replace('-SPOT', ''),
    `${coinUpper.replace('-PERP', '').replace('-SPOT', '')}-PERP`,
    `${coinUpper.replace('-PERP', '').replace('-SPOT', '')}-SPOT`
  ]
  
  for (const variant of variants) {
    console.log(`🔍 Trying variant: "${variant}"`)
    if (COIN_PRECISION_CONFIG[variant]) {
      console.log(`✅ Variant match found for ${variant}:`, COIN_PRECISION_CONFIG[variant])
      return COIN_PRECISION_CONFIG[variant]
    }
  }
  
  // Fallback to defaults
  return {
    szDecimals: DEFAULT_SZ_DECIMALS,
    pxDecimals: DEFAULT_PX_DECIMALS,
    isPerp: coinUpper.includes('-PERP')
  }
}

/**
 * Get default precision configuration
 */
export function getDefaultPrecision() {
  return {
    szDecimals: DEFAULT_SZ_DECIMALS,
    pxDecimals: DEFAULT_PX_DECIMALS
  }
}

/**
 * Get szDecimals (backward compatibility)
 */
export function getSzDecimals(coin) {
  return getCoinPrecision(coin).szDecimals
}

/**
 * Get pxDecimals (backward compatibility)
 */
export function getPxDecimals(coin) {
  return getCoinPrecision(coin).pxDecimals
}
