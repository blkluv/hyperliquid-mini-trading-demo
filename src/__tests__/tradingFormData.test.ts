import { describe, it, expect, beforeEach } from 'vitest'

// Mock form data collection and processing
interface FormData {
  selectedCoin: string
  marginMode: 'isolated' | 'cross'
  leverage: number
  orderType: 'market' | 'limit' | 'scale' | 'twap'
  side: 'buy' | 'sell'
  size: string
  sizeUnit: 'USD' | string
  reduceOnly: boolean
  limitPrice: string
  timeInForce: 'GTC' | 'IOC' | 'ALO'
  // Scale order fields
  scaleStartPrice: string
  scaleEndPrice: string
  scaleOrderCount: string
  scaleSizeSkew: string
  // TWAP order fields
  twapRunningTimeHours: string
  twapRunningTimeMinutes: string
  twapNumberOfIntervals: string
  twapOrderType: 'market' | 'limit'
  twapPriceOffset: string
}

class TradingFormProcessor {
  // Process form data into trading parameters
  static processFormData(formData: FormData, currentPrice?: number) {
    const baseParams = {
      coin: formData.selectedCoin,
      side: formData.side,
      reduceOnly: formData.reduceOnly,
      leverage: formData.leverage
    }

    // Convert size to coin units
    const size = this.convertSizeToCoinUnits(
      formData.size,
      formData.sizeUnit,
      currentPrice
    )

    switch (formData.orderType) {
      case 'market':
        return {
          ...baseParams,
          orderType: 'market',
          size,
          price: currentPrice
        }

      case 'limit':
        return {
          ...baseParams,
          orderType: 'limit',
          size,
          price: parseFloat(formData.limitPrice),
          timeInForce: formData.timeInForce
        }

      case 'scale':
        return {
          ...baseParams,
          orderType: 'scale',
          size,
          startPrice: parseFloat(formData.scaleStartPrice),
          endPrice: parseFloat(formData.scaleEndPrice),
          orderCount: parseInt(formData.scaleOrderCount),
          sizeSkew: parseFloat(formData.scaleSizeSkew)
        }

      case 'twap':
        return {
          ...baseParams,
          orderType: 'twap',
          size,
          durationMinutes: (parseInt(formData.twapRunningTimeHours) * 60) + 
                           parseInt(formData.twapRunningTimeMinutes),
          intervals: parseInt(formData.twapNumberOfIntervals),
          twapOrderType: formData.twapOrderType,
          priceOffset: parseFloat(formData.twapPriceOffset)
        }

      default:
        throw new Error(`Unsupported order type: ${formData.orderType}`)
    }
  }

  // Convert size to coin units
  static convertSizeToCoinUnits(size: string, sizeUnit: string, currentPrice?: number): number {
    const sizeValue = parseFloat(size)
    if (isNaN(sizeValue) || sizeValue <= 0) return 0

    if (sizeUnit === 'USD') {
      if (!currentPrice || currentPrice <= 0) return 0
      return sizeValue / currentPrice
    } else {
      return sizeValue
    }
  }

  // Validate form data
  static validateFormData(formData: FormData, currentPrice?: number): string[] {
    const errors: string[] = []

    // Common validations
    if (!formData.selectedCoin) {
      errors.push('Coin selection is required')
    }

    if (!formData.side || !['buy', 'sell'].includes(formData.side)) {
      errors.push('Valid side selection is required')
    }

    if (!formData.size || formData.size.trim() === '') {
      errors.push('Size is required')
    } else {
      const sizeValue = parseFloat(formData.size)
      if (isNaN(sizeValue) || sizeValue <= 0) {
        errors.push('Valid size is required')
      }
    }

    if (!formData.leverage || formData.leverage <= 0) {
      errors.push('Valid leverage is required')
    }

    // Order type specific validations
    switch (formData.orderType) {
      case 'limit':
        if (!formData.limitPrice || formData.limitPrice.trim() === '') {
          errors.push('Limit price is required')
        } else {
          const limitPrice = parseFloat(formData.limitPrice)
          if (isNaN(limitPrice) || limitPrice <= 0) {
            errors.push('Valid limit price is required')
          }
        }
        break

      case 'scale':
        if (!formData.scaleStartPrice || formData.scaleStartPrice.trim() === '') {
          errors.push('Scale start price is required')
        } else {
          const startPrice = parseFloat(formData.scaleStartPrice)
          if (isNaN(startPrice) || startPrice <= 0) {
            errors.push('Valid scale start price is required')
          }
        }

        if (!formData.scaleEndPrice || formData.scaleEndPrice.trim() === '') {
          errors.push('Scale end price is required')
        } else {
          const endPrice = parseFloat(formData.scaleEndPrice)
          if (isNaN(endPrice) || endPrice <= 0) {
            errors.push('Valid scale end price is required')
          }
        }

        if (formData.scaleStartPrice && formData.scaleEndPrice) {
          const startPrice = parseFloat(formData.scaleStartPrice)
          const endPrice = parseFloat(formData.scaleEndPrice)
          if (!isNaN(startPrice) && !isNaN(endPrice) && startPrice === endPrice) {
            errors.push('Start price and end price must be different')
          }
        }

        if (!formData.scaleOrderCount || formData.scaleOrderCount.trim() === '') {
          errors.push('Scale order count is required')
        } else {
          const orderCount = parseInt(formData.scaleOrderCount)
          if (isNaN(orderCount) || orderCount <= 0) {
            errors.push('Valid scale order count is required')
          } else if (orderCount > 20) {
            errors.push('Maximum 20 scale orders allowed')
          }
        }

        if (!formData.scaleSizeSkew || formData.scaleSizeSkew.trim() === '') {
          errors.push('Scale size skew is required')
        } else {
          const sizeSkew = parseFloat(formData.scaleSizeSkew)
          if (isNaN(sizeSkew) || sizeSkew <= 0) {
            errors.push('Valid scale size skew is required')
          }
        }
        break

      case 'twap':
        if (!formData.twapRunningTimeHours || formData.twapRunningTimeHours.trim() === '') {
          errors.push('TWAP running time hours is required')
        } else {
          const hours = parseInt(formData.twapRunningTimeHours)
          if (isNaN(hours) || hours < 0) {
            errors.push('Valid TWAP running time hours is required')
          }
        }

        if (!formData.twapRunningTimeMinutes || formData.twapRunningTimeMinutes.trim() === '') {
          errors.push('TWAP running time minutes is required')
        } else {
          const minutes = parseInt(formData.twapRunningTimeMinutes)
          if (isNaN(minutes) || minutes < 0) {
            errors.push('Valid TWAP running time minutes is required')
          }
        }

        if (formData.twapRunningTimeHours && formData.twapRunningTimeMinutes) {
          const hours = parseInt(formData.twapRunningTimeHours)
          const minutes = parseInt(formData.twapRunningTimeMinutes)
          const totalMinutes = (hours * 60) + minutes
          
          if (totalMinutes < 5) {
            errors.push('Minimum TWAP duration is 5 minutes')
          }
          if (totalMinutes > 1440) {
            errors.push('Maximum TWAP duration is 24 hours')
          }
        }

        if (!formData.twapNumberOfIntervals || formData.twapNumberOfIntervals.trim() === '') {
          errors.push('TWAP number of intervals is required')
        } else {
          const intervals = parseInt(formData.twapNumberOfIntervals)
          if (isNaN(intervals) || intervals <= 0) {
            errors.push('Valid TWAP number of intervals is required')
          }
        }
        break
    }

    return errors
  }
}

describe('Trading Form Data Processing', () => {
  let mockFormData: FormData

  beforeEach(() => {
    mockFormData = {
      selectedCoin: 'BTC-PERP',
      marginMode: 'cross',
      leverage: 10,
      orderType: 'market',
      side: 'buy',
      size: '100',
      sizeUnit: 'USD',
      reduceOnly: false,
      limitPrice: '',
      timeInForce: 'GTC',
      scaleStartPrice: '',
      scaleEndPrice: '',
      scaleOrderCount: '5',
      scaleSizeSkew: '1',
      twapRunningTimeHours: '0',
      twapRunningTimeMinutes: '30',
      twapNumberOfIntervals: '10',
      twapOrderType: 'market',
      twapPriceOffset: '0'
    }
  })

  describe('Form Data Processing', () => {
    it('should process market order form data correctly', () => {
      mockFormData.orderType = 'market'
      mockFormData.size = '100'
      mockFormData.sizeUnit = 'USD'

      const result = TradingFormProcessor.processFormData(mockFormData, 50000)
      
      expect(result.orderType).toBe('market')
      expect(result.size).toBe(0.002) // 100 USD / 50000 BTC price
      expect(result.price).toBe(50000)
    })

    it('should process limit order form data correctly', () => {
      mockFormData.orderType = 'limit'
      mockFormData.size = '0.001'
      mockFormData.sizeUnit = 'BTC'
      mockFormData.limitPrice = '49000'

      const result = TradingFormProcessor.processFormData(mockFormData, 50000)
      
      expect(result.orderType).toBe('limit')
      expect(result.size).toBe(0.001)
      expect(result.price).toBe(49000)
      expect(result.timeInForce).toBe('GTC')
    })

    it('should process scale order form data correctly', () => {
      mockFormData.orderType = 'scale'
      mockFormData.size = '1000'
      mockFormData.sizeUnit = 'USD'
      mockFormData.scaleStartPrice = '48000'
      mockFormData.scaleEndPrice = '52000'
      mockFormData.scaleOrderCount = '5'
      mockFormData.scaleSizeSkew = '2'

      const result = TradingFormProcessor.processFormData(mockFormData, 50000)
      
      expect(result.orderType).toBe('scale')
      expect(result.size).toBe(0.02) // 1000 USD / 50000 BTC price
      expect(result.startPrice).toBe(48000)
      expect(result.endPrice).toBe(52000)
      expect(result.orderCount).toBe(5)
      expect(result.sizeSkew).toBe(2)
    })

    it('should process TWAP order form data correctly', () => {
      mockFormData.orderType = 'twap'
      mockFormData.size = '500'
      mockFormData.sizeUnit = 'USD'
      mockFormData.twapRunningTimeHours = '1'
      mockFormData.twapRunningTimeMinutes = '30'
      mockFormData.twapNumberOfIntervals = '20'

      const result = TradingFormProcessor.processFormData(mockFormData, 50000)
      
      expect(result.orderType).toBe('twap')
      expect(result.size).toBe(0.01) // 500 USD / 50000 BTC price
      expect(result.durationMinutes).toBe(90) // 1 hour 30 minutes
      expect(result.intervals).toBe(20)
    })
  })

  describe('Form Data Validation', () => {
    it('should validate valid market order form data', () => {
      mockFormData.orderType = 'market'
      mockFormData.size = '100'
      mockFormData.sizeUnit = 'USD'

      const errors = TradingFormProcessor.validateFormData(mockFormData, 50000)
      expect(errors).toHaveLength(0)
    })

    it('should validate valid limit order form data', () => {
      mockFormData.orderType = 'limit'
      mockFormData.size = '0.001'
      mockFormData.sizeUnit = 'BTC'
      mockFormData.limitPrice = '49000'

      const errors = TradingFormProcessor.validateFormData(mockFormData, 50000)
      expect(errors).toHaveLength(0)
    })

    it('should validate valid scale order form data', () => {
      mockFormData.orderType = 'scale'
      mockFormData.size = '1000'
      mockFormData.sizeUnit = 'USD'
      mockFormData.scaleStartPrice = '48000'
      mockFormData.scaleEndPrice = '52000'
      mockFormData.scaleOrderCount = '5'
      mockFormData.scaleSizeSkew = '2'

      const errors = TradingFormProcessor.validateFormData(mockFormData, 50000)
      expect(errors).toHaveLength(0)
    })

    it('should validate valid TWAP order form data', () => {
      mockFormData.orderType = 'twap'
      mockFormData.size = '500'
      mockFormData.sizeUnit = 'USD'
      mockFormData.twapRunningTimeHours = '1'
      mockFormData.twapRunningTimeMinutes = '30'
      mockFormData.twapNumberOfIntervals = '20'

      const errors = TradingFormProcessor.validateFormData(mockFormData, 50000)
      expect(errors).toHaveLength(0)
    })

    it('should catch invalid form data', () => {
      mockFormData.selectedCoin = ''
      mockFormData.side = 'invalid' as any
      mockFormData.size = ''
      mockFormData.leverage = 0

      const errors = TradingFormProcessor.validateFormData(mockFormData, 50000)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors).toContain('Coin selection is required')
      expect(errors).toContain('Valid side selection is required')
      expect(errors).toContain('Size is required')
      expect(errors).toContain('Valid leverage is required')
    })

    it('should catch scale order specific errors', () => {
      mockFormData.orderType = 'scale'
      mockFormData.scaleStartPrice = '50000'
      mockFormData.scaleEndPrice = '50000' // Same as start price
      mockFormData.scaleOrderCount = '25' // Exceeds limit
      mockFormData.scaleSizeSkew = '0' // Invalid

      const errors = TradingFormProcessor.validateFormData(mockFormData, 50000)
      expect(errors).toContain('Start price and end price must be different')
      expect(errors).toContain('Maximum 20 scale orders allowed')
      expect(errors).toContain('Valid scale size skew is required')
    })

    it('should catch TWAP order specific errors', () => {
      mockFormData.orderType = 'twap'
      mockFormData.twapRunningTimeHours = '0'
      mockFormData.twapRunningTimeMinutes = '3' // Too short
      mockFormData.twapNumberOfIntervals = '0' // Invalid

      const errors = TradingFormProcessor.validateFormData(mockFormData, 50000)
      expect(errors).toContain('Minimum TWAP duration is 5 minutes')
      expect(errors).toContain('Valid TWAP number of intervals is required')
    })
  })

  describe('Size Conversion', () => {
    it('should convert USD to coin units correctly', () => {
      const result = TradingFormProcessor.convertSizeToCoinUnits('100', 'USD', 50000)
      expect(result).toBe(0.002)
    })

    it('should handle coin units directly', () => {
      const result = TradingFormProcessor.convertSizeToCoinUnits('0.001', 'BTC', 50000)
      expect(result).toBe(0.001)
    })

    it('should return 0 for invalid inputs', () => {
      const result = TradingFormProcessor.convertSizeToCoinUnits('invalid', 'USD', 50000)
      expect(result).toBe(0)
    })

    it('should return 0 for zero or negative prices', () => {
      const result = TradingFormProcessor.convertSizeToCoinUnits('100', 'USD', 0)
      expect(result).toBe(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty form data', () => {
      const emptyFormData: FormData = {
        selectedCoin: '',
        marginMode: 'cross',
        leverage: 0,
        orderType: 'market',
        side: 'buy',
        size: '',
        sizeUnit: 'USD',
        reduceOnly: false,
        limitPrice: '',
        timeInForce: 'GTC',
        scaleStartPrice: '',
        scaleEndPrice: '',
        scaleOrderCount: '',
        scaleSizeSkew: '',
        twapRunningTimeHours: '',
        twapRunningTimeMinutes: '',
        twapNumberOfIntervals: '',
        twapOrderType: 'market',
        twapPriceOffset: ''
      }

      const errors = TradingFormProcessor.validateFormData(emptyFormData, 50000)
      expect(errors.length).toBeGreaterThan(0)
    })

    it('should handle very large numbers', () => {
      mockFormData.size = '1000000'
      mockFormData.sizeUnit = 'USD'

      const result = TradingFormProcessor.processFormData(mockFormData, 50000)
      expect(result.size).toBe(20) // 1000000 USD / 50000 BTC price
    })

    it('should handle very small numbers', () => {
      mockFormData.size = '0.000001'
      mockFormData.sizeUnit = 'USD'

      const result = TradingFormProcessor.processFormData(mockFormData, 50000)
      expect(result.size).toBeCloseTo(0.00000002, 5) // 0.000001 USD / 50000 BTC price
    })
  })
})
