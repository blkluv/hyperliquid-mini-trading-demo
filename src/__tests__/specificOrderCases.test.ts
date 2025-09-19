import { describe, it, expect } from 'vitest'

// Mock order validation and processing functions
interface OrderParams {
  type: string
  coin: string
  side: 'buy' | 'sell'
  size: number
  price?: number
  minPrice?: number
  maxPrice?: number
  slices?: number
  interval?: number
  tickSize?: number
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

class OrderValidator {
  // Validate market order
  static validateMarketOrder(order: OrderParams, currentPrice?: number): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!order.coin) {
      errors.push('Coin is required')
    }

    if (!order.side || !['buy', 'sell'].includes(order.side)) {
      errors.push('Valid side is required')
    }

    if (!order.size || order.size <= 0) {
      errors.push('Valid size is required')
    }

    if (order.size < 0) {
      errors.push('Size cannot be negative')
    }

    // Market orders should not have price
    if (order.price !== undefined) {
      warnings.push('Market orders should not specify price')
    }

    if (!currentPrice || currentPrice <= 0) {
      errors.push('Current price is required for market orders')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // Validate limit order
  static validateLimitOrder(order: OrderParams, tickSize?: number): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!order.coin) {
      errors.push('Coin is required')
    }

    if (!order.side || !['buy', 'sell'].includes(order.side)) {
      errors.push('Valid side is required')
    }

    if (!order.size || order.size <= 0) {
      errors.push('Valid size is required')
    }

    if (order.size < 0) {
      errors.push('Size cannot be negative')
    }

    if (!order.price || order.price <= 0) {
      errors.push('Valid price is required for limit orders')
    }

    // Check tick size alignment
    if (order.price && tickSize && tickSize > 0) {
      const remainder = order.price % tickSize
      if (remainder > 0.0000001) { // Allow for floating point precision
        errors.push(`Price ${order.price} is not aligned with tick size ${tickSize}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // Validate scale order
  static validateScaleOrder(order: OrderParams, tickSize?: number): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!order.coin) {
      errors.push('Coin is required')
    }

    if (!order.side || !['buy', 'sell'].includes(order.side)) {
      errors.push('Valid side is required')
    }

    if (!order.size || order.size <= 0) {
      errors.push('Valid size is required')
    }

    if (order.size < 0) {
      errors.push('Size cannot be negative')
    }

    if (!order.minPrice || order.minPrice <= 0) {
      errors.push('Valid minPrice is required')
    }

    if (!order.maxPrice || order.maxPrice <= 0) {
      errors.push('Valid maxPrice is required')
    }

    if (order.minPrice && order.maxPrice && order.minPrice === order.maxPrice) {
      errors.push('MinPrice and maxPrice must be different')
    }

    if (order.minPrice && order.maxPrice && order.minPrice > order.maxPrice) {
      errors.push('MinPrice must be less than maxPrice')
    }

    if (!order.slices || order.slices <= 0) {
      errors.push('Valid slices count is required')
    }

    // Check tick size alignment for prices
    if (tickSize && tickSize > 0) {
      if (order.minPrice) {
        const remainder = order.minPrice % tickSize
        if (remainder > 0.0000001) {
          errors.push(`MinPrice ${order.minPrice} is not aligned with tick size ${tickSize}`)
        }
      }
      if (order.maxPrice) {
        const remainder = order.maxPrice % tickSize
        if (remainder > 0.0000001) {
          errors.push(`MaxPrice ${order.maxPrice} is not aligned with tick size ${tickSize}`)
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // Validate TWAP order
  static validateTwapOrder(order: OrderParams, tickSize?: number): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!order.coin) {
      errors.push('Coin is required')
    }

    if (!order.side || !['buy', 'sell'].includes(order.side)) {
      errors.push('Valid side is required')
    }

    if (!order.size || order.size <= 0) {
      errors.push('Valid size is required')
    }

    if (order.size < 0) {
      errors.push('Size cannot be negative')
    }

    if (!order.price || order.price <= 0) {
      errors.push('Valid price is required for TWAP orders')
    }

    if (!order.interval || order.interval <= 0) {
      errors.push('Valid interval is required for TWAP orders')
    }

    // Check tick size alignment
    if (order.price && tickSize && tickSize > 0) {
      const remainder = order.price % tickSize
      if (remainder > 0.0000001) {
        errors.push(`Price ${order.price} is not aligned with tick size ${tickSize}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // Validate order type
  static validateOrderType(order: OrderParams): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    const validTypes = ['market', 'limit', 'scale', 'twap']
    if (!order.type || !validTypes.includes(order.type)) {
      errors.push(`Invalid order type: ${order.type}. Valid types are: ${validTypes.join(', ')}`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
}

describe('Specific Order Test Cases', () => {
  describe('Market Order Cases', () => {
    it('should validate market order without price', () => {
      const order: OrderParams = {
        type: 'market',
        coin: 'BTC-PERP',
        side: 'buy',
        size: 0.01
      }

      const result = OrderValidator.validateMarketOrder(order, 50000)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should warn about market order with price', () => {
      const order: OrderParams = {
        type: 'market',
        coin: 'BTC-PERP',
        side: 'buy',
        size: 0.01,
        price: 25000
      }

      const result = OrderValidator.validateMarketOrder(order, 50000)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toContain('Market orders should not specify price')
    })
  })

  describe('Limit Order Cases', () => {
    it('should validate limit order with perfect tick alignment', () => {
      const order: OrderParams = {
        type: 'limit',
        coin: 'BTC-PERP',
        side: 'sell',
        size: 0.5,
        price: 30000,
        tickSize: 0.5
      }

      const result = OrderValidator.validateLimitOrder(order, 0.5)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should catch limit order with price off tick size', () => {
      const order: OrderParams = {
        type: 'limit',
        coin: 'BTC-PERP',
        side: 'sell',
        size: 0.5,
        price: 30000.3,
        tickSize: 0.5
      }

      const result = OrderValidator.validateLimitOrder(order, 0.5)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Price 30000.3 is not aligned with tick size 0.5')
    })

    it('should catch limit order without price', () => {
      const order: OrderParams = {
        type: 'limit',
        coin: 'BTC-PERP',
        side: 'sell',
        size: 0.5,
        tickSize: 0.5
      }

      const result = OrderValidator.validateLimitOrder(order, 0.5)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Valid price is required for limit orders')
    })
  })

  describe('Scale Order Cases', () => {
    it('should validate scale order with valid range', () => {
      const order: OrderParams = {
        type: 'scale',
        coin: 'ETH-PERP',
        side: 'buy',
        size: 10,
        minPrice: 1500,
        maxPrice: 1600,
        slices: 5,
        tickSize: 1
      }

      const result = OrderValidator.validateScaleOrder(order, 1)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should catch scale order with reversed range', () => {
      const order: OrderParams = {
        type: 'scale',
        coin: 'ETH-PERP',
        side: 'buy',
        size: 10,
        minPrice: 1600,
        maxPrice: 1500,
        slices: 5,
        tickSize: 1
      }

      const result = OrderValidator.validateScaleOrder(order, 1)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('MinPrice must be less than maxPrice')
    })

    it('should catch scale order without slices', () => {
      const order: OrderParams = {
        type: 'scale',
        coin: 'ETH-PERP',
        side: 'buy',
        size: 10,
        minPrice: 1500,
        maxPrice: 1600,
        tickSize: 1
      }

      const result = OrderValidator.validateScaleOrder(order, 1)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Valid slices count is required')
    })

    it('should catch scale order with minPrice not divisible by tick size', () => {
      const order: OrderParams = {
        type: 'scale',
        coin: 'ETH-PERP',
        side: 'buy',
        size: 10,
        minPrice: 1500.3,
        maxPrice: 1600,
        slices: 4,
        tickSize: 0.5
      }

      const result = OrderValidator.validateScaleOrder(order, 0.5)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('MinPrice 1500.3 is not aligned with tick size 0.5')
    })
  })

  describe('TWAP Order Cases', () => {
    it('should validate TWAP order with correct tick', () => {
      const order: OrderParams = {
        type: 'twap',
        coin: 'BTC-PERP',
        side: 'sell',
        size: 1,
        price: 20000.5,
        interval: 60,
        tickSize: 0.5
      }

      const result = OrderValidator.validateTwapOrder(order, 0.5)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should catch TWAP order with price off tick', () => {
      const order: OrderParams = {
        type: 'twap',
        coin: 'BTC-PERP',
        side: 'sell',
        size: 1,
        price: 20000.3,
        interval: 60,
        tickSize: 0.5
      }

      const result = OrderValidator.validateTwapOrder(order, 0.5)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Price 20000.3 is not aligned with tick size 0.5')
    })

    it('should catch TWAP order without interval', () => {
      const order: OrderParams = {
        type: 'twap',
        coin: 'BTC-PERP',
        side: 'sell',
        size: 1,
        price: 20000.5,
        tickSize: 0.5
      }

      const result = OrderValidator.validateTwapOrder(order, 0.5)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Valid interval is required for TWAP orders')
    })

    it('should catch TWAP order without price', () => {
      const order: OrderParams = {
        type: 'twap',
        coin: 'BTC-PERP',
        side: 'sell',
        size: 1,
        interval: 60,
        tickSize: 0.5
      }

      const result = OrderValidator.validateTwapOrder(order, 0.5)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Valid price is required for TWAP orders')
    })
  })

  describe('General Order Cases', () => {
    it('should catch unknown order type', () => {
      const order: OrderParams = {
        type: 'iceberg',
        coin: 'BTC-PERP',
        side: 'buy',
        size: 1
      }

      const result = OrderValidator.validateOrderType(order)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid order type: iceberg. Valid types are: market, limit, scale, twap')
    })

    it('should catch order without coin', () => {
      const order: OrderParams = {
        type: 'limit',
        side: 'buy',
        size: 1,
        price: 1000,
        tickSize: 1
      }

      const result = OrderValidator.validateLimitOrder(order, 1)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Coin is required')
    })

    it('should catch order with negative size', () => {
      const order: OrderParams = {
        type: 'market',
        coin: 'BTC-PERP',
        side: 'buy',
        size: -5
      }

      const result = OrderValidator.validateMarketOrder(order, 50000)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Size cannot be negative')
    })
  })

  describe('Edge Cases', () => {
    it('should handle floating point precision in tick alignment', () => {
      const order: OrderParams = {
        type: 'limit',
        coin: 'BTC-PERP',
        side: 'sell',
        size: 0.5,
        price: 30000.00000001, // Very small floating point error
        tickSize: 0.5
      }

      const result = OrderValidator.validateLimitOrder(order, 0.5)
      expect(result.isValid).toBe(true) // Should pass due to precision tolerance
    })

    it('should handle zero tick size', () => {
      const order: OrderParams = {
        type: 'limit',
        coin: 'BTC-PERP',
        side: 'sell',
        size: 0.5,
        price: 30000.3,
        tickSize: 0
      }

      const result = OrderValidator.validateLimitOrder(order, 0)
      expect(result.isValid).toBe(true) // Should pass when tick size is 0
    })

    it('should handle undefined tick size', () => {
      const order: OrderParams = {
        type: 'limit',
        coin: 'BTC-PERP',
        side: 'sell',
        size: 0.5,
        price: 30000.3
      }

      const result = OrderValidator.validateLimitOrder(order)
      expect(result.isValid).toBe(true) // Should pass when tick size is undefined
    })
  })
})
