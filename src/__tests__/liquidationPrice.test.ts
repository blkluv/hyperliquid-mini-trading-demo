import { describe, it, expect } from 'vitest'

// Import the liquidation price calculation function
// Note: This would need to be extracted from TradingInterface.tsx for testing
const calculateLiquidationPrice = (
  entryPrice: number,
  leverage: number,
  side: 'buy' | 'sell',
  coin: string = 'BTC',
  marginMode: 'isolated' | 'cross' = 'isolated',
  _walletBalance: number = 0, // for cross margin (legacy parameter)
  positionSize: number = 0, // position size in base units
  accountValue: number = 0, // total account value for cross margin
  isolatedMargin: number = 0 // isolated margin for isolated margin
) => {
  // Maintenance leverage ratios (1 / MAINTENANCE_LEVERAGE)
  const maintenanceLeverages: { [key: string]: number } = {
    'BTC': 0.004,   // 0.4% (1/250)
    'ETH': 0.005,   // 0.5% (1/200)
    'SOL': 0.01,    // 1% (1/100)
    'default': 0.005
  }
  
  const l = maintenanceLeverages[coin] || maintenanceLeverages.default
  const sideMultiplier = side === 'buy' ? 1 : -1
  
  // Calculate position size if not provided
  if (positionSize === 0) {
    // Estimate position size based on leverage and available balance
    const availableBalance = marginMode === 'cross' ? accountValue : isolatedMargin
    positionSize = (availableBalance * leverage) / entryPrice
  }
  
  let marginAvailable: number
  
  if (marginMode === 'cross') {
    // Cross margin: margin_available = account_value - maintenance_margin_required
    const maintenanceMarginRequired = Math.abs(positionSize) * entryPrice * l
    marginAvailable = accountValue - maintenanceMarginRequired
  } else {
    // Isolated margin: margin_available = isolated_margin - maintenance_margin_required
    const maintenanceMarginRequired = Math.abs(positionSize) * entryPrice * l
    marginAvailable = isolatedMargin - maintenanceMarginRequired
  }
  
  // Ensure margin available is not negative
  marginAvailable = Math.max(0, marginAvailable)
  
  // Apply the precise formula: liq_price = price - side * margin_available / position_size / (1 - l * side)
  const liquidationPrice = entryPrice - sideMultiplier * marginAvailable / Math.abs(positionSize) / (1 - l * sideMultiplier)
  
  return liquidationPrice
}

describe('Liquidation Price Calculation', () => {
  describe('Long Positions (Buy)', () => {
    it('should calculate liquidation price for BTC long position', () => {
      const entryPrice = 50000
      const leverage = 10
      const side = 'buy'
      const coin = 'BTC'
      const marginMode = 'isolated'
      const walletBalance = 1000 // $1000 available
      const positionSize = 0.2 // 0.2 BTC position
      const accountValue = 1000
      const isolatedMargin = 1000
      
      const liquidationPrice = calculateLiquidationPrice(
        entryPrice, leverage, side, coin, marginMode, walletBalance, positionSize, accountValue, isolatedMargin
      )
      
      // Using the new formula: liq_price = price - side * margin_available / position_size / (1 - l * side)
      // For isolated margin: margin_available = isolated_margin - maintenance_margin_required
      // maintenance_margin_required = 0.2 * 50000 * 0.004 = 0.4
      // margin_available = 1000 - 0.4 = 999.6
      // liquidation_price = 50000 - 1 * 999.6 / 0.2 / (1 - 0.004 * 1) = 50000 - 4998 / 0.996 = 50000 - 5018.07 = 44981.93
      expect(liquidationPrice).toBeCloseTo(44981.93, 10)
    })

    it('should calculate liquidation price for ETH long position', () => {
      const entryPrice = 3000
      const leverage = 5
      const side = 'buy'
      const coin = 'ETH'
      const marginMode = 'isolated'
      const walletBalance = 600 // $600 available
      const positionSize = 0.1 // 0.1 ETH position
      const accountValue = 600
      const isolatedMargin = 600
      
      const liquidationPrice = calculateLiquidationPrice(
        entryPrice, leverage, side, coin, marginMode, walletBalance, positionSize, accountValue, isolatedMargin
      )
      
      // Using the new formula: liq_price = price - side * margin_available / position_size / (1 - l * side)
      // For isolated margin: margin_available = isolated_margin - maintenance_margin_required
      // maintenance_margin_required = 0.1 * 3000 * 0.005 = 1.5
      // margin_available = 600 - 1.5 = 598.5
      // liquidation_price = 3000 - 1 * 598.5 / 0.1 / (1 - 0.005 * 1) = 3000 - 5985 / 0.995 = 3000 - 6015.08 = 23984.92
      expect(liquidationPrice).toBeCloseTo(23984.92, 10)
    })

    it('should calculate liquidation price for SOL long position', () => {
      const entryPrice = 100
      const leverage = 20
      const side = 'buy'
      const coin = 'SOL'
      const marginMode = 'isolated'
      const walletBalance = 50 // $50 available
      const positionSize = 1 // 1 SOL position
      const accountValue = 50
      const isolatedMargin = 50
      
      const liquidationPrice = calculateLiquidationPrice(
        entryPrice, leverage, side, coin, marginMode, walletBalance, positionSize, accountValue, isolatedMargin
      )
      
      // Using the new formula: liq_price = price - side * margin_available / position_size / (1 - l * side)
      // For isolated margin: margin_available = isolated_margin - maintenance_margin_required
      // maintenance_margin_required = 1 * 100 * 0.01 = 1
      // margin_available = 50 - 1 = 49
      // liquidation_price = 100 - 1 * 49 / 1 / (1 - 0.01 * 1) = 100 - 49 / 0.99 = 100 - 49.49 = 50.51
      expect(liquidationPrice).toBeCloseTo(50.51, 10)
    })
  })

  describe('Short Positions (Sell)', () => {
    it('should calculate liquidation price for BTC short position', () => {
      const entryPrice = 50000
      const leverage = 10
      const side = 'sell'
      const coin = 'BTC'
      const marginMode = 'isolated'
      const walletBalance = 1000
      const positionSize = 0.2 // 0.2 BTC position
      const accountValue = 1000
      const isolatedMargin = 1000
      
      const liquidationPrice = calculateLiquidationPrice(
        entryPrice, leverage, side, coin, marginMode, walletBalance, positionSize, accountValue, isolatedMargin
      )
      
      // Using the new formula: liq_price = price - side * margin_available / position_size / (1 - l * side)
      // For short positions: side = -1, so sideMultiplier = -1
      // maintenance_margin_required = 0.2 * 50000 * 0.004 = 0.4
      // margin_available = 1000 - 0.4 = 999.6
      // liquidation_price = 50000 - (-1) * 999.6 / 0.2 / (1 - 0.004 * (-1)) = 50000 + 4998 / 1.004 = 50000 + 4978.09 = 54978.09
      expect(liquidationPrice).toBeCloseTo(54978.09, 10)
    })

    it('should calculate liquidation price for ETH short position', () => {
      const entryPrice = 3000
      const leverage = 5
      const side = 'sell'
      const coin = 'ETH'
      const marginMode = 'isolated'
      const walletBalance = 600
      const positionSize = 0.1 // 0.1 ETH position
      const accountValue = 600
      const isolatedMargin = 600
      
      const liquidationPrice = calculateLiquidationPrice(
        entryPrice, leverage, side, coin, marginMode, walletBalance, positionSize, accountValue, isolatedMargin
      )
      
      // Using the new formula for short positions
      // maintenance_margin_required = 0.1 * 3000 * 0.005 = 1.5
      // margin_available = 600 - 1.5 = 598.5
      // liquidation_price = 3000 - (-1) * 598.5 / 0.1 / (1 - 0.005 * (-1)) = 3000 + 5985 / 1.005 = 3000 + 5955.22 = 8955.22
      expect(liquidationPrice).toBeCloseTo(8955.22, 10)
    })

    it('should calculate liquidation price for SOL short position', () => {
      const entryPrice = 100
      const leverage = 20
      const side = 'sell'
      const coin = 'SOL'
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin)
      
      // Expected: 100 * (1 + (1/20 - 0.01)) = 100 * (1 + (0.05 - 0.01)) = 100 * (1 + 0.04) = 100 * 1.04 = 104
      expect(liquidationPrice).toBeCloseTo(104, 10)
    })
  })

  describe('Edge Cases', () => {
    it('should handle unknown coin with default maintenance margin', () => {
      const entryPrice = 1000
      const leverage = 10
      const side = 'buy'
      const coin = 'UNKNOWN'
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin)
      
      // Expected: 1000 * (1 - (1/10 - 0.005)) = 1000 * (1 - (0.1 - 0.005)) = 1000 * (1 - 0.095) = 1000 * 0.905 = 905
      expect(liquidationPrice).toBeCloseTo(905, 10)
    })

    it('should handle high leverage correctly', () => {
      const entryPrice = 50000
      const leverage = 100
      const side = 'buy'
      const coin = 'BTC'
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin)
      
      // Expected: 50000 * (1 - (1/100 - 0.004)) = 50000 * (1 - (0.01 - 0.004)) = 50000 * (1 - 0.006) = 50000 * 0.994 = 49700
      expect(liquidationPrice).toBeCloseTo(49700, 10)
    })

    it('should handle low leverage correctly', () => {
      const entryPrice = 50000
      const leverage = 2
      const side = 'buy'
      const coin = 'BTC'
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin)
      
      // Expected: 50000 * (1 - (1/2 - 0.004)) = 50000 * (1 - (0.5 - 0.004)) = 50000 * (1 - 0.496) = 50000 * 0.504 = 25200
      expect(liquidationPrice).toBeCloseTo(25200, 10)
    })
  })

  describe('Mathematical Validation', () => {
    it('should ensure liquidation price is lower than entry price for long positions', () => {
      const entryPrice = 50000
      const leverage = 10
      const side = 'buy'
      const coin = 'BTC'
      const marginMode = 'isolated'
      const walletBalance = 1000
      const positionSize = 0.2
      const accountValue = 1000
      const isolatedMargin = 1000
      
      const liquidationPrice = calculateLiquidationPrice(
        entryPrice, leverage, side, coin, marginMode, walletBalance, positionSize, accountValue, isolatedMargin
      )
      
      expect(liquidationPrice).toBeLessThan(entryPrice)
    })

    it('should ensure liquidation price is higher than entry price for short positions', () => {
      const entryPrice = 50000
      const leverage = 10
      const side = 'sell'
      const coin = 'BTC'
      const marginMode = 'isolated'
      const walletBalance = 1000
      const positionSize = 0.2
      const accountValue = 1000
      const isolatedMargin = 1000
      
      const liquidationPrice = calculateLiquidationPrice(
        entryPrice, leverage, side, coin, marginMode, walletBalance, positionSize, accountValue, isolatedMargin
      )
      
      expect(liquidationPrice).toBeGreaterThan(entryPrice)
    })

    it('should handle leverage 1 correctly', () => {
      const entryPrice = 50000
      const leverage = 1
      const side = 'buy'
      const coin = 'BTC'
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin)
      
      // Expected: 50000 * (1 - (1/1 - 0.004)) = 50000 * (1 - (1 - 0.004)) = 50000 * (1 - 0.996) = 50000 * 0.004 = 200
      expect(liquidationPrice).toBeCloseTo(200, 10)
    })
  })

  describe('Margin Mode Tests', () => {
    it('should calculate isolated margin liquidation price', () => {
      const entryPrice = 50000
      const leverage = 10
      const side = 'buy'
      const coin = 'BTC'
      const marginMode = 'isolated'
      const walletBalance = 1000
      const positionSize = 0.2
      const accountValue = 1000
      const isolatedMargin = 1000
      
      const liquidationPrice = calculateLiquidationPrice(
        entryPrice, leverage, side, coin, marginMode, walletBalance, positionSize, accountValue, isolatedMargin
      )
      
      // Using the new formula for isolated margin
      // maintenance_margin_required = 0.2 * 50000 * 0.004 = 0.4
      // margin_available = 1000 - 0.4 = 999.6
      // liquidation_price = 50000 - 1 * 999.6 / 0.2 / (1 - 0.004 * 1) = 50000 - 4998 / 0.996 = 44981.93
      expect(liquidationPrice).toBeCloseTo(44981.93, 10)
    })

    it('should calculate cross margin liquidation price', () => {
      const entryPrice = 50000
      const leverage = 10
      const side = 'buy'
      const coin = 'BTC'
      const marginMode = 'cross'
      const walletBalance = 1000
      const positionSize = 0.2
      const accountValue = 2000 // Higher account value for cross margin
      const isolatedMargin = 0
      
      const liquidationPrice = calculateLiquidationPrice(
        entryPrice, leverage, side, coin, marginMode, walletBalance, positionSize, accountValue, isolatedMargin
      )
      
      // Using the new formula for cross margin
      // maintenance_margin_required = 0.2 * 50000 * 0.004 = 0.4
      // margin_available = 2000 - 0.4 = 1999.6
      // liquidation_price = 50000 - 1 * 1999.6 / 0.2 / (1 - 0.004 * 1) = 50000 - 9998 / 0.996 = 39981.93
      expect(liquidationPrice).toBeCloseTo(39981.93, 10)
    })

    it('should calculate cross margin liquidation price with no wallet balance', () => {
      const entryPrice = 50000
      const leverage = 10
      const side = 'buy'
      const coin = 'BTC'
      const marginMode = 'cross'
      const walletBalance = 0
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin, marginMode, walletBalance)
      
      // Expected: positionValue = 50000 * 0.1 = 5000
      // balanceRatio = 0 / 5000 = 0
      // LP = 50000 * (1 - 0 + 0.004) = 50000 * 1.004 = 50200
      expect(liquidationPrice).toBeCloseTo(50200, 10)
    })

    it('should calculate cross margin liquidation price with wallet balance', () => {
      const entryPrice = 50000
      const leverage = 10
      const side = 'buy'
      const coin = 'BTC'
      const marginMode = 'cross'
      const walletBalance = 1000 // Extra $1000 in wallet
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin, marginMode, walletBalance)
      
      // Expected: positionValue = 50000 * 0.1 = 5000
      // balanceRatio = 1000 / 5000 = 0.2
      // LP = 50000 * (1 - 0.2 + 0.004) = 50000 * (1 - 0.196) = 50000 * 0.804 = 40200
      expect(liquidationPrice).toBeCloseTo(40200, 10)
    })

    it('should handle cross margin with very high wallet balance (negative liquidation price)', () => {
      const entryPrice = 50000
      const leverage = 10
      const side = 'buy'
      const coin = 'BTC'
      const marginMode = 'cross'
      const walletBalance = 10000 // Very high balance relative to position
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin, marginMode, walletBalance)
      
      // Expected: positionValue = 50000 * 0.1 = 5000
      // balanceRatio = 10000 / 5000 = 2.0
      // LP = 50000 * (1 - 2.0 + 0.004) = 50000 * (1 - 1.996) = 50000 * (-0.996) = -49800
      // Negative liquidation price means very safe position
      expect(liquidationPrice).toBeCloseTo(-49800, 10)
    })

    it('should handle cross margin short position with wallet balance', () => {
      const entryPrice = 50000
      const leverage = 10
      const side = 'sell'
      const coin = 'BTC'
      const marginMode = 'cross'
      const walletBalance = 1000
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin, marginMode, walletBalance)
      
      // Expected: positionValue = 50000 * 0.1 = 5000
      // balanceRatio = 1000 / 5000 = 0.2
      // LP = 50000 * (1 + 0.2 - 0.004) = 50000 * (1 + 0.196) = 50000 * 1.196 = 59800
      expect(liquidationPrice).toBeCloseTo(59800, 10)
    })

    it('should handle cross margin short position with very high wallet balance (negative liquidation price)', () => {
      const entryPrice = 50000
      const leverage = 10
      const side = 'sell'
      const coin = 'BTC'
      const marginMode = 'cross'
      const walletBalance = 10000 // Very high balance relative to position
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin, marginMode, walletBalance)
      
      // Expected: positionValue = 50000 * 0.1 = 5000
      // balanceRatio = 10000 / 5000 = 2.0
      // LP = 50000 * (1 + 2.0 - 0.004) = 50000 * (1 + 1.996) = 50000 * 2.996 = 149800
      // For short positions, high balance makes liquidation price much higher (safer)
      expect(liquidationPrice).toBeCloseTo(149800, 10)
    })
  })
})
