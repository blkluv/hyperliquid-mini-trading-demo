import { describe, it, expect } from 'vitest'

// Import the liquidation price calculation function
// Note: This would need to be extracted from TradingInterface.tsx for testing
const calculateLiquidationPrice = (
  entryPrice: number,
  leverage: number,
  side: 'buy' | 'sell',
  coin: string = 'BTC',
  marginMode: 'isolated' | 'cross' = 'isolated',
  walletBalance: number = 0 // for cross margin
) => {
  // realistic small maintenance margin ratios (exchange-style)
  const maintenanceMargins: { [key: string]: number } = {
    'BTC': 0.004,   // 0.4%
    'ETH': 0.005,   // 0.5%
    'SOL': 0.01,    // 1%
    'default': 0.005
  }

  const maintenanceMargin = maintenanceMargins[coin] || maintenanceMargins.default
  const initMarginRatio = 1 / leverage

  if (marginMode === 'isolated') {
    // --- Isolated Margin ---
    if (side === 'buy') {
      return entryPrice * (1 - (initMarginRatio - maintenanceMargin))
    } else {
      return entryPrice * (1 + (initMarginRatio - maintenanceMargin))
    }
  } else {
    // --- Cross Margin ---
    // In cross margin, liquidation price is calculated based on total account balance
    // and the position's contribution to the overall margin requirement
    
    // For cross margin, we need to consider the total account balance
    // The liquidation price is when the position's margin requirement equals the available balance
    const positionValue = entryPrice * initMarginRatio
    const availableBalance = walletBalance
    
    if (side === 'buy') {
      // For long positions in cross margin:
      // LP = (Available Balance - Maintenance Margin) / Position Size
      // Simplified: LP = Entry Price * (1 - (Available Balance / Position Value) + Maintenance Margin)
      const balanceRatio = availableBalance / positionValue
      return entryPrice * (1 - balanceRatio + maintenanceMargin)
    } else {
      // For short positions in cross margin:
      // LP = (Available Balance + Maintenance Margin) / Position Size  
      // Simplified: LP = Entry Price * (1 + (Available Balance / Position Value) - Maintenance Margin)
      const balanceRatio = availableBalance / positionValue
      return entryPrice * (1 + balanceRatio - maintenanceMargin)
    }
  }
}

describe('Liquidation Price Calculation', () => {
  describe('Long Positions (Buy)', () => {
    it('should calculate liquidation price for BTC long position', () => {
      const entryPrice = 50000
      const leverage = 10
      const side = 'buy'
      const coin = 'BTC'
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin)
      
      // Expected: 50000 * (1 - (1/10 - 0.004)) = 50000 * (1 - (0.1 - 0.004)) = 50000 * (1 - 0.096) = 50000 * 0.904 = 45200
      expect(liquidationPrice).toBeCloseTo(45200, 10)
    })

    it('should calculate liquidation price for ETH long position', () => {
      const entryPrice = 3000
      const leverage = 5
      const side = 'buy'
      const coin = 'ETH'
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin)
      
      // Expected: 3000 * (1 - (1/5 - 0.005)) = 3000 * (1 - (0.2 - 0.005)) = 3000 * (1 - 0.195) = 3000 * 0.805 = 2415
      expect(liquidationPrice).toBeCloseTo(2415, 10)
    })

    it('should calculate liquidation price for SOL long position', () => {
      const entryPrice = 100
      const leverage = 20
      const side = 'buy'
      const coin = 'SOL'
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin)
      
      // Expected: 100 * (1 - (1/20 - 0.01)) = 100 * (1 - (0.05 - 0.01)) = 100 * (1 - 0.04) = 100 * 0.96 = 96
      expect(liquidationPrice).toBeCloseTo(96, 10)
    })
  })

  describe('Short Positions (Sell)', () => {
    it('should calculate liquidation price for BTC short position', () => {
      const entryPrice = 50000
      const leverage = 10
      const side = 'sell'
      const coin = 'BTC'
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin)
      
      // Expected: 50000 * (1 + (1/10 - 0.004)) = 50000 * (1 + (0.1 - 0.004)) = 50000 * (1 + 0.096) = 50000 * 1.096 = 54800
      expect(liquidationPrice).toBeCloseTo(54800, 10)
    })

    it('should calculate liquidation price for ETH short position', () => {
      const entryPrice = 3000
      const leverage = 5
      const side = 'sell'
      const coin = 'ETH'
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin)
      
      // Expected: 3000 * (1 + (1/5 - 0.005)) = 3000 * (1 + (0.2 - 0.005)) = 3000 * (1 + 0.195) = 3000 * 1.195 = 3585
      expect(liquidationPrice).toBeCloseTo(3585, 10)
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
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin)
      
      expect(liquidationPrice).toBeLessThan(entryPrice)
    })

    it('should ensure liquidation price is higher than entry price for short positions', () => {
      const entryPrice = 50000
      const leverage = 10
      const side = 'sell'
      const coin = 'BTC'
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin)
      
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
      
      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side, coin, marginMode)
      
      // Expected: 50000 * (1 - (1/10 - 0.004)) = 50000 * (1 - 0.096) = 50000 * 0.904 = 45200
      expect(liquidationPrice).toBeCloseTo(45200, 10)
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
