import { describe, it, expect, beforeEach } from 'vitest'

// Mock the actual validation functions from the codebase
interface OrderValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

class OrderValidator {
  // Validate market order parameters
  static validateMarketOrder(params: {
    coin: string
    side: 'buy' | 'sell'
    size: number
    leverage: number
    currentPrice: number
  }): OrderValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

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

    if (!params.currentPrice || params.currentPrice <= 0) {
      errors.push('Current price is required for market orders')
    }

    // Check minimum order value (should be > 10 USD)
    const orderValue = params.size * params.currentPrice
    if (orderValue > 0 && orderValue < 10) {
      errors.push('Order value must be at least $10')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // Validate limit order parameters
  static validateLimitOrder(params: {
    coin: string
    side: 'buy' | 'sell'
    size: number
    leverage: number
    limitPrice: number
    currentPrice: number
    timeInForce: string
  }): OrderValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Basic validations
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

    if (!params.limitPrice || params.limitPrice <= 0) {
      errors.push('Valid limit price is required')
    }

    if (!params.timeInForce || !['GTC', 'IOC', 'ALO'].includes(params.timeInForce)) {
      errors.push('Valid time in force is required')
    }

    // Check minimum order value
    const orderValue = params.size * params.limitPrice
    if (orderValue > 0 && orderValue < 10) {
      errors.push('Order value must be at least $10')
    }

    // Check if limit price is reasonable compared to current price
    if (params.currentPrice > 0) {
      const priceDiff = Math.abs(params.limitPrice - params.currentPrice) / params.currentPrice
      if (priceDiff > 0.1) { // More than 10% difference
        warnings.push('Limit price is significantly different from current price')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // Validate scale order parameters
  static validateScaleOrder(params: {
    coin: string
    side: 'buy' | 'sell'
    size: number
    leverage: number
    startPrice: number
    endPrice: number
    orderCount: number
    sizeSkew: number
  }): OrderValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Basic validations
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

    // Scale order specific validations
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

    // Check minimum order value per sub-order
    const avgPrice = (params.startPrice + params.endPrice) / 2
    const orderValue = params.size * avgPrice
    if (orderValue > 0 && orderValue < 10) {
      errors.push('Order value must be at least $10')
    }

    // Check if size skew is reasonable
    if (params.sizeSkew > 10) {
      warnings.push('Size skew is very high, which may create extreme size differences')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // Validate TWAP order parameters
  static validateTwapOrder(params: {
    coin: string
    side: 'buy' | 'sell'
    size: number
    leverage: number
    durationMinutes: number
    intervals: number
    orderType: string
  }): OrderValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Basic validations
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

    // TWAP specific validations
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

    // Check minimum sub-order value
    const subOrderSize = params.size / params.intervals
    if (subOrderSize < 0.001) {
      warnings.push('Sub-order size is very small, which may cause issues')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // Validate size conversion from USD to coin units
  static validateSizeConversion(
    size: string,
    sizeUnit: string,
    currentPrice: number,
    coin: string
  ): { isValid: boolean; convertedSize: number; errors: string[] } {
    const errors: string[] = []
    let convertedSize = 0

    const sizeValue = parseFloat(size)
    if (isNaN(sizeValue) || sizeValue <= 0) {
      errors.push('Valid size is required')
      return { isValid: false, convertedSize: 0, errors }
    }

    if (sizeUnit === 'USD') {
      if (!currentPrice || currentPrice <= 0) {
        errors.push('Current price is required for USD size conversion')
        return { isValid: false, convertedSize: 0, errors }
      }
      convertedSize = sizeValue / currentPrice
    } else {
      convertedSize = sizeValue
    }

    // Validate converted size is reasonable
    if (convertedSize <= 0) {
      errors.push('Converted size must be greater than 0')
    }

    return {
      isValid: errors.length === 0,
      convertedSize,
      errors
    }
  }
}

describe('Order Parameter Validation', () => {
  describe('Market Order Validation', () => {
    it('should validate valid market order', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy' as const,
        size: 0.001,
        leverage: 10,
        currentPrice: 50000
      }

      const result = OrderValidator.validateMarketOrder(params)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should catch invalid market order parameters', () => {
      const params = {
        coin: '',
        side: 'invalid' as any,
        size: -1,
        leverage: 0,
        currentPrice: 0
      }

      const result = OrderValidator.validateMarketOrder(params)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Coin is required')
      expect(result.errors).toContain('Valid side (buy/sell) is required')
      expect(result.errors).toContain('Valid size is required')
      expect(result.errors).toContain('Valid leverage is required')
    })

    it('should catch minimum order value requirement', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy' as const,
        size: 0.0001, // Very small size
        leverage: 10,
        currentPrice: 50000
      }

      const result = OrderValidator.validateMarketOrder(params)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Order value must be at least $10')
    })
  })

  describe('Limit Order Validation', () => {
    it('should validate valid limit order', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy' as const,
        size: 0.001,
        leverage: 10,
        limitPrice: 49000,
        currentPrice: 50000,
        timeInForce: 'GTC'
      }

      const result = OrderValidator.validateLimitOrder(params)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should warn about significant price difference', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy' as const,
        size: 0.001,
        leverage: 10,
        limitPrice: 40000, // 20% below current price
        currentPrice: 50000,
        timeInForce: 'GTC'
      }

      const result = OrderValidator.validateLimitOrder(params)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('Limit price is significantly different from current price')
    })
  })

  describe('Scale Order Validation', () => {
    it('should validate valid scale order', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy' as const,
        size: 0.02,
        leverage: 10,
        startPrice: 48000,
        endPrice: 52000,
        orderCount: 5,
        sizeSkew: 2
      }

      const result = OrderValidator.validateScaleOrder(params)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should catch same start and end prices', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy' as const,
        size: 0.02,
        leverage: 10,
        startPrice: 50000,
        endPrice: 50000, // Same as start price
        orderCount: 5,
        sizeSkew: 2
      }

      const result = OrderValidator.validateScaleOrder(params)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Start price and end price must be different')
    })

    it('should catch excessive order count', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy' as const,
        size: 0.02,
        leverage: 10,
        startPrice: 48000,
        endPrice: 52000,
        orderCount: 25, // Exceeds limit
        sizeSkew: 2
      }

      const result = OrderValidator.validateScaleOrder(params)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Maximum 20 scale orders allowed')
    })

    it('should warn about high size skew', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy' as const,
        size: 0.02,
        leverage: 10,
        startPrice: 48000,
        endPrice: 52000,
        orderCount: 5,
        sizeSkew: 15 // Very high skew
      }

      const result = OrderValidator.validateScaleOrder(params)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('Size skew is very high, which may create extreme size differences')
    })
  })

  describe('TWAP Order Validation', () => {
    it('should validate valid TWAP order', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy' as const,
        size: 0.01,
        leverage: 10,
        durationMinutes: 90,
        intervals: 20,
        orderType: 'market'
      }

      const result = OrderValidator.validateTwapOrder(params)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should catch duration limits', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy' as const,
        size: 0.01,
        leverage: 10,
        durationMinutes: 3, // Too short
        intervals: 20,
        orderType: 'market'
      }

      const result = OrderValidator.validateTwapOrder(params)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Minimum duration is 5 minutes')
    })

    it('should catch maximum duration', () => {
      const params = {
        coin: 'BTC-PERP',
        side: 'buy' as const,
        size: 0.01,
        leverage: 10,
        durationMinutes: 1500, // Too long
        intervals: 20,
        orderType: 'market'
      }

      const result = OrderValidator.validateTwapOrder(params)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Maximum duration is 24 hours')
    })
  })

  describe('Size Conversion Validation', () => {
    it('should convert USD to coin units correctly', () => {
      const result = OrderValidator.validateSizeConversion('100', 'USD', 50000, 'BTC-PERP')
      expect(result.isValid).toBe(true)
      expect(result.convertedSize).toBe(0.002)
    })

    it('should handle coin units directly', () => {
      const result = OrderValidator.validateSizeConversion('0.001', 'BTC', 50000, 'BTC-PERP')
      expect(result.isValid).toBe(true)
      expect(result.convertedSize).toBe(0.001)
    })

    it('should catch invalid size conversion', () => {
      const result = OrderValidator.validateSizeConversion('invalid', 'USD', 50000, 'BTC-PERP')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Valid size is required')
    })

    it('should catch missing current price for USD conversion', () => {
      const result = OrderValidator.validateSizeConversion('100', 'USD', 0, 'BTC-PERP')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Current price is required for USD size conversion')
    })
  })

  describe('Edge Cases', () => {
    it('should handle very small sizes', () => {
      const result = OrderValidator.validateSizeConversion('0.000001', 'USD', 50000, 'BTC-PERP')
      expect(result.isValid).toBe(true)
      expect(result.convertedSize).toBeCloseTo(0.00000002, 5)
    })

    it('should handle very large sizes', () => {
      const result = OrderValidator.validateSizeConversion('1000000', 'USD', 50000, 'BTC-PERP')
      expect(result.isValid).toBe(true)
      expect(result.convertedSize).toBe(20)
    })

    it('should handle negative prices', () => {
      const result = OrderValidator.validateSizeConversion('100', 'USD', -50000, 'BTC-PERP')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Current price is required for USD size conversion')
    })
  })
})
