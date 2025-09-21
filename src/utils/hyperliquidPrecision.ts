/**
 * Hyperliquid数字精度转换工具
 * 根据Hyperliquid API要求处理价格和大小精度
 * 
 * 规则：
 * - 价格(px): 最多5位有效数字，最多6位小数(perp)或8位小数(spot)
 * - 大小(sz): 按szDecimals舍入
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

// 轻量级缓存：优先使用API结果，失败时回退到hyperliquidPrecisionConfig

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
   * 格式化价格，符合Hyperliquid精度要求
   * @param price 原始价格
   * @param assetInfo 资产信息
   * @returns 格式化后的价格字符串
   */
  static formatPrice(price: number, assetInfo: AssetInfo): string {
    if (isNaN(price) || !isFinite(price) || price <= 0) {
      return '0'
    }
    
    // 计算有效数字
    const significantDigits = this.getSignificantDigits(price)
    
    // 如果有效数字超过5位，需要截断
    if (significantDigits > 5) {
      price = this.truncateToSignificantDigits(price, 5)
    }
    
    // 使用pxDecimals进行格式化
    const actualDecimals = assetInfo.pxDecimals
    
    // 格式化价格
    return this.formatWithDecimals(price, actualDecimals)
  }

  /**
   * 格式化大小，按szDecimals舍入
   * @param size 原始大小
   * @param szDecimals 小数位数
   * @returns 格式化后的大小字符串
   */
  static formatSize(size: number, szDecimals: number): string {
    if (isNaN(size) || !isFinite(size) || size < 0) {
      throw new Error('Invalid size value')
    }

    // 按szDecimals舍入
    const multiplier = Math.pow(10, szDecimals)
    const roundedSize = Math.round(size * multiplier) / multiplier
    
    // 大小格式化总是显示指定的小数位数
    return roundedSize.toFixed(szDecimals)
  }

  /**
   * 验证价格是否符合Hyperliquid要求
   * @param price 价格值
   * @param assetInfo 资产信息
   * @returns 是否有效
   */
  static validatePrice(price: number, assetInfo: AssetInfo): boolean {
    if (isNaN(price) || !isFinite(price) || price <= 0) {
      return false
    }

    // 检查有效数字
    const significantDigits = this.getSignificantDigits(price)
    if (significantDigits > 5) {
      return false
    }

    // 检查小数位数是否符合pxDecimals
    const decimalPlaces = this.getDecimalPlaces(price)
    
    return decimalPlaces <= assetInfo.pxDecimals
  }

  /**
   * 验证大小是否符合Hyperliquid要求
   * @param size 大小值
   * @param szDecimals 小数位数
   * @returns 是否有效
   */
  static validateSize(size: number, szDecimals: number): boolean {
    if (isNaN(size) || !isFinite(size) || size < 0) {
      return false
    }

    // 检查是否符合szDecimals精度
    const multiplier = Math.pow(10, szDecimals)
    const roundedSize = Math.round(size * multiplier) / multiplier
    return Math.abs(size - roundedSize) < Number.EPSILON
  }

  /**
   * 获取大小验证的详细错误消息
   * @param size 大小值
   * @param szDecimals 小数位数
   * @param coin 币种名称
   * @returns 错误消息
   */
  static getSizeValidationError(size: number, szDecimals: number, coin: string): string {
    if (isNaN(size) || !isFinite(size)) {
      return 'Order size must be a valid number'
    }
    
    if (size < 0) {
      return 'Order size must be positive'
    }

    // 检查小数位数
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
   * 获取数字的有效数字位数
   */
  private static getSignificantDigits(num: number): number {
    if (num === 0) return 1
    
    // 使用科学计数法来准确计算有效数字
    const str = num.toExponential()
    const match = str.match(/^(\d)\.(\d+)e([+-]\d+)$/)
    if (match) {
      const [, , mantissa] = match
      return 1 + mantissa.length
    }
    
    // 回退到字符串方法
    const strNormal = num.toString()
    const cleanStr = strNormal.replace(/^0+\.?0*/, '').replace(/\./, '')
    return cleanStr.length
  }

  /**
   * 截断到指定有效数字位数
   */
  private static truncateToSignificantDigits(num: number, digits: number): number {
    if (num === 0) return 0
    
    const magnitude = Math.floor(Math.log10(Math.abs(num)))
    const factor = Math.pow(10, digits - magnitude - 1)
    return Math.floor(num * factor) / factor
  }

  /**
   * 获取数字的小数位数
   */
  private static getDecimalPlaces(num: number): number {
    const str = num.toString()
    if (str.indexOf('.') !== -1 && str.indexOf('e-') === -1) {
      return str.split('.')[1].length
    }
    return 0
  }

  /**
   * 格式化数字到指定小数位数
   */
  private static formatWithDecimals(num: number, decimals: number): string {
    const formatted = num.toFixed(decimals)
    // 始终保留配置要求的小数位数，以匹配官方前端展示
    return formatted
  }

  /**
   * 从API获取资产元数据
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
      
      // 直接调用API，不使用缓存
      console.log(`🔄 Fetching fresh metadata from API for ${coin}`)
      
      // 尝试使用专用API端点
      try {
        // 尝试不同的币种名称格式
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
      
      // 回退到market-data端点
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
   * 获取资产信息（优先使用API，回退到默认值）
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
    
    // 回退到默认值
    return this.getDefaultAssetInfo(coin)
  }

  /**
   * 获取szDecimals（直接从API获取，失败时回退到hyperliquidPrecisionConfig）
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

    // 直接回退到hyperliquidPrecisionConfig
    const fallbackPrecision = getCoinPrecision(coin)
    console.log(`⚠️ Using fallback szDecimals for ${coin}: ${fallbackPrecision.szDecimals}`)
    return fallbackPrecision.szDecimals
  }

  /**
   * 获取pxDecimals（直接从API获取，失败时回退到hyperliquidPrecisionConfig）
   */
  static async getPxDecimals(coin: string): Promise<number> {
    try {
      const metadata = await this.getAssetMetadata(coin)
      if (metadata && typeof metadata.pxDecimals === 'number') {
        console.log(`✅ Using API pxDecimals for ${coin}: ${metadata.pxDecimals}`)
        return metadata.pxDecimals
      }
    } catch (error) {
      console.warn(`⚠️ Failed to get pxDecimals from API for ${coin}:`, error)
    }

    // 直接回退到hyperliquidPrecisionConfig
    const fallbackPrecision = getCoinPrecision(coin)
    console.log(`⚠️ Using fallback pxDecimals for ${coin}: ${fallbackPrecision.pxDecimals}`)
    return fallbackPrecision.pxDecimals
  }

  /**
   * 为常见资产创建默认的AssetInfo（回退方案）
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
   * 批量格式化价格数组
   */
  static formatPrices(prices: number[], assetInfo: AssetInfo): string[] {
    return prices.map(price => this.formatPrice(price, assetInfo))
  }

  /**
   * 批量格式化大小数组
   */
  static formatSizes(sizes: number[], szDecimals: number): string[] {
    return sizes.map(size => this.formatSize(size, szDecimals))
  }
}

/**
 * 便捷函数：格式化价格（异步版本，使用API元数据）
 */
export async function formatHyperliquidPrice(price: number, coin: string): Promise<string> {
  const assetInfo = await HyperliquidPrecision.getAssetInfo(coin)
  return HyperliquidPrecision.formatPrice(price, assetInfo)
}

/**
 * 便捷函数：格式化大小（异步版本，使用API元数据）
 */
export async function formatHyperliquidSize(size: number, coin: string): Promise<string> {
  const assetInfo = await HyperliquidPrecision.getAssetInfo(coin)
  return HyperliquidPrecision.formatSize(size, assetInfo.szDecimals)
}

/**
 * 便捷函数：验证价格（异步版本，使用API元数据）
 */
export async function validateHyperliquidPrice(price: number, coin: string): Promise<boolean> {
  const assetInfo = await HyperliquidPrecision.getAssetInfo(coin)
  return HyperliquidPrecision.validatePrice(price, assetInfo)
}

/**
 * 便捷函数：验证大小（异步版本，使用API元数据）
 */
export async function validateHyperliquidSize(size: number, coin: string): Promise<boolean> {
  const assetInfo = await HyperliquidPrecision.getAssetInfo(coin)
  return HyperliquidPrecision.validateSize(size, assetInfo.szDecimals)
}

/**
 * 便捷函数：格式化价格（同步版本，使用默认值）
 */
export function formatHyperliquidPriceSync(price: number, coin: string): string {
  const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(coin)
  return HyperliquidPrecision.formatPrice(price, assetInfo)
}

/**
 * 便捷函数：格式化大小（同步版本，使用默认值）
 */
export function formatHyperliquidSizeSync(size: number, coin: string): string {
  const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(coin)
  return HyperliquidPrecision.formatSize(size, assetInfo.szDecimals)
}

/**
 * 便捷函数：验证价格（同步版本，使用默认值）
 */
export function validateHyperliquidPriceSync(price: number, coin: string): boolean {
  const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(coin)
  return HyperliquidPrecision.validatePrice(price, assetInfo)
}

/**
 * 便捷函数：验证大小（同步版本，使用默认值）
 */
export function validateHyperliquidSizeSync(size: number, coin: string): boolean {
  const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(coin)
  return HyperliquidPrecision.validateSize(size, assetInfo.szDecimals)
}

/**
 * 便捷函数：获取大小验证错误消息（同步版本，使用默认值）
 */
export function getHyperliquidSizeValidationError(size: number, coin: string): string {
  const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(coin)
  return HyperliquidPrecision.getSizeValidationError(size, assetInfo.szDecimals, coin)
}

/**
 * 便捷函数：获取szDecimals（同步版本，使用默认值）
 */
export function getSzDecimalsSync(coin: string): number {
  const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(coin)
  return assetInfo.szDecimals
}

/**
 * 便捷函数：获取pxDecimals（同步版本，使用默认值）
 */
export function getPxDecimalsSync(coin: string): number {
  const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(coin)
  return assetInfo.pxDecimals
}
