import { describe, it, expect, vi, beforeEach } from 'vitest'
import { 
  HyperliquidPrecision,
  formatHyperliquidPriceSync,
  formatHyperliquidSizeSync,
  validateHyperliquidPriceSync,
  validateHyperliquidSizeSync
} from '../utils/hyperliquidPrecision'

describe('HyperliquidPrecision', () => {
  beforeEach(() => {
    // Mock fetch for API calls
    global.fetch = vi.fn()
  })

  describe('formatPrice', () => {
    it('should format BTC price correctly', () => {
      const assetInfo = { szDecimals: 5, pxDecimals: 1, isPerp: true }
      const price = 50000.123456
      const result = HyperliquidPrecision.formatPrice(price, assetInfo)
      expect(result).toBe('50000.0') // 5 significant digits, 1 decimal place (pxDecimals=1)
    })

    it('should format ETH price correctly', () => {
      const assetInfo = { szDecimals: 2, pxDecimals: 2, isPerp: true }
      const price = 3000.123456
      const result = HyperliquidPrecision.formatPrice(price, assetInfo)
      expect(result).toBe('3000.10') // 5 significant digits, 2 decimal places (pxDecimals=2)
    })

    it('should handle integer prices', () => {
      const assetInfo = { szDecimals: 0, pxDecimals: 0, isPerp: true }
      const price = 123456
      const result = HyperliquidPrecision.formatPrice(price, assetInfo)
      expect(result).toBe('123450') // Integer prices allowed, but truncated to 5 significant digits
    })

    it('should truncate excessive significant digits', () => {
      const assetInfo = { szDecimals: 0, pxDecimals: 0, isPerp: true }
      const price = 123456.789
      const result = HyperliquidPrecision.formatPrice(price, assetInfo)
      expect(result).toBe('123450') // Truncated to 5 significant digits
    })
  })

  describe('formatSize', () => {
    it('should format DOGE size correctly (integer)', () => {
      const size = 1000.789
      const result = HyperliquidPrecision.formatSize(size, 0)
      expect(result).toBe('1001') // Rounded to integer
    })

    it('should format BTC size correctly (5 decimals)', () => {
      const size = 0.123456789
      const result = HyperliquidPrecision.formatSize(size, 5)
      expect(result).toBe('0.12346') // Rounded to 5 decimal places
    })

    it('should format ETH size correctly (2 decimals)', () => {
      const size = 1.234567
      const result = HyperliquidPrecision.formatSize(size, 2)
      expect(result).toBe('1.23') // Rounded to 2 decimal places
    })
  })

  describe('validatePrice', () => {
    it('should validate correct BTC price', () => {
      const assetInfo = { szDecimals: 5, pxDecimals: 1, isPerp: true }
      const price = 50000.0
      const result = HyperliquidPrecision.validatePrice(price, assetInfo)
      expect(result).toBe(true)
    })

    it('should reject price with too many significant digits', () => {
      const assetInfo = { szDecimals: 0, pxDecimals: 0, isPerp: true }
      const price = 123456.789
      const result = HyperliquidPrecision.validatePrice(price, assetInfo)
      expect(result).toBe(false)
    })

    it('should reject invalid price', () => {
      const assetInfo = { szDecimals: 2, pxDecimals: 2, isPerp: true }
      const price = -100
      const result = HyperliquidPrecision.validatePrice(price, assetInfo)
      expect(result).toBe(false)
    })
  })

  describe('validateSize', () => {
    it('should validate correct size', () => {
      const size = 1.23
      const result = HyperliquidPrecision.validateSize(size, 2)
      expect(result).toBe(true)
    })

    it('should reject size with too many decimals', () => {
      const size = 1.234567
      const result = HyperliquidPrecision.validateSize(size, 2)
      expect(result).toBe(false)
    })
  })

  describe('getDefaultAssetInfo', () => {
    it('should return correct info for BTC-PERP', () => {
      const result = HyperliquidPrecision.getDefaultAssetInfo('BTC-PERP')
      expect(result.szDecimals).toBe(5)
      expect(result.pxDecimals).toBe(1)
      expect(result.isPerp).toBe(true)
    })

    it('should return correct info for ETH-PERP', () => {
      const result = HyperliquidPrecision.getDefaultAssetInfo('ETH-PERP')
      expect(result.szDecimals).toBe(2)
      expect(result.pxDecimals).toBe(1)
      expect(result.isPerp).toBe(true)
    })

    it('should return correct info for DOGE-PERP', () => {
      const result = HyperliquidPrecision.getDefaultAssetInfo('DOGE-PERP')
      expect(result.szDecimals).toBe(0)
      expect(result.pxDecimals).toBe(5)
      expect(result.isPerp).toBe(true)
    })
  })

  describe('convenience functions', () => {
    it('should format price using convenience function', () => {
      const result = formatHyperliquidPriceSync(50000.123, 'BTC-PERP')
      expect(result).toBe('50000') // pxDecimals=1 for BTC
    })

    it('should format size using convenience function', () => {
      const result = formatHyperliquidSizeSync(1.234567, 'ETH-PERP')
      expect(result).toBe('1.23')
    })

    it('should validate price using convenience function', () => {
      const result = validateHyperliquidPriceSync(50000.0, 'BTC-PERP')
      expect(result).toBe(true)
    })

    it('should validate size using convenience function', () => {
      const result = validateHyperliquidSizeSync(1.23, 'ETH-PERP')
      expect(result).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle zero values', () => {
      const assetInfo = { szDecimals: 2, pxDecimals: 2, isPerp: true }
      // Zero price now returns '0' instead of throwing
      expect(HyperliquidPrecision.formatPrice(0, assetInfo)).toBe('0')
      // Size can be zero
      const result = HyperliquidPrecision.formatSize(0, 2)
      expect(result).toBe('0.00')
    })

    it('should handle NaN values', () => {
      const assetInfo = { szDecimals: 2, pxDecimals: 2, isPerp: true }
      // NaN price now returns '0' instead of throwing
      expect(HyperliquidPrecision.formatPrice(NaN, assetInfo)).toBe('0')
      expect(() => HyperliquidPrecision.formatSize(NaN, 2)).toThrow('Invalid size value')
    })

    it('should handle infinity values', () => {
      const assetInfo = { szDecimals: 2, pxDecimals: 2, isPerp: true }
      // Infinity price now returns '0' instead of throwing
      expect(HyperliquidPrecision.formatPrice(Infinity, assetInfo)).toBe('0')
      expect(() => HyperliquidPrecision.formatSize(Infinity, 2)).toThrow('Invalid size value')
    })
  })

  describe('Scale Order Price Validation', () => {
    it('should validate scale order prices correctly', () => {
      const btcAssetInfo = { szDecimals: 5, pxDecimals: 1, isPerp: true }
      
      // Valid scale order prices for BTC (pxDecimals: 1)
      expect(HyperliquidPrecision.validatePrice(50000, btcAssetInfo)).toBe(true)
      expect(HyperliquidPrecision.validatePrice(5000.1, btcAssetInfo)).toBe(true) // 5 significant digits
      expect(HyperliquidPrecision.validatePrice(50000.0, btcAssetInfo)).toBe(true)
      
      // Invalid scale order prices for BTC (pxDecimals: 1)
      expect(HyperliquidPrecision.validatePrice(50000.12, btcAssetInfo)).toBe(false) // Too many decimal places
      expect(HyperliquidPrecision.validatePrice(50000.123, btcAssetInfo)).toBe(false) // Too many decimal places
      
      // Test scale order price range validation
      const startPrice = 50000
      const endPrice = 51000
      const orderCount = 5
      const priceStep = (endPrice - startPrice) / (orderCount - 1)
      
      for (let i = 0; i < orderCount; i++) {
        const subOrderPrice = startPrice + (priceStep * i)
        expect(HyperliquidPrecision.validatePrice(subOrderPrice, btcAssetInfo)).toBe(true)
      }
    })

    it('should validate scale order prices for different assets', () => {
      const ethAssetInfo = { szDecimals: 2, pxDecimals: 2, isPerp: true }
      const dogeAssetInfo = { szDecimals: 0, pxDecimals: 5, isPerp: true }
      
      // ETH scale order (pxDecimals: 2)
      expect(HyperliquidPrecision.validatePrice(300.12, ethAssetInfo)).toBe(true) // 5 significant digits
      expect(HyperliquidPrecision.validatePrice(3000.123, ethAssetInfo)).toBe(false) // Too many decimal places
      
      // DOGE scale order (pxDecimals: 5)
      expect(HyperliquidPrecision.validatePrice(0.12345, dogeAssetInfo)).toBe(true)
      expect(HyperliquidPrecision.validatePrice(0.123456, dogeAssetInfo)).toBe(false) // Too many decimal places
    })

    it('should handle edge cases in scale order validation', () => {
      const btcAssetInfo = { szDecimals: 5, pxDecimals: 1, isPerp: true }
      
      // Test with valid price range
      const startPrice = 5000
      const endPrice = 5001
      const orderCount = 3
      const priceStep = (endPrice - startPrice) / (orderCount - 1)
      
      for (let i = 0; i < orderCount; i++) {
        const subOrderPrice = startPrice + (priceStep * i)
        expect(HyperliquidPrecision.validatePrice(subOrderPrice, btcAssetInfo)).toBe(true)
      }
    })
  })

  describe('Size Validation Edge Cases', () => {
    it('should reject DOGE size with decimals', () => {
      const dogeAssetInfo = { szDecimals: 0, pxDecimals: 5, isPerp: true }
      
      // DOGE should only accept integer sizes
      expect(HyperliquidPrecision.validateSize(300, dogeAssetInfo.szDecimals)).toBe(true)
      expect(HyperliquidPrecision.validateSize(300.0, dogeAssetInfo.szDecimals)).toBe(true)
      expect(HyperliquidPrecision.validateSize(300.33, dogeAssetInfo.szDecimals)).toBe(false) // Should reject decimals
      expect(HyperliquidPrecision.validateSize(300.1, dogeAssetInfo.szDecimals)).toBe(false) // Should reject decimals
    })

    it('should validate BTC size with correct decimals', () => {
      const btcAssetInfo = { szDecimals: 5, pxDecimals: 1, isPerp: true }
      
      // BTC should accept up to 5 decimal places
      expect(HyperliquidPrecision.validateSize(0.12345, btcAssetInfo.szDecimals)).toBe(true)
      expect(HyperliquidPrecision.validateSize(0.123456, btcAssetInfo.szDecimals)).toBe(false) // Too many decimals
    })

    it('should validate ETH size with correct decimals', () => {
      const ethAssetInfo = { szDecimals: 2, pxDecimals: 2, isPerp: true }
      
      // ETH should accept up to 2 decimal places
      expect(HyperliquidPrecision.validateSize(1.23, ethAssetInfo.szDecimals)).toBe(true)
      expect(HyperliquidPrecision.validateSize(1.234, ethAssetInfo.szDecimals)).toBe(false) // Too many decimals
    })
  })

  describe('Size Validation Error Messages', () => {
    it('should provide helpful error messages for DOGE', () => {
      const dogeAssetInfo = { szDecimals: 0, pxDecimals: 5, isPerp: true }
      
      // Test error messages for DOGE (no decimals allowed)
      expect(HyperliquidPrecision.getSizeValidationError(300.33, dogeAssetInfo.szDecimals, 'DOGE-PERP'))
        .toBe('DOGE-PERP only accepts whole numbers (no decimals). Please enter a whole number like 300')
      
      expect(HyperliquidPrecision.getSizeValidationError(300.1, dogeAssetInfo.szDecimals, 'DOGE-PERP'))
        .toBe('DOGE-PERP only accepts whole numbers (no decimals). Please enter a whole number like 300')
    })

    it('should provide helpful error messages for BTC', () => {
      const btcAssetInfo = { szDecimals: 5, pxDecimals: 1, isPerp: true }
      
      // Test error messages for BTC (5 decimal places allowed)
      expect(HyperliquidPrecision.getSizeValidationError(0.123456, btcAssetInfo.szDecimals, 'BTC-PERP'))
        .toBe('BTC-PERP only accepts up to 5 decimal places. Please round to 5 decimal places')
    })

    it('should provide helpful error messages for ETH', () => {
      const ethAssetInfo = { szDecimals: 2, pxDecimals: 2, isPerp: true }
      
      // Test error messages for ETH (2 decimal places allowed)
      expect(HyperliquidPrecision.getSizeValidationError(1.234, ethAssetInfo.szDecimals, 'ETH-PERP'))
        .toBe('ETH-PERP only accepts up to 2 decimal places. Please round to 2 decimal places')
    })

    it('should handle edge cases in error messages', () => {
      const assetInfo = { szDecimals: 1, pxDecimals: 2, isPerp: true }
      
      // Test singular form for 1 decimal place
      expect(HyperliquidPrecision.getSizeValidationError(1.23, assetInfo.szDecimals, 'TEST-PERP'))
        .toBe('TEST-PERP only accepts up to 1 decimal place. Please round to 1 decimal place')
    })
  })
})
