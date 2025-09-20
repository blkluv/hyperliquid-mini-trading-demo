// Leverage service for dynamic leverage management
// This service fetches real-time leverage information from the API

export interface LeverageInfo {
  coin: string
  maxLeverage: number
  marginTableId: number
  szDecimals: number
  pxDecimals: number | null
  marginTable: {
    description: string
    marginTiers: Array<{
      lowerBound: string
      maxLeverage: number
    }>
  }
  timestamp: string
}

export interface MarginTier {
  lowerBound: number
  maxLeverage: number
}

class LeverageService {
  private leverageCache: Map<string, LeverageInfo> = new Map()
  private cacheExpiry: Map<string, number> = new Map()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  /**
   * Get leverage information for a specific coin
   */
  async getLeverageInfo(coin: string): Promise<LeverageInfo> {
    const cacheKey = coin
    const now = Date.now()
    
    // Check cache first
    if (this.leverageCache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey) || 0
      if (now < expiry) {
        return this.leverageCache.get(cacheKey)!
      }
    }

    try {
      const response = await fetch(`http://localhost:3001/api/leverage/${coin}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch leverage info for ${coin}: ${response.statusText}`)
      }
      
      const leverageInfo: LeverageInfo = await response.json()
      
      // Cache the result
      this.leverageCache.set(cacheKey, leverageInfo)
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION)
      
      return leverageInfo
    } catch (error) {
      console.error(`Error fetching leverage info for ${coin}:`, error)
      
      // Return fallback data
      return this.getFallbackLeverageInfo(coin)
    }
  }

  /**
   * Get available leverage for a specific position size
   */
  async getAvailableLeverage(coin: string, positionSize: number): Promise<number> {
    const leverageInfo = await this.getLeverageInfo(coin)
    const marginTiers = leverageInfo.marginTable.marginTiers
    
    // Find the appropriate tier based on position size
    for (const tier of marginTiers) {
      const lowerBound = parseFloat(tier.lowerBound)
      if (positionSize >= lowerBound) {
        return tier.maxLeverage
      }
    }
    
    // Return the first tier's leverage if no match
    return marginTiers[0]?.maxLeverage || leverageInfo.maxLeverage
  }

  /**
   * Get maximum leverage for a coin
   */
  async getMaxLeverage(coin: string): Promise<number> {
    const leverageInfo = await this.getLeverageInfo(coin)
    return leverageInfo.maxLeverage
  }

  /**
   * Check if a leverage is valid for a coin and position size
   */
  async isValidLeverage(coin: string, leverage: number, positionSize: number): Promise<boolean> {
    const maxLeverage = await this.getMaxLeverage(coin)
    const availableLeverage = await this.getAvailableLeverage(coin, positionSize)
    
    return leverage <= maxLeverage && leverage <= availableLeverage
  }

  /**
   * Get margin tiers for a coin
   */
  async getMarginTiers(coin: string): Promise<MarginTier[]> {
    const leverageInfo = await this.getLeverageInfo(coin)
    return leverageInfo.marginTable.marginTiers.map(tier => ({
      lowerBound: parseFloat(tier.lowerBound),
      maxLeverage: tier.maxLeverage
    }))
  }

  /**
   * Get fallback leverage info when API is unavailable
   */
  private getFallbackLeverageInfo(coin: string): LeverageInfo {
    const fallbackData: { [key: string]: Partial<LeverageInfo> } = {
      'BTC': {
        maxLeverage: 40,
        szDecimals: 5,
        pxDecimals: null,
        marginTable: {
          description: 'BTC fallback',
          marginTiers: [
            { lowerBound: '0.0', maxLeverage: 40 },
            { lowerBound: '10000.0', maxLeverage: 20 },
            { lowerBound: '100000.0', maxLeverage: 10 }
          ]
        }
      },
      'ETH': {
        maxLeverage: 25,
        szDecimals: 4,
        pxDecimals: null,
        marginTable: {
          description: 'ETH fallback',
          marginTiers: [
            { lowerBound: '0.0', maxLeverage: 25 },
            { lowerBound: '5000.0', maxLeverage: 15 },
            { lowerBound: '50000.0', maxLeverage: 8 }
          ]
        }
      },
      'DOGE': {
        maxLeverage: 10,
        szDecimals: 0,
        pxDecimals: null,
        marginTable: {
          description: 'DOGE fallback',
          marginTiers: [
            { lowerBound: '0.0', maxLeverage: 10 },
            { lowerBound: '20000.0', maxLeverage: 5 },
            { lowerBound: '100000.0', maxLeverage: 3 }
          ]
        }
      }
    }

    const fallback = fallbackData[coin] || fallbackData['BTC']
    
    return {
      coin,
      maxLeverage: fallback.maxLeverage || 20,
      marginTableId: 0,
      szDecimals: fallback.szDecimals || 2,
      pxDecimals: fallback.pxDecimals || null,
      marginTable: fallback.marginTable || {
        description: 'Fallback',
        marginTiers: [{ lowerBound: '0.0', maxLeverage: 20 }]
      },
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Clear cache for a specific coin or all coins
   */
  clearCache(coin?: string): void {
    if (coin) {
      this.leverageCache.delete(coin)
      this.cacheExpiry.delete(coin)
    } else {
      this.leverageCache.clear()
      this.cacheExpiry.clear()
    }
  }
}

// Export singleton instance
export const leverageService = new LeverageService()
