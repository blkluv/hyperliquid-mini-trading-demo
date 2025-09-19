/**
 * Hyperliquid数字精度转换工具
 * 根据Hyperliquid API要求处理价格和大小精度
 * 
 * 规则：
 * - 价格(px): 最多5位有效数字，最多6位小数(perp)或8位小数(spot)
 * - 大小(sz): 按szDecimals舍入
 */

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

// 资产元数据缓存
let assetMetadataCache: { [coin: string]: AssetMetadata } = {}
let cacheTimestamp = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

export class HyperliquidPrecision {
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
    // 如果小数部分都是0，则移除小数部分
    if (decimals > 0 && formatted.endsWith('0'.repeat(decimals))) {
      return num.toString()
    }
    return formatted
  }

  /**
   * 从API获取资产元数据
   */
  static async getAssetMetadata(coin: string): Promise<AssetMetadata | null> {
    try {
      console.log(`🔍 Getting asset metadata for: ${coin}`)
      
      // 检查缓存
      const now = Date.now()
      if (assetMetadataCache[coin] && (now - cacheTimestamp) < CACHE_DURATION) {
        console.log(`📋 Using cached metadata for ${coin}:`, assetMetadataCache[coin])
        return assetMetadataCache[coin]
      }

      console.log(`🔄 Fetching fresh metadata from API for ${coin}`)
      // 从API获取元数据
      const response = await fetch('/api/market-data')
      if (!response.ok) {
        throw new Error(`Failed to fetch market data: ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`📊 API response for ${coin}:`, {
        hasPrices: !!data.prices,
        priceKeys: data.prices ? Object.keys(data.prices).slice(0, 5) : [],
        lookingFor: coin
      })
      
      if (data.prices) {
        // 更新缓存
        Object.keys(data.prices).forEach(assetName => {
          const assetData = data.prices[assetName]
          assetMetadataCache[assetName] = {
            name: assetName,
            szDecimals: assetData.szDecimals,
            pxDecimals: assetData.pxDecimals,
            isPerp: assetName.includes('-PERP')
          }
        })
        cacheTimestamp = now
        
        console.log(`✅ Updated cache with ${Object.keys(assetMetadataCache).length} assets`)
        console.log(`🔍 Available assets:`, Object.keys(assetMetadataCache).slice(0, 10))
        console.log(`🔍 Looking for: ${coin}`)
        console.log(`🔍 Found in cache:`, !!assetMetadataCache[coin])
      }

      const result = assetMetadataCache[coin] || null
      if (result) {
        console.log(`✅ Found metadata for ${coin}:`, result)
      } else {
        console.log(`❌ No metadata found for ${coin}`)
        console.log(`❌ Available assets:`, Object.keys(assetMetadataCache))
      }
      
      return result
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
   * 为常见资产创建默认的AssetInfo（回退方案）
   */
  static getDefaultAssetInfo(coin: string): AssetInfo {
    const coinUpper = coin.toUpperCase()
    console.log("can not get asset Decimals metadata, use default value")
    // 默认szDecimals配置
    const szDecimalsMap: { [key: string]: number } = {
      'DOGE': 0,     
      'BTC': 5,      
      'ETH': 2,       
      'SOL': 2,     
      'AVAX': 2,    
      'MATIC': 2,   
      'LINK': 2,    
      'UNI': 2,     
      'AAVE': 2,    
      'CRV': 2,     
    }

    // 默认pxDecimals配置
    const pxDecimalsMap: { [key: string]: number } = {
      'DOGE': 5,    
      'BTC': 1,     
      'ETH': 2,     
      'SOL': 2,     
      'AVAX': 3,    
      'MATIC': 4,   
      'LINK': 3,    
      'UNI': 4,     
      'AAVE': 2,    
      'CRV': 5,     
    }

    const baseCoin = coinUpper.replace('-PERP', '').replace('-SPOT', '')
    const szDecimals = szDecimalsMap[baseCoin] !== undefined ? szDecimalsMap[baseCoin] : 6 // 默认6位小数
    const pxDecimals = pxDecimalsMap[baseCoin] !== undefined ? pxDecimalsMap[baseCoin] : 4 // 默认4位小数
    const isPerp = coinUpper.includes('-PERP')

    return {
      szDecimals,
      pxDecimals,
      isPerp
    }
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