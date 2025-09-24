import { describe, it, expect } from 'vitest'
import {
  calculateMaintenanceLeverage,
  getMaintenanceLeverageForCoin,
  calculateLiquidationWithMaintenanceLeverage,
  getTestnetMarginTiers,
  getMainnetMarginTiers,
  getMarginTiers,
  getMarginTiersForNetwork,
  getMaintenanceLeverageForCoinWithNetworkDetection,
} from '../utils/liquidationPrice'

describe('Maintenance Leverage Calculations', () => {
  describe('calculateMaintenanceLeverage', () => {
    it('should calculate maintenance leverage based on notional value and tiers', () => {
      const marginTiers = [
        { lowerBound: 0, maxLeverage: 40 },
        { lowerBound: 150_000_000, maxLeverage: 20 },
      ]

      // Small position - should use first tier (40x max leverage)
      const smallNotional = 50_000_000 // 50M USDC
      const smallMaintenanceLeverage = calculateMaintenanceLeverage(smallNotional, marginTiers)
      expect(smallMaintenanceLeverage).toBe(80) // 2 * 40

      // Large position - should use second tier (20x max leverage)
      const largeNotional = 200_000_000 // 200M USDC
      const largeMaintenanceLeverage = calculateMaintenanceLeverage(largeNotional, marginTiers)
      expect(largeMaintenanceLeverage).toBe(40) // 2 * 20
    })

    it('should handle edge case at tier boundary', () => {
      const marginTiers = [
        { lowerBound: 0, maxLeverage: 40 },
        { lowerBound: 150_000_000, maxLeverage: 20 },
      ]

      // Exactly at boundary
      const boundaryNotional = 150_000_000
      const boundaryMaintenanceLeverage = calculateMaintenanceLeverage(boundaryNotional, marginTiers)
      expect(boundaryMaintenanceLeverage).toBe(40) // 2 * 20 (second tier)
    })

    it('should use fallback when no tiers provided', () => {
      const notional = 100_000_000
      const fallbackMaxLeverage = 25
      const maintenanceLeverage = calculateMaintenanceLeverage(notional, undefined, fallbackMaxLeverage)
      expect(maintenanceLeverage).toBe(50) // 2 * 25
    })

    it('should use default fallback when no parameters provided', () => {
      const notional = 100_000_000
      const maintenanceLeverage = calculateMaintenanceLeverage(notional)
      expect(maintenanceLeverage).toBe(20) // 2 * 10 (default)
    })

    it('should handle invalid notional values', () => {
      const marginTiers = [{ lowerBound: 0, maxLeverage: 40 }]
      
      const invalidNotional = -100_000_000
      const maintenanceLeverage = calculateMaintenanceLeverage(invalidNotional, marginTiers)
      expect(maintenanceLeverage).toBe(20) // Default fallback
    })
  })

  describe('getMainnetMarginTiers', () => {
    it('should return correct mainnet tiers for BTC', () => {
      const btcTiers = getMainnetMarginTiers('BTC')
      expect(btcTiers).toEqual([
        { lowerBound: 0, maxLeverage: 40 },
        { lowerBound: 150_000_000, maxLeverage: 20 },
      ])
    })

    it('should return correct mainnet tiers for ETH', () => {
      const ethTiers = getMainnetMarginTiers('ETH')
      expect(ethTiers).toEqual([
        { lowerBound: 0, maxLeverage: 25 },
        { lowerBound: 100_000_000, maxLeverage: 15 },
      ])
    })

    it('should return correct mainnet tiers for SOL', () => {
      const solTiers = getMainnetMarginTiers('SOL')
      expect(solTiers).toEqual([
        { lowerBound: 0, maxLeverage: 20 },
        { lowerBound: 70_000_000, maxLeverage: 10 },
      ])
    })

    it('should return correct mainnet tiers for XRP', () => {
      const xrpTiers = getMainnetMarginTiers('XRP')
      expect(xrpTiers).toEqual([
        { lowerBound: 0, maxLeverage: 20 },
        { lowerBound: 40_000_000, maxLeverage: 10 },
      ])
    })

    it('should return correct mainnet tiers for DOGE group', () => {
      const dogeTiers = getMainnetMarginTiers('DOGE')
      expect(dogeTiers).toEqual([
        { lowerBound: 0, maxLeverage: 10 },
        { lowerBound: 20_000_000, maxLeverage: 5 },
      ])

      // Test other coins in the same group
      const aaveTiers = getMainnetMarginTiers('AAVE')
      expect(aaveTiers).toEqual(dogeTiers)
    })

    it('should return correct mainnet tiers for OP group', () => {
      const opTiers = getMainnetMarginTiers('OP')
      expect(opTiers).toEqual([
        { lowerBound: 0, maxLeverage: 10 },
        { lowerBound: 3_000_000, maxLeverage: 5 },
      ])

      // Test other coins in the same group
      const arbTiers = getMainnetMarginTiers('ARB')
      expect(arbTiers).toEqual(opTiers)
    })
  })

  describe('getTestnetMarginTiers', () => {
    it('should return correct testnet tiers for BTC', () => {
      const btcTiers = getTestnetMarginTiers('BTC')
      expect(btcTiers).toEqual([
        { lowerBound: 0, maxLeverage: 40 },
        { lowerBound: 10_000, maxLeverage: 25 },
        { lowerBound: 50_000, maxLeverage: 10 },
        { lowerBound: 100_000, maxLeverage: 5 },
        { lowerBound: 300_000, maxLeverage: 3 },
      ])
    })

    it('should return correct testnet tiers for ETH', () => {
      const ethTiers = getTestnetMarginTiers('ETH')
      expect(ethTiers).toEqual([
        { lowerBound: 0, maxLeverage: 25 },
        { lowerBound: 20_000, maxLeverage: 10 },
        { lowerBound: 50_000, maxLeverage: 5 },
        { lowerBound: 200_000, maxLeverage: 3 },
      ])
    })

    it('should return correct testnet tiers for DOGE group', () => {
      const dogeTiers = getTestnetMarginTiers('DOGE')
      expect(dogeTiers).toEqual([
        { lowerBound: 0, maxLeverage: 10 },
        { lowerBound: 20_000, maxLeverage: 5 },
        { lowerBound: 100_000, maxLeverage: 3 },
      ])

      // Test other coins in the same group
      const tiaTiers = getTestnetMarginTiers('TIA')
      expect(tiaTiers).toEqual(dogeTiers)
    })

    it('should return correct testnet tiers for LDO group', () => {
      const ldoTiers = getTestnetMarginTiers('LDO')
      expect(ldoTiers).toEqual([
        { lowerBound: 0, maxLeverage: 10 },
        { lowerBound: 10_000, maxLeverage: 5 },
      ])

      // Test other coins in the same group
      const arbTiers = getTestnetMarginTiers('ARB')
      expect(arbTiers).toEqual(ldoTiers)
    })
  })

  describe('getMarginTiers', () => {
    it('should return testnet tiers when isTestnet is true', () => {
      const btcTestnetTiers = getMarginTiers('BTC', true)
      const expectedTestnetTiers = getTestnetMarginTiers('BTC')
      expect(btcTestnetTiers).toEqual(expectedTestnetTiers)
    })

    it('should return mainnet tiers when isTestnet is false', () => {
      const btcMainnetTiers = getMarginTiers('BTC', false)
      const expectedMainnetTiers = getMainnetMarginTiers('BTC')
      expect(btcMainnetTiers).toEqual(expectedMainnetTiers)
    })

    it('should default to testnet when no isTestnet parameter provided', () => {
      const btcTiers = getMarginTiers('BTC')
      const expectedTestnetTiers = getTestnetMarginTiers('BTC')
      expect(btcTiers).toEqual(expectedTestnetTiers)
    })
  })

  describe('getMarginTiersForNetwork', () => {
    it('should return testnet tiers by default when no network detection', () => {
      const btcTiers = getMarginTiersForNetwork('BTC')
      const expectedTestnetTiers = getTestnetMarginTiers('BTC')
      expect(btcTiers).toEqual(expectedTestnetTiers)
    })
  })

  describe('getMaintenanceLeverageForCoinWithNetworkDetection', () => {
    it('should calculate maintenance leverage with automatic network detection', () => {
      const notional = 5_000 // Use smaller notional for testnet
      const maintenanceLeverage = getMaintenanceLeverageForCoinWithNetworkDetection('BTC', notional)
      
      // Should use testnet tiers by default (since no network detection in test environment)
      expect(maintenanceLeverage).toBe(80) // 2 * 40 (testnet first tier)
    })

    it('should use provided margin tiers when available', () => {
      const mainnetTiers = getMainnetMarginTiers('BTC')
      const notional = 50_000_000
      const maintenanceLeverage = getMaintenanceLeverageForCoinWithNetworkDetection('BTC', notional, mainnetTiers)
      
      // Should use provided mainnet tiers
      expect(maintenanceLeverage).toBe(80) // 2 * 40 (mainnet first tier)
    })
  })

  describe('getMaintenanceLeverageForCoin', () => {
    it('should calculate maintenance leverage for BTC with mainnet tiers', () => {
      const btcTiers = getMainnetMarginTiers('BTC')

      // Small BTC position (50M USDC) - should use first tier (40x max leverage)
      const smallNotional = 50_000_000
      const maintenanceLeverage = getMaintenanceLeverageForCoin('BTC', smallNotional, btcTiers)
      expect(maintenanceLeverage).toBe(80) // 2 * 40

      // Large BTC position (200M USDC) - should use second tier (20x max leverage)
      const largeNotional = 200_000_000
      const largeMaintenanceLeverage = getMaintenanceLeverageForCoin('BTC', largeNotional, btcTiers)
      expect(largeMaintenanceLeverage).toBe(40) // 2 * 20
    })

    it('should calculate maintenance leverage for ETH with mainnet tiers', () => {
      const ethTiers = getMainnetMarginTiers('ETH')

      // Small ETH position (50M USDC) - should use first tier (25x max leverage)
      const smallNotional = 50_000_000
      const maintenanceLeverage = getMaintenanceLeverageForCoin('ETH', smallNotional, ethTiers)
      expect(maintenanceLeverage).toBe(50) // 2 * 25

      // Large ETH position (150M USDC) - should use second tier (15x max leverage)
      const largeNotional = 150_000_000
      const largeMaintenanceLeverage = getMaintenanceLeverageForCoin('ETH', largeNotional, ethTiers)
      expect(largeMaintenanceLeverage).toBe(30) // 2 * 15
    })

    it('should calculate maintenance leverage for SOL with mainnet tiers', () => {
      const solTiers = getMainnetMarginTiers('SOL')

      // Small SOL position (30M USDC) - should use first tier (20x max leverage)
      const smallNotional = 30_000_000
      const maintenanceLeverage = getMaintenanceLeverageForCoin('SOL', smallNotional, solTiers)
      expect(maintenanceLeverage).toBe(40) // 2 * 20

      // Large SOL position (100M USDC) - should use second tier (10x max leverage)
      const largeNotional = 100_000_000
      const largeMaintenanceLeverage = getMaintenanceLeverageForCoin('SOL', largeNotional, solTiers)
      expect(largeMaintenanceLeverage).toBe(20) // 2 * 10
    })

    it('should calculate maintenance leverage for BTC with testnet tiers', () => {
      const btcTiers = getTestnetMarginTiers('BTC')

      // Small BTC position (5k USDC) - should use first tier (40x max leverage)
      const smallNotional = 5_000
      const maintenanceLeverage = getMaintenanceLeverageForCoin('BTC', smallNotional, btcTiers)
      expect(maintenanceLeverage).toBe(80) // 2 * 40

      // Medium BTC position (30k USDC) - should use second tier (25x max leverage)
      const mediumNotional = 30_000
      const mediumMaintenanceLeverage = getMaintenanceLeverageForCoin('BTC', mediumNotional, btcTiers)
      expect(mediumMaintenanceLeverage).toBe(50) // 2 * 25

      // Large BTC position (75k USDC) - should use third tier (10x max leverage)
      const largeNotional = 75_000
      const largeMaintenanceLeverage = getMaintenanceLeverageForCoin('BTC', largeNotional, btcTiers)
      expect(largeMaintenanceLeverage).toBe(20) // 2 * 10
    })

    it('should calculate maintenance leverage for ETH with testnet tiers', () => {
      const ethTiers = getTestnetMarginTiers('ETH')

      // Small ETH position (10k USDC) - should use first tier (25x max leverage)
      const smallNotional = 10_000
      const maintenanceLeverage = getMaintenanceLeverageForCoin('ETH', smallNotional, ethTiers)
      expect(maintenanceLeverage).toBe(50) // 2 * 25

      // Medium ETH position (30k USDC) - should use second tier (10x max leverage)
      const mediumNotional = 30_000
      const mediumMaintenanceLeverage = getMaintenanceLeverageForCoin('ETH', mediumNotional, ethTiers)
      expect(mediumMaintenanceLeverage).toBe(20) // 2 * 10
    })

    it('should use coin-specific fallback when no tiers provided', () => {
      const notional = 100_000

      // BTC should use 40x max leverage as fallback
      const btcMaintenanceLeverage = getMaintenanceLeverageForCoin('BTC', notional)
      expect(btcMaintenanceLeverage).toBe(80) // 2 * 40

      // ETH should use 25x max leverage as fallback
      const ethMaintenanceLeverage = getMaintenanceLeverageForCoin('ETH', notional)
      expect(ethMaintenanceLeverage).toBe(50) // 2 * 25

      // Unknown coin should use 10x max leverage as fallback
      const unknownMaintenanceLeverage = getMaintenanceLeverageForCoin('UNKNOWN', notional)
      expect(unknownMaintenanceLeverage).toBe(20) // 2 * 10
    })
  })

  describe('calculateLiquidationWithMaintenanceLeverage', () => {
    it('should include maintenance leverage in liquidation details', () => {
      const inputParams = {
        entryPrice: 50000,
        leverage: 10,
        side: 'buy' as const,
        coin: 'BTC',
        marginMode: 'isolated' as const,
        positionSize: 1,
        isolatedMargin: 5000,
        marginTiers: [
          { lowerBound: 0, maxLeverage: 40 },
          { lowerBound: 150_000_000, maxLeverage: 20 },
        ],
      }

      const result = calculateLiquidationWithMaintenanceLeverage(inputParams)
      
      expect(result).toHaveProperty('maintenanceLeverage')
      expect(result.maintenanceLeverage).toBeGreaterThan(0)
      
      // Should include all other liquidation details
      expect(result).toHaveProperty('price')
      expect(result).toHaveProperty('rate')
      expect(result).toHaveProperty('deduction')
      expect(result).toHaveProperty('equityUsed')
    })

    it('should calculate maintenance leverage based on notional value', () => {
      const smallPositionParams = {
        entryPrice: 50000,
        leverage: 10,
        side: 'buy' as const,
        coin: 'BTC',
        marginMode: 'isolated' as const,
        positionSize: 1, // 1 BTC = 50,000 USDC notional
        isolatedMargin: 5000,
        marginTiers: [
          { lowerBound: 0, maxLeverage: 40 },
          { lowerBound: 150_000_000, maxLeverage: 20 },
        ],
      }

      const largePositionParams = {
        ...smallPositionParams,
        positionSize: 3000, // 3000 BTC = 150,000,000 USDC notional
        isolatedMargin: 7_500_000,
      }

      const smallResult = calculateLiquidationWithMaintenanceLeverage(smallPositionParams)
      const largeResult = calculateLiquidationWithMaintenanceLeverage(largePositionParams)

      // Small position should use first tier (40x max leverage = 80x maintenance leverage)
      expect(smallResult.maintenanceLeverage).toBe(80)

      // Large position should use second tier (20x max leverage = 40x maintenance leverage)
      expect(largeResult.maintenanceLeverage).toBe(40)
    })
  })
})
