/**
 * Hyperliquid numeric precision utilities
 * Handle price and size precision per Hyperliquid API requirements
 *
 * Rules:
 * Rule 1 - Price significant figures: at most 5 significant digits (integer prices are exempt)
 * Rule 2 - Price decimal limit: priceDecimals ≤ MAX_DECIMALS - szDecimals
 * Rule 3 - Size precision: round to szDecimals
 * Rule 4 - Combined validation: all rules must be satisfied
 */

import { getCoinPrecision } from '../config/hyperliquidPrecisionConfig'

export interface AssetInfo {
  szDecimals: number
  pxDecimals: number
  isPerp: boolean
}

export interface AssetMetadata {
  name: string
  szDecimals: number
  pxDecimals: number
  isPerp: boolean
}

// Lightweight cache: prefer API results; fall back to hyperliquidPrecisionConfig on failure

const assetMetadataCache: Record<string, AssetMetadata> = {}

const normalizeCoinKeys = (coin: string): string[] => {
  const upper = coin.toUpperCase()
  const base = upper.replace(/-(PERP|SPOT)$/i, '')
  const variants = new Set<string>([upper, base])
  variants.add(`${base}-PERP`)
  variants.add(`${base}-SPOT`)
  return Array.from(variants).filter(key => key.length > 0)
}

const cacheMetadata = (coin: string, metadata: AssetMetadata) => {
  normalizeCoinKeys(coin).forEach(key => {
    assetMetadataCache[key] = {
      name: metadata.name,
      szDecimals: metadata.szDecimals,
      pxDecimals: metadata.pxDecimals,
      isPerp: metadata.isPerp
    }
  })
}

export class HyperliquidPrecision {
  // Rule 1: Check price significant digits (max 5; integers exempt)
  static validatePriceSignificantFigures(price: number): boolean {
    if (Number.isInteger(price)) {
      return true // Integer prices are always valid
    }
    
    const significantDigits = this.getSignificantDigits(price)
    return significantDigits <= 5
  }

  // Rule 2: Compute maximum allowed decimal places
  static getMaxPriceDecimals(pxDecimals: number, isPerp: boolean): number {
    const MAX_DECIMALS = isPerp ? 6 : 8 // perp=6, spot=8
    return Math.max(0, MAX_DECIMALS - pxDecimals)
  }

  // Rule 3: Validate price decimal places
  static validatePriceDecimals(price: number, pxDecimals: number, isPerp: boolean): boolean {
    const maxDecimals = this.getMaxPriceDecimals(pxDecimals, isPerp)
    const decimalPlaces = this.getDecimalPlaces(price)
    return decimalPlaces <= maxDecimals
  }

  // Rule 4: Combined validation
  static validatePriceWithRules(price: number, pxDecimals: number, isPerp: boolean): boolean {
    return this.validatePriceSignificantFigures(price) && 
           this.validatePriceDecimals(price, pxDecimals, isPerp)
  }

  // Get number of significant digits
  static getSignificantDigits(num: number): number {
    if (num === 0) return 0
    const str = Math.abs(num).toString()
    // Remove leading zeros and decimal point; keep only significant digits
    const cleanStr = str.replace(/^0+\.?0*/, '').replace(/\./, '')
    return cleanStr.length
  }

  // Get number of decimal places
  static getDecimalPlaces(num: number): number {
    const str = num.toString()
    const decimalIndex = str.indexOf('.')
    return decimalIndex === -1 ? 0 : str.length - decimalIndex - 1
  }

  // Format price, enforcing all rules
  static formatPriceWithRules(price: number, pxDecimals: number, isPerp: boolean): string {
    // pxDecimals directly represents the number of decimal places for price formatting
    const maxDecimals = pxDecimals
    let adjustedPrice = price
    
    // Always apply Rule 1: limit to 5 significant digits (integer exception)
    if (!this.validatePriceSignificantFigures(adjustedPrice)) {
      adjustedPrice = this.truncateToSignificantDigits(adjustedPrice, 5)
    }
    
    // Apply Rule 2: limit decimal places
    if (!this.validatePriceDecimals(adjustedPrice, pxDecimals, isPerp)) {
      adjustedPrice = this.truncateToDecimals(adjustedPrice, maxDecimals)
    }
    
    return this.formatWithDecimals(adjustedPrice, maxDecimals)
  }

  // Truncate to a fixed number of decimal places
  static truncateToDecimals(num: number, decimals: number): number {
    const multiplier = Math.pow(10, decimals)
    return Math.floor(num * multiplier) / multiplier
  }

  // Truncate to a fixed number of significant digits
  static truncateToSignificantDigits(num: number, digits: number): number {
    if (num === 0) return 0
    const magnitude = Math.floor(Math.log10(Math.abs(num)))
    const factor = Math.pow(10, digits - 1 - magnitude)
    return Math.floor(num * factor) / factor
  }

  // Example helper to test the new rules
  static testPriceRules(): void {
    console.log('🧪 Testing Hyperliquid Price Rules:')
    
    // Test cases
    const testCases = [
      { price: 123456, szDecimals: 1, isPerp: true, expected: true, desc: 'Integer price (Rule 1 exception)' },
      { price: 12345.6, szDecimals: 1, isPerp: true, expected: false, desc: '6 significant figures with decimal' },
      { price: 0.01234, szDecimals: 1, isPerp: true, expected: true, desc: '5 significant figures, 5 decimals allowed' },
      { price: 0.012345, szDecimals: 1, isPerp: true, expected: false, desc: '6 decimals > 6-szDecimals=5' },
      { price: 0.123456, szDecimals: 2, isPerp: true, expected: true, desc: '6 significant figures, 4 decimals allowed' },
      { price: 0.1234567, szDecimals: 2, isPerp: true, expected: false, desc: '7 significant figures' },
      { price: 1.23456, szDecimals: 3, isPerp: false, expected: true, desc: 'Spot: 5 significant figures, 5 decimals allowed' },
      { price: 1.234567, szDecimals: 3, isPerp: false, expected: false, desc: 'Spot: 6 significant figures' }
    ]
    
    testCases.forEach(({ price, szDecimals, isPerp, expected, desc }) => {
      const result = this.validatePriceWithRules(price, szDecimals, isPerp)
      const formatted = this.formatPriceWithRules(price, szDecimals, isPerp)
      console.log(`${result === expected ? '✅' : '❌'} ${desc}: ${price} -> ${formatted} (${result})`)
    })
  }

  static primeCacheFromCoins(coins: Array<{ symbol: string; szDecimals?: number; pxDecimals?: number; isPerp?: boolean }>) {
    coins.forEach(coin => {
      if (typeof coin.szDecimals === 'number' && typeof coin.pxDecimals === 'number') {
        cacheMetadata(coin.symbol, {
          name: coin.symbol,
          szDecimals: coin.szDecimals,
          pxDecimals: coin.pxDecimals,
          isPerp: coin.isPerp ?? coin.symbol.endsWith('-PERP')
        })
      }
    })
  }

  /**
   * Format price according to Hyperliquid precision requirements
   * @param price Raw price
   * @param assetInfo Asset info
   * @returns Formatted price string
   */
  static formatPrice(price: number, assetInfo: AssetInfo): string {
    if (isNaN(price) || !isFinite(price) || price <= 0) {
      return '0'
    }
    
    // Use pxDecimals for price formatting, not szDecimals
    return this.formatPriceWithRules(price, assetInfo.pxDecimals, assetInfo.isPerp)
  }

  /**
   * Format size, rounding to szDecimals
   * @param size Raw size
   * @param szDecimals Decimal places
   * @returns Formatted size string
   */
  static formatSize(size: number, szDecimals: number): string {
    if (isNaN(size) || !isFinite(size) || size < 0) {
      throw new Error('Invalid size value')
    }

    // Round to szDecimals
    const multiplier = Math.pow(10, szDecimals)
    const roundedSize = Math.round(size * multiplier) / multiplier
    
    // Size formatting always shows the specified number of decimals
    return roundedSize.toFixed(szDecimals)
  }

  /**
   * Validate price against Hyperliquid requirements
   * @param price Price value
   * @param assetInfo Asset info
   * @returns Whether it is valid
   */
  static validatePrice(price: number, assetInfo: AssetInfo): boolean {
    if (isNaN(price) || !isFinite(price) || price <= 0) {
      return false
    }

    // Validate with the new rules
    return this.validatePriceWithRules(price, assetInfo.szDecimals, assetInfo.isPerp)
  }

  /**
   * Validate size against Hyperliquid requirements
   * @param size Size value
   * @param szDecimals Decimal places
   * @returns Whether it is valid
   */
  static validateSize(size: number, szDecimals: number): boolean {
    if (isNaN(size) || !isFinite(size) || size < 0) {
      return false
    }

    // Check against szDecimals precision
    const multiplier = Math.pow(10, szDecimals)
    const roundedSize = Math.round(size * multiplier) / multiplier
    return Math.abs(size - roundedSize) < Number.EPSILON
  }

  /**
   * Get a detailed error message for size validation
   * @param size Size value
   * @param szDecimals Decimal places
   * @param coin Coin name
   * @returns Error message
   */
  static getSizeValidationError(size: number, szDecimals: number, coin: string): string {
    if (isNaN(size) || !isFinite(size)) {
      return 'Order size must be a valid number'
    }
    
    if (size < 0) {
      return 'Order size must be positive'
    }

    // Check decimal places
    const decimalPlaces = this.getDecimalPlaces(size)
    if (decimalPlaces > szDecimals) {
      if (szDecimals === 0) {
        return `${coin} only accepts whole numbers (no decimals). Please enter a whole number like ${Math.round(size)}`
      } else {
        const pluralSuffix = szDecimals === 1 ? '' : 's'
        return `${coin} only accepts up to ${szDecimals} decimal place${pluralSuffix}. Please round to ${szDecimals} decimal place${pluralSuffix}`
      }
    }

    return 'Order size does not meet precision requirements'
  }


  /**
   * Format a number to a fixed number of decimal places
   */
  private static formatWithDecimals(num: number, decimals: number): string {
    // Use standard rounding for price formatting
    const multiplier = Math.pow(10, decimals)
    const rounded = Math.round(num * multiplier) / multiplier
    return rounded.toFixed(decimals)
  }

  /**
   * Fetch asset metadata from the API
   */
  static async getAssetMetadata(coin: string): Promise<AssetMetadata | null> {
    try {
      console.log(`🔍 Getting asset metadata for: ${coin}`)
      const variants = normalizeCoinKeys(coin)
      for (const key of variants) {
        const cached = assetMetadataCache[key]
        if (cached) {
          console.log(`📋 Returning cached metadata for ${coin}:`, cached)
          return cached
        }
      }
      
      // Call the API directly; do not use cache
      console.log(`🔄 Fetching fresh metadata from API for ${coin}`)
      
      // Try the dedicated API endpoint first
      try {
        // Try alternate coin name formats
        const coinFormats = [coin, coin.replace('-PERP', ''), coin.replace('-SPOT', '')]
        
        for (const coinFormat of coinFormats) {
          console.log(`🔍 Trying API with coin format: ${coinFormat}`)
          const response = await fetch(`/api/asset-metadata/${coinFormat}`)
          if (response.ok) {
            const data = await response.json()
            console.log(`✅ Direct API response for ${coinFormat}:`, data)
            
            if (data.found) {
              const metadata: AssetMetadata = {
                name: data.name || coin,
                szDecimals: data.szDecimals,
                pxDecimals: data.pxDecimals,
                isPerp: data.isPerp ?? (coinFormat.toUpperCase().includes('-PERP'))
              }
              cacheMetadata(coin, metadata)
              console.log(`✅ Found metadata for ${coin}:`, metadata)
              return metadata
            }
          } else {
            console.log(`⚠️ API failed for ${coinFormat}: ${response.status}`)
          }
        }
        
        console.log(`⚠️ All coin formats failed for ${coin}, trying market-data endpoint`)
      } catch (directApiError) {
        console.log(`⚠️ Direct API error for ${coin}:`, directApiError instanceof Error ? directApiError.message : String(directApiError))
      }
      
      // Fallback to the market-data endpoint
      const response = await fetch('/api/market-data')
      if (!response.ok) {
        throw new Error(`Failed to fetch market data: ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`📊 Market-data API response for ${coin}:`, {
        hasPrices: !!data.prices,
        priceKeys: data.prices ? Object.keys(data.prices).slice(0, 5) : [],
        lookingFor: coin,
        foundCoin: data.prices ? coin in data.prices : false
      })
      
      const prices = data.prices ?? {}
      if (prices[coin]) {
        const assetData = prices[coin]
        const metadata: AssetMetadata = {
          name: coin,
          szDecimals: assetData.szDecimals,
          pxDecimals: assetData.pxDecimals,
          isPerp: coin.toUpperCase().includes('-PERP')
        }
        cacheMetadata(coin, metadata)
        console.log(`✅ Found metadata for ${coin} in market-data:`, metadata)
        return metadata
      }
      
      console.log(`❌ No metadata found for ${coin}`)
      return null
    } catch (error) {
      console.error(`❌ Failed to fetch asset metadata for ${coin}:`, error)
      return null
    }
  }

  /**
   * Get asset info (prefer API; fall back to defaults)
   */
  static async getAssetInfo(coin: string): Promise<AssetInfo> {
    const metadata = await this.getAssetMetadata(coin)
    if (metadata) {
      return {
        szDecimals: metadata.szDecimals,
        pxDecimals: metadata.pxDecimals,
        isPerp: metadata.isPerp
      }
    }
    
    // Fall back to defaults
    return this.getDefaultAssetInfo(coin)
  }

  /**
   * Get szDecimals (directly from API; fall back to hyperliquidPrecisionConfig on failure)
   */
  static async getSzDecimals(coin: string): Promise<number> {
    try {
      const metadata = await this.getAssetMetadata(coin)
      if (metadata && typeof metadata.szDecimals === 'number') {
        console.log(`✅ Using API szDecimals for ${coin}: ${metadata.szDecimals}`)
        return metadata.szDecimals
      }
    } catch (error) {
      console.warn(`⚠️ Failed to get szDecimals from API for ${coin}:`, error)
    }

    // Fall back directly to hyperliquidPrecisionConfig
    const fallbackPrecision = getCoinPrecision(coin)
    console.log(`⚠️ Using fallback szDecimals for ${coin}: ${fallbackPrecision.szDecimals}`)
    return fallbackPrecision.szDecimals
  }

  /**
   * Get pxDecimals (derive from rules/API; fallback to config)
   */
  static async getPxDecimals(coin: string): Promise<number> {
    // Always compute price decimals from rules: MAX_DECIMALS - szDecimals
    try {
      const metadata = await this.getAssetMetadata(coin)
      if (metadata && typeof metadata.szDecimals === 'number') {
        const max = this.getMaxPriceDecimals(metadata.pxDecimals, !!metadata.isPerp)
        console.log(`✅ Using rule-based pxDecimals for ${coin}: ${max}`)
        return max
      }
    } catch (error) {
      console.warn(`⚠️ Failed to compute rule-based pxDecimals for ${coin}:`, error)
    }

    // Fallback to config szDecimals + isPerp and compute
    const fallback = getCoinPrecision(coin)
    const max = this.getMaxPriceDecimals(fallback.pxDecimals, !!fallback.isPerp)
    console.log(`🔧 Fallback rule-based pxDecimals for ${coin}: ${max}`)
    return max
  }

  /**
   * Create default AssetInfo for common assets (fallback)
   */
  static getDefaultAssetInfo(coin: string): AssetInfo {
    const cached = assetMetadataCache[coin.toUpperCase()]
    if (cached) {
      return {
        szDecimals: cached.szDecimals,
        pxDecimals: cached.pxDecimals,
        isPerp: cached.isPerp
      }
    }

    console.warn(`🔧 FALLBACK: Missing asset decimals metadata for ${coin}, using config defaults`)
    return getCoinPrecision(coin)
  }

  /**
   * Batch format an array of prices
   */
  static formatPrices(prices: number[], assetInfo: AssetInfo): string[] {
    return prices.map(price => this.formatPrice(price, assetInfo))
  }

  /**
   * Batch format an array of sizes
   */
  static formatSizes(sizes: number[], szDecimals: number): string[] {
    return sizes.map(size => this.formatSize(size, szDecimals))
  }
}

/**
 * Convenience: format price (async; uses API metadata)
 */
export async function formatHyperliquidPrice(price: number, coin: string): Promise<string> {
  const assetInfo = await HyperliquidPrecision.getAssetInfo(coin)
  return HyperliquidPrecision.formatPrice(price, assetInfo)
}

/**
 * Convenience: format size (async; uses API metadata)
 */
export async function formatHyperliquidSize(size: number, coin: string): Promise<string> {
  const assetInfo = await HyperliquidPrecision.getAssetInfo(coin)
  return HyperliquidPrecision.formatSize(size, assetInfo.szDecimals)
}

/**
 * Convenience: validate price (async; uses API metadata)
 */
export async function validateHyperliquidPrice(price: number, coin: string): Promise<boolean> {
  const assetInfo = await HyperliquidPrecision.getAssetInfo(coin)
  return HyperliquidPrecision.validatePrice(price, assetInfo)
}

/**
 * Convenience: validate size (async; uses API metadata)
 */
export async function validateHyperliquidSize(size: number, coin: string): Promise<boolean> {
  const assetInfo = await HyperliquidPrecision.getAssetInfo(coin)
  return HyperliquidPrecision.validateSize(size, assetInfo.szDecimals)
}

/**
 * Convenience: format price (sync; uses defaults)
 */
export function formatHyperliquidPriceSync(price: number, coin: string): string {
  const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(coin)
  return HyperliquidPrecision.formatPrice(price, assetInfo)
}

/**
 * Convenience: format size (sync; uses defaults)
 */
export function formatHyperliquidSizeSync(size: number, coin: string): string {
  const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(coin)
  return HyperliquidPrecision.formatSize(size, assetInfo.szDecimals)
}

/**
 * Convenience: validate price (sync; uses defaults)
 */
export function validateHyperliquidPriceSync(price: number, coin: string): boolean {
  const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(coin)
  return HyperliquidPrecision.validatePrice(price, assetInfo)
}

/**
 * Convenience: validate size (sync; uses defaults)
 */
export function validateHyperliquidSizeSync(size: number, coin: string): boolean {
  const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(coin)
  return HyperliquidPrecision.validateSize(size, assetInfo.szDecimals)
}

/**
 * Convenience: get size validation error message (sync; uses defaults)
 */
export function getHyperliquidSizeValidationError(size: number, coin: string): string {
  const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(coin)
  return HyperliquidPrecision.getSizeValidationError(size, assetInfo.szDecimals, coin)
}

/**
 * Convenience: get szDecimals (sync; uses defaults)
 */
export function getSzDecimalsSync(coin: string): number {
  const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(coin)
  return assetInfo.szDecimals
}

/**
 * Convenience: get pxDecimals (sync; uses defaults)
 */
export function getPxDecimalsSync(coin: string): number {
  const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(coin)
  return HyperliquidPrecision.getMaxPriceDecimals(assetInfo.pxDecimals, assetInfo.isPerp)
}
