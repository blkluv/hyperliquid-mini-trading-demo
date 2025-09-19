// Trading configuration for managing hardcoded values
// This file centralizes all trading-related constants and configurations

export const TRADING_CONFIG = {
  // Time intervals configuration
  TIMING: {
    // TWAP monitoring interval (in milliseconds)
    TWAP_MONITOR_INTERVAL: 2000,
    
    // Notification display duration (in milliseconds)
    NOTIFICATION_DURATION: 5000,
    
    // TWAP order frequency (in seconds)
    TWAP_ORDER_FREQUENCY: 30,
    
    // Price update interval (in milliseconds)
    PRICE_UPDATE_INTERVAL: 1000,
    
    // Account data refresh interval (in milliseconds)
    ACCOUNT_REFRESH_INTERVAL: 5000,
  },

  // Minimum order sizes for different coins
  MIN_ORDER_SIZES: {
    'DOGE-PERP': 1,
    'BTC-PERP': 0.00001,
    'ETH-PERP': 0.0001,
    'SOL-PERP': 0.1,
    'AVAX-PERP': 0.1,
    'MATIC-PERP': 0.1,
    'LINK-PERP': 0.1,
    'UNI-PERP': 0.1,
    'AAVE-PERP': 0.1,
    'CRV-PERP': 0.1,
  },

  // Rounding precision for different coins (decimal places)
  ROUNDING_PRECISION: {
    'DOGE-PERP': 0,    // Round to integer
    'BTC-PERP': 5,     // 5 decimal places (0.00001)
    'ETH-PERP': 4,     // 4 decimal places (0.0001)
    'SOL-PERP': 2,     // 2 decimal places (0.01)
    'AVAX-PERP': 2,    // 2 decimal places (0.01)
    'MATIC-PERP': 2,   // 2 decimal places (0.01)
    'LINK-PERP': 2,    // 2 decimal places (0.01)
    'UNI-PERP': 2,     // 2 decimal places (0.01)
    'AAVE-PERP': 2,    // 2 decimal places (0.01)
    'CRV-PERP': 2,     // 2 decimal places (0.01)
  },

  // Default precision for unknown coins
  DEFAULT_PRECISION: 6, // 6 decimal places (0.000001)

  // Minimum order value in USD
  MIN_ORDER_VALUE_USD: 10,

  // Maximum order value warning threshold in USD
  MAX_ORDER_VALUE_WARNING_USD: 1000000,

  // Trading fees (as decimal percentages)
  FEES: {
    MAKER_FEE: 0.0001,  // 0.01%
    TAKER_FEE: 0.0002,  // 0.02%
  },
}

// Helper functions for configuration access
export class TradingConfigHelper {
  /**
   * Get minimum order size for a specific coin
   */
  static getMinOrderSize(coin: string): number {
    return TRADING_CONFIG.MIN_ORDER_SIZES[coin as keyof typeof TRADING_CONFIG.MIN_ORDER_SIZES] || 0.001
  }

  /**
   * Get rounding precision for a specific coin
   */
  static getRoundingPrecision(coin: string): number {
    return TRADING_CONFIG.ROUNDING_PRECISION[coin as keyof typeof TRADING_CONFIG.ROUNDING_PRECISION] || TRADING_CONFIG.DEFAULT_PRECISION
  }

  /**
   * Get the multiplier for rounding (e.g., 100000 for 5 decimal places)
   */
  static getRoundingMultiplier(coin: string): number {
    const precision = this.getRoundingPrecision(coin)
    return Math.pow(10, precision)
  }

  /**
   * Get TWAP monitor interval
   */
  static getTwapMonitorInterval(): number {
    return TRADING_CONFIG.TIMING.TWAP_MONITOR_INTERVAL
  }

  /**
   * Get notification duration
   */
  static getNotificationDuration(): number {
    return TRADING_CONFIG.TIMING.NOTIFICATION_DURATION
  }

  /**
   * Get TWAP order frequency
   */
  static getTwapOrderFrequency(): number {
    return TRADING_CONFIG.TIMING.TWAP_ORDER_FREQUENCY
  }

  /**
   * Get minimum order value in USD
   */
  static getMinOrderValueUsd(): number {
    return TRADING_CONFIG.MIN_ORDER_VALUE_USD
  }

  /**
   * Get maximum order value warning threshold
   */
  static getMaxOrderValueWarningUsd(): number {
    return TRADING_CONFIG.MAX_ORDER_VALUE_WARNING_USD
  }

  /**
   * Get timing configuration
   */
  static getTimingConfig() {
    return TRADING_CONFIG.TIMING
  }

  /**
   * Validate order value against minimum requirements
   */
  static validateOrderValue(value: number, isSubOrder: boolean = false): boolean {
    const minValue = isSubOrder ? TRADING_CONFIG.MIN_ORDER_VALUE_USD : TRADING_CONFIG.MIN_ORDER_VALUE_USD
    return value >= minValue
  }

  /**
   * Get maker fee rate
   */
  static getMakerFee(): number {
    return TRADING_CONFIG.FEES.MAKER_FEE
  }

  /**
   * Get taker fee rate
   */
  static getTakerFee(): number {
    return TRADING_CONFIG.FEES.TAKER_FEE
  }

  /**
   * Calculate maker fee for a given amount
   */
  static calculateMakerFee(amount: number): number {
    return amount * TRADING_CONFIG.FEES.MAKER_FEE
  }

  /**
   * Calculate taker fee for a given amount
   */
  static calculateTakerFee(amount: number): number {
    return amount * TRADING_CONFIG.FEES.TAKER_FEE
  }

  /**
   * Get maximum leverage for scale orders based on order count
   */
  static getMaxLeverageForScaleOrders(orderCount: number): number {
    if (orderCount > 15) return 5
    if (orderCount > 10) return 10
    return 20
  }

  /**
   * Get maximum leverage for TWAP orders based on duration
   */
  static getMaxLeverageForTwapOrders(totalMinutes: number): number {
    if (totalMinutes > 1440) return 5  // > 24 hours
    if (totalMinutes > 720) return 10  // > 12 hours
    return 20
  }

  /**
   * Get minimum margin requirement based on leverage
   */
  static getMinMarginRequirement(leverage: number): number {
    if (leverage >= 30) return 200
    if (leverage >= 20) return 100
    return 0
  }
}

// Export individual config sections for easier imports
export const TIMING_CONFIG = TRADING_CONFIG.TIMING
export const MIN_ORDER_SIZES = TRADING_CONFIG.MIN_ORDER_SIZES
export const ROUNDING_PRECISION = TRADING_CONFIG.ROUNDING_PRECISION