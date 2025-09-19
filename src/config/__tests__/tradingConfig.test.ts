import { TradingConfigHelper, TRADING_CONFIG } from '../tradingConfig'

describe('TradingConfigHelper', () => {
  test('should get correct rounding precision for different coins', () => {
    expect(TradingConfigHelper.getRoundingPrecision('BTC-PERP')).toBe(5)
    expect(TradingConfigHelper.getRoundingPrecision('ETH-PERP')).toBe(4)
    expect(TradingConfigHelper.getRoundingPrecision('SOL-PERP')).toBe(2)
    expect(TradingConfigHelper.getRoundingPrecision('DOGE-PERP')).toBe(0)
  })

  test('should get correct minimum order sizes', () => {
    expect(TradingConfigHelper.getMinOrderSize('BTC-PERP')).toBe(0.00001)
    expect(TradingConfigHelper.getMinOrderSize('ETH-PERP')).toBe(0.0001)
    expect(TradingConfigHelper.getMinOrderSize('DOGE-PERP')).toBe(1)
  })

  test('should get correct timing configuration', () => {
    const timing = TradingConfigHelper.getTimingConfig()
    expect(timing.TWAP_MONITOR_INTERVAL).toBe(2000)
    expect(timing.NOTIFICATION_DURATION).toBe(5000)
  })

  test('should calculate fees correctly', () => {
    const amount = 1000
    expect(TradingConfigHelper.calculateMakerFee(amount)).toBe(0.1)
    expect(TradingConfigHelper.calculateTakerFee(amount)).toBe(0.2)
  })

  test('should get correct leverage limits', () => {
    expect(TradingConfigHelper.getMaxLeverageForScaleOrders(5)).toBe(20)
    expect(TradingConfigHelper.getMaxLeverageForScaleOrders(12)).toBe(10)
    expect(TradingConfigHelper.getMaxLeverageForScaleOrders(20)).toBe(5)
  })

  test('should validate order values correctly', () => {
    expect(TradingConfigHelper.validateOrderValue(10)).toBe(true)
    expect(TradingConfigHelper.validateOrderValue(5)).toBe(false)
    expect(TradingConfigHelper.validateOrderValue(15)).toBe(true)
  })
})
