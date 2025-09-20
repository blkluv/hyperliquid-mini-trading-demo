/**
 * Hyperliquid精度配置
 * 集中管理所有szDecimals和pxDecimals的硬编码回退值
 * 这是唯一一个需要更新精度值的地方
 */

// 默认精度值
export const DEFAULT_PX_DECIMALS = 4
export const DEFAULT_SZ_DECIMALS = 6

// 币种特定的精度配置
// 包含szDecimals和pxDecimals的完整配置
const COIN_PRECISION_CONFIG: Record<string, { szDecimals: number; pxDecimals: number; isPerp: boolean }> = {
  // PERP 合约
  'DOGE-PERP': { szDecimals: 0, pxDecimals: 5, isPerp: true },
  'BTC-PERP': { szDecimals: 5, pxDecimals: 0, isPerp: true },
  'ETH-PERP': { szDecimals: 2, pxDecimals: 1, isPerp: true },
  'SOL-PERP': { szDecimals: 2, pxDecimals: 2, isPerp: true },
  'AVAX-PERP': { szDecimals: 2, pxDecimals: 3, isPerp: true },
  'MATIC-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'LINK-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'UNI-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'AAVE-PERP': { szDecimals: 2, pxDecimals: 2, isPerp: true },
  'CRV-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'KAITO-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'ASTER-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'ACE-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'BNB-PERP': { szDecimals: 2, pxDecimals: 1, isPerp: true },
  'ATOM-PERP': { szDecimals: 2, pxDecimals: 4, isPerp: true },
  'PENGU-PERP': { szDecimals: 2, pxDecimals: 6, isPerp: true },
  'ANIME-PERP': { szDecimals: 0, pxDecimals: 6, isPerp: true },

  // SPOT 现货
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

  // 基础币种（无后缀）
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
  'ANIME': { szDecimals: 0, pxDecimals: 6, isPerp: false },
}

/**
 * 获取币种的完整精度配置
 */
export function getCoinPrecision(coin: string): {
  szDecimals: number
  pxDecimals: number
  isPerp: boolean
} {
  const coinUpper = coin.toUpperCase()
  console.log(`🔍 getCoinPrecision called with: "${coin}" -> "${coinUpper}"`)
  
  // 直接匹配
  if (COIN_PRECISION_CONFIG[coinUpper]) {
    console.log(`✅ Direct match found for ${coinUpper}:`, COIN_PRECISION_CONFIG[coinUpper])
    return COIN_PRECISION_CONFIG[coinUpper]
  }
  
  // 尝试不同的币种格式
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
  
  // 回退到默认值
  return {
    szDecimals: DEFAULT_SZ_DECIMALS,
    pxDecimals: DEFAULT_PX_DECIMALS,
    isPerp: coinUpper.includes('-PERP')
  }
}

/**
 * 获取默认精度配置
 */
export function getDefaultPrecision() {
  return {
    szDecimals: DEFAULT_SZ_DECIMALS,
    pxDecimals: DEFAULT_PX_DECIMALS
  }
}

/**
 * 获取szDecimals（向后兼容）
 */
export function getSzDecimals(coin: string): number {
  return getCoinPrecision(coin).szDecimals
}

/**
 * 获取pxDecimals（向后兼容）
 */
export function getPxDecimals(coin: string): number {
  return getCoinPrecision(coin).pxDecimals
}
