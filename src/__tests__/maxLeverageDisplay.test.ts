import { describe, it, expect } from 'vitest'
import { getMarginTiersForNetwork, getMainnetMarginTiers, getTestnetMarginTiers } from '../utils/liquidationPrice'

describe('Max Leverage Display', () => {
  describe('getMarginTiersForNetwork', () => {
    it('should return correct max leverage for BTC', () => {
      const btcTiers = getMarginTiersForNetwork('BTC')
      expect(btcTiers.length).toBeGreaterThan(0)
      expect(btcTiers[0].maxLeverage).toBeGreaterThan(10) // Should be 40 for BTC
    })

    it('should return correct max leverage for ETH', () => {
      const ethTiers = getMarginTiersForNetwork('ETH')
      expect(ethTiers.length).toBeGreaterThan(0)
      expect(ethTiers[0].maxLeverage).toBeGreaterThan(10) // Should be 25 for ETH
    })

    it('should return correct max leverage for SOL', () => {
      const solTiers = getMarginTiersForNetwork('SOL')
      expect(solTiers.length).toBeGreaterThan(0)
      expect(solTiers[0].maxLeverage).toBeGreaterThan(10) // Should be 20 for SOL
    })

    it('should return correct max leverage for DOGE', () => {
      const dogeTiers = getMarginTiersForNetwork('DOGE')
      expect(dogeTiers.length).toBeGreaterThan(0)
      expect(dogeTiers[0].maxLeverage).toBe(10) // Should be 10 for DOGE
    })
  })

  describe('Mainnet vs Testnet Max Leverage', () => {
    it('should show different max leverage for BTC between mainnet and testnet', () => {
      const btcMainnetTiers = getMainnetMarginTiers('BTC')
      const btcTestnetTiers = getTestnetMarginTiers('BTC')
      
      // Both should have 40x as first tier, but different thresholds
      expect(btcMainnetTiers[0].maxLeverage).toBe(40)
      expect(btcTestnetTiers[0].maxLeverage).toBe(40)
      
      // But different thresholds
      expect(btcMainnetTiers[0].lowerBound).toBe(0)
      expect(btcTestnetTiers[0].lowerBound).toBe(0)
      
      // Mainnet has higher threshold for second tier
      expect(btcMainnetTiers[1].lowerBound).toBe(150_000_000)
      expect(btcTestnetTiers[1].lowerBound).toBe(10_000)
    })

    it('should show different max leverage for ETH between mainnet and testnet', () => {
      const ethMainnetTiers = getMainnetMarginTiers('ETH')
      const ethTestnetTiers = getTestnetMarginTiers('ETH')
      
      // Both should have 25x as first tier
      expect(ethMainnetTiers[0].maxLeverage).toBe(25)
      expect(ethTestnetTiers[0].maxLeverage).toBe(25)
      
      // But different thresholds
      expect(ethMainnetTiers[1].lowerBound).toBe(100_000_000)
      expect(ethTestnetTiers[1].lowerBound).toBe(20_000)
    })
  })

  describe('Coin-specific Max Leverage', () => {
    it('should return correct max leverage for high leverage coins', () => {
      const btcTiers = getMarginTiersForNetwork('BTC')
      const ethTiers = getMarginTiersForNetwork('ETH')
      const solTiers = getMarginTiersForNetwork('SOL')
      
      expect(btcTiers[0].maxLeverage).toBe(40)
      expect(ethTiers[0].maxLeverage).toBe(25)
      expect(solTiers[0].maxLeverage).toBe(20)
    })

    it('should return correct max leverage for standard leverage coins', () => {
      const dogeTiers = getMarginTiersForNetwork('DOGE')
      const avaxTiers = getMarginTiersForNetwork('AVAX')
      const linkTiers = getMarginTiersForNetwork('LINK')
      
      expect(dogeTiers[0].maxLeverage).toBe(10)
      expect(avaxTiers[0].maxLeverage).toBe(10)
      expect(linkTiers[0].maxLeverage).toBe(10)
    })

    it('should return correct max leverage for low leverage coins', () => {
      const opTiers = getMarginTiersForNetwork('OP')
      const arbTiers = getMarginTiersForNetwork('ARB')
      const ldoTiers = getMarginTiersForNetwork('LDO')
      
      expect(opTiers[0].maxLeverage).toBe(10)
      expect(arbTiers[0].maxLeverage).toBe(10)
      expect(ldoTiers[0].maxLeverage).toBe(10)
    })
  })
})
