import { describe, it, expect, beforeEach } from 'vitest'

// Mock trading state interface
interface TradingState {
  selectedCoin: string
  marginMode: 'isolated' | 'cross'
  leverage: number
  orderType: 'market' | 'limit' | 'scale' | 'twap'
  side: 'buy' | 'sell'
  size: string
  sizeUnit: 'USD' | string
  sizePercentage: number
  reduceOnly: boolean
  takeProfitStopLoss: boolean
  limitPrice: string
  limitPriceManuallySet: boolean
  timeInForce: 'GTC' | 'IOC' | 'ALO'
  stopLossPrice: string
  takeProfitPrice: string
  takeProfitGain: string
  stopLossLoss: string
  // Scale order specific fields
  scaleStartPrice: string
  scaleEndPrice: string
  scaleOrderCount: string
  scaleSizeSkew: string
  // TWAP order specific fields
  twapRunningTimeHours: string
  twapRunningTimeMinutes: string
  twapNumberOfIntervals: string
  twapOrderType: 'market' | 'limit'
  twapPriceOffset: string
  twapRandomize: boolean
}

// Trading parameter collection and validation functions
class TradingParamsValidator {
  // Collect trading parameters from form state
  static collectTradingParams(state: TradingState, currentPrice?: number) {
    const baseParams = {
      coin: state.selectedCoin,
      side: state.side,
      reduceOnly: state.reduceOnly,
      leverage: state.leverage
    }

    switch (state.orderType) {
      case 'market':
        return {
          ...baseParams,
          orderType: 'market',
          size: this.convertSizeToCoinUnits(state.size, state.sizeUnit, currentPrice),
          price: currentPrice
        }

      case 'limit':
        return {
          ...baseParams,
          orderType: 'limit',
          size: this.convertSizeToCoinUnits(state.size, state.sizeUnit, currentPrice),
          price: parseFloat(state.limitPrice),
          timeInForce: state.timeInForce
        }

      case 'scale':
        return {
          ...baseParams,
          orderType: 'scale',
          size: this.convertSizeToCoinUnits(state.size, state.sizeUnit, currentPrice),
          startPrice: parseFloat(state.scaleStartPrice),
          endPrice: parseFloat(state.scaleEndPrice),
          orderCount: parseInt(state.scaleOrderCount),
          sizeSkew: parseFloat(state.scaleSizeSkew)
        }

      case 'twap':
        return {
          ...baseParams,
          orderType: 'twap',
          size: this.convertSizeToCoinUnits(state.size, state.sizeUnit, currentPrice),
          durationMinutes: (parseInt(state.twapRunningTimeHours) * 60) + parseInt(state.twapRunningTimeMinutes),
          intervals: parseInt(state.twapNumberOfIntervals),
          twapOrderType: state.twapOrderType,
          priceOffset: parseFloat(state.twapPriceOffset)
        }

      default:
        throw new Error(`Unsupported order type: ${state.orderType}`)
    }
  }

  // Convert size to coin units based on size unit
  static convertSizeToCoinUnits(size: string, sizeUnit: string, currentPrice?: number): number {
    const sizeValue = parseFloat(size)
    if (isNaN(sizeValue) || sizeValue <= 0) return 0

    if (sizeUnit === 'USD') {
      if (!currentPrice || currentPrice <= 0) return 0
      return sizeValue / currentPrice
    } else {
      return sizeValue // Already in coin units
    }
  }

  // Validate trading parameters
  static validateTradingParams(params: any, orderType: string): string[] {
    const errors: string[] = []

    // Common validations
    if (!params.coin) {
      errors.push('Coin is required')
    }

    if (!params.side || !['buy', 'sell'].includes(params.side)) {
      errors.push('Valid side (buy/sell) is required')
    }

    if (!params.size || params.size <= 0) {
      errors.push('Valid size is required')
    }

    if (!params.leverage || params.leverage <= 0) {
      errors.push('Valid leverage is required')
    }

    // Order type specific validations
    switch (orderType) {
      case 'market':
        if (!params.price || params.price <= 0) {
          errors.push('Current price is required for market orders')
        }
        break

      case 'limit':
        if (!params.price || params.price <= 0) {
          errors.push('Valid limit price is required')
        }
        if (!params.timeInForce || !['GTC', 'IOC', 'ALO'].includes(params.timeInForce)) {
          errors.push('Valid time in force is required')
        }
        break

      case 'scale':
        if (!params.startPrice || params.startPrice <= 0) {
          errors.push('Valid start price is required')
        }
        if (!params.endPrice || params.endPrice <= 0) {
          errors.push('Valid end price is required')
        }
        if (params.startPrice === params.endPrice) {
          errors.push('Start price and end price must be different')
        }
        if (!params.orderCount || params.orderCount <= 0) {
          errors.push('Valid order count is required')
        }
        if (params.orderCount > 20) {
          errors.push('Maximum 20 scale orders allowed')
        }
        if (!params.sizeSkew || params.sizeSkew <= 0) {
          errors.push('Valid size skew is required')
        }
        break

      case 'twap':
        if (!params.durationMinutes || params.durationMinutes <= 0) {
          errors.push('Valid duration is required')
        }
        if (params.durationMinutes < 5) {
          errors.push('Minimum duration is 5 minutes')
        }
        if (params.durationMinutes > 1440) {
          errors.push('Maximum duration is 24 hours')
        }
        if (!params.intervals || params.intervals <= 0) {
          errors.push('Valid number of intervals is required')
        }
        break

      default:
        errors.push(`Unsupported order type: ${orderType}`)
    }

    return errors
  }

  // Validate size skew calculation
  static validateSizeSkew(sizeSkew: number, orderCount: number): boolean {
    if (sizeSkew <= 0) return false
    if (orderCount <= 1) return true // No skew needed for single order
    
    // Test size skew calculation
    let totalSkewFactor = 0
    for (let i = 0; i < orderCount; i++) {
      totalSkewFactor += Math.pow(sizeSkew, i / Math.max(1, orderCount - 1))
    }
    
    // Check if total skew factor is reasonable
    return totalSkewFactor > 0 && totalSkewFactor < orderCount * 10
  }

  // Validate coin size rounding
  static validateCoinSizeRounding(size: number, coin: string): number {
    const baseCoin = coin.toUpperCase().split('-')[0]
    
    switch (baseCoin) {
      case 'DOGE':
        return Math.round(size) // Round to integer
      case 'BTC':
        return Math.round(size * 100000) / 100000 // 5 decimal places
      case 'ETH':
        return Math.round(size * 10000) / 10000 // 4 decimal places
      case 'SOL':
        return Math.round(size * 100) / 100 // 2 decimal places
      default:
        return Math.round(size * 1000000) / 1000000 // 6 decimal places
    }
  }
}

describe('Trading Parameters Collection and Validation', () => {
  let mockState: TradingState

  beforeEach(() => {
    mockState = {
      selectedCoin: 'BTC-PERP',
      marginMode: 'cross',
      leverage: 10,
      orderType: 'market',
      side: 'buy',
      size: '100',
      sizeUnit: 'USD',
      sizePercentage: 50,
      reduceOnly: false,
      takeProfitStopLoss: false,
      limitPrice: '',
      limitPriceManuallySet: false,
      timeInForce: 'GTC',
      stopLossPrice: '',
      takeProfitPrice: '',
      takeProfitGain: '10',
      stopLossLoss: '10',
      scaleStartPrice: '',
      scaleEndPrice: '',
      scaleOrderCount: '5',
      scaleSizeSkew: '1',
      twapRunningTimeHours: '0',
      twapRunningTimeMinutes: '30',
      twapNumberOfIntervals: '10',
      twapOrderType: 'market',
      twapPriceOffset: '0',
      twapRandomize: false
    }
  })

  describe('Parameter Collection', () => {
    it('should collect market order parameters correctly', () => {
      mockState.orderType = 'market'
      mockState.size = '100'
      mockState.sizeUnit = 'USD'

      const params = TradingParamsValidator.collectTradingParams(mockState, 50000)
      
      expect(params.orderType).toBe('market')
      expect(params.size).toBe(0.002) // 100 USD / 50000 BTC price
      expect(params.price).toBe(50000)
    })

    it('should collect limit order parameters correctly', () => {
      mockState.orderType = 'limit'
      mockState.size = '0.001'
      mockState.sizeUnit = 'BTC'
      mockState.limitPrice = '49000'

      const params = TradingParamsValidator.collectTradingParams(mockState, 50000)
      
      expect(params.orderType).toBe('limit')
      expect(params.size).toBe(0.001)
      expect(params.price).toBe(49000)
      expect(params.timeInForce).toBe('GTC')
    })

    it('should collect scale order parameters correctly', () => {
      mockState.orderType = 'scale'
      mockState.size = '1000'
      mockState.sizeUnit = 'USD'
      mockState.scaleStartPrice = '48000'
      mockState.scaleEndPrice = '52000'
      mockState.scaleOrderCount = '5'
      mockState.scaleSizeSkew = '2'

      const params = TradingParamsValidator.collectTradingParams(mockState, 50000)
      
      expect(params.orderType).toBe('scale')
      expect(params.size).toBe(0.02) // 1000 USD / 50000 BTC price
      expect(params.startPrice).toBe(48000)
      expect(params.endPrice).toBe(52000)
      expect(params.orderCount).toBe(5)
      expect(params.sizeSkew).toBe(2)
    })

    it('should collect TWAP order parameters correctly', () => {
      mockState.orderType = 'twap'
      mockState.size = '500'
      mockState.sizeUnit = 'USD'
      mockState.twapRunningTimeHours = '1'
      mockState.twapRunningTimeMinutes = '30'
      mockState.twapNumberOfIntervals = '20'

      const params = TradingParamsValidator.collectTradingParams(mockState, 50000)
      
      expect(params.orderType).toBe('twap')
      expect(params.size).toBe(0.01) // 500 USD / 50000 BTC price
      expect(params.durationMinutes).toBe(90) // 1 hour 30 minutes
      expect(params.intervals).toBe(20)
    })
  })

  describe('Parameter Validation', () => {
    it('should validate market order parameters', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy',
        size: 0.001,
        leverage: 10,
        orderType: 'market',
        price: 50000
      }

      const errors = TradingParamsValidator.validateTradingParams(params, 'market')
      expect(errors).toHaveLength(0)
    })

    it('should validate limit order parameters', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy',
        size: 0.001,
        leverage: 10,
        orderType: 'limit',
        price: 49000,
        timeInForce: 'GTC'
      }

      const errors = TradingParamsValidator.validateTradingParams(params, 'limit')
      expect(errors).toHaveLength(0)
    })

    it('should validate scale order parameters', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy',
        size: 0.02,
        leverage: 10,
        orderType: 'scale',
        startPrice: 48000,
        endPrice: 52000,
        orderCount: 5,
        sizeSkew: 2
      }

      const errors = TradingParamsValidator.validateTradingParams(params, 'scale')
      expect(errors).toHaveLength(0)
    })

    it('should validate TWAP order parameters', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy',
        size: 0.01,
        leverage: 10,
        orderType: 'twap',
        durationMinutes: 90,
        intervals: 20
      }

      const errors = TradingParamsValidator.validateTradingParams(params, 'twap')
      expect(errors).toHaveLength(0)
    })

    it('should catch invalid parameters', () => {
      const params = {
        coin: '',
        side: 'invalid',
        size: -1,
        leverage: 0,
        orderType: 'market',
        price: 0
      }

      const errors = TradingParamsValidator.validateTradingParams(params, 'market')
      expect(errors.length).toBeGreaterThan(0)
      expect(errors).toContain('Coin is required')
      expect(errors).toContain('Valid side (buy/sell) is required')
      expect(errors).toContain('Valid size is required')
      expect(errors).toContain('Valid leverage is required')
    })

    it('should validate scale order price requirements', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy',
        size: 0.02,
        leverage: 10,
        orderType: 'scale',
        startPrice: 50000,
        endPrice: 50000, // Same as start price
        orderCount: 5,
        sizeSkew: 2
      }

      const errors = TradingParamsValidator.validateTradingParams(params, 'scale')
      expect(errors).toContain('Start price and end price must be different')
    })

    it('should validate scale order count limits', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy',
        size: 0.02,
        leverage: 10,
        orderType: 'scale',
        startPrice: 48000,
        endPrice: 52000,
        orderCount: 25, // Exceeds limit
        sizeSkew: 2
      }

      const errors = TradingParamsValidator.validateTradingParams(params, 'scale')
      expect(errors).toContain('Maximum 20 scale orders allowed')
    })

    it('should validate TWAP duration limits', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy',
        size: 0.01,
        leverage: 10,
        orderType: 'twap',
        durationMinutes: 3, // Too short
        intervals: 20
      }

      const errors = TradingParamsValidator.validateTradingParams(params, 'twap')
      expect(errors).toContain('Minimum duration is 5 minutes')
    })
  })

  describe('Size Conversion', () => {
    it('should convert USD to coin units correctly', () => {
      const coinSize = TradingParamsValidator.convertSizeToCoinUnits('100', 'USD', 50000)
      expect(coinSize).toBe(0.002)
    })

    it('should handle coin units directly', () => {
      const coinSize = TradingParamsValidator.convertSizeToCoinUnits('0.001', 'BTC', 50000)
      expect(coinSize).toBe(0.001)
    })

    it('should return 0 for invalid inputs', () => {
      const coinSize = TradingParamsValidator.convertSizeToCoinUnits('invalid', 'USD', 50000)
      expect(coinSize).toBe(0)
    })
  })

  describe('Size Skew Validation', () => {
    it('should validate size skew calculation', () => {
      expect(TradingParamsValidator.validateSizeSkew(1, 5)).toBe(true)
      expect(TradingParamsValidator.validateSizeSkew(2, 5)).toBe(true)
      expect(TradingParamsValidator.validateSizeSkew(0.5, 5)).toBe(true)
      expect(TradingParamsValidator.validateSizeSkew(0, 5)).toBe(false)
      expect(TradingParamsValidator.validateSizeSkew(-1, 5)).toBe(false)
    })

    it('should handle single order size skew', () => {
      expect(TradingParamsValidator.validateSizeSkew(2, 1)).toBe(true)
    })
  })

  describe('Coin Size Rounding', () => {
    it('should round DOGE to integer', () => {
      const rounded = TradingParamsValidator.validateCoinSizeRounding(123.456, 'DOGE-PERP')
      expect(rounded).toBe(123)
    })

    it('should round BTC to 5 decimal places', () => {
      const rounded = TradingParamsValidator.validateCoinSizeRounding(0.123456789, 'BTC-PERP')
      expect(rounded).toBe(0.12346)
    })

    it('should round ETH to 4 decimal places', () => {
      const rounded = TradingParamsValidator.validateCoinSizeRounding(1.23456789, 'ETH-PERP')
      expect(rounded).toBe(1.2346)
    })

    it('should round SOL to 2 decimal places', () => {
      const rounded = TradingParamsValidator.validateCoinSizeRounding(123.456789, 'SOL-PERP')
      expect(rounded).toBe(123.46)
    })

    it('should round other coins to 6 decimal places', () => {
      const rounded = TradingParamsValidator.validateCoinSizeRounding(0.123456789, 'ADA-PERP')
      expect(rounded).toBe(0.123457)
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero prices', () => {
      const coinSize = TradingParamsValidator.convertSizeToCoinUnits('100', 'USD', 0)
      expect(coinSize).toBe(0)
    })

    it('should handle negative prices', () => {
      const coinSize = TradingParamsValidator.convertSizeToCoinUnits('100', 'USD', -50000)
      expect(coinSize).toBe(0)
    })

    it('should handle very small sizes', () => {
      const coinSize = TradingParamsValidator.convertSizeToCoinUnits('0.000001', 'USD', 50000)
      expect(coinSize).toBeCloseTo(0.00000002, 5)
    })

    it('should handle very large sizes', () => {
      const coinSize = TradingParamsValidator.convertSizeToCoinUnits('1000000', 'USD', 50000)
      expect(coinSize).toBe(20)
    })
  })
})
