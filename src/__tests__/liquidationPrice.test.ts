import { describe, it, expect } from 'vitest'

import {
  calculateIsolatedMarginRequirement,
  calculateLiquidationPrice,
  calculateLiquidationPriceFromInputs,
  getMaintenanceMarginFraction,
} from '../utils/liquidationPrice'

describe('calculateLiquidationPrice', () => {
  it('computes isolated long liquidation price using documented formula', () => {
    const entryPrice = 50000
    const positionSize = 0.2
    const leverage = 10
    const maintenanceFraction = getMaintenanceMarginFraction('BTC')
    const isolatedMargin = calculateIsolatedMarginRequirement(positionSize, entryPrice, leverage)

    const liquidationPrice = calculateLiquidationPrice({
      entryPrice,
      positionSize,
      side: 'long',
      marginType: 'isolated',
      isolatedMargin,
      maintenanceMarginFraction: maintenanceFraction,
    })

    expect(liquidationPrice).toBeCloseTo(45569.6203, 4)
  })

  it('computes isolated short liquidation price', () => {
    const entryPrice = 50000
    const positionSize = 0.2
    const leverage = 10
    const maintenanceFraction = getMaintenanceMarginFraction('BTC')
    const isolatedMargin = calculateIsolatedMarginRequirement(positionSize, entryPrice, leverage)

    const liquidationPrice = calculateLiquidationPrice({
      entryPrice,
      positionSize,
      side: 'short',
      marginType: 'isolated',
      isolatedMargin,
      maintenanceMarginFraction: maintenanceFraction,
    })

    expect(liquidationPrice).toBeCloseTo(54320.9877, 4)
  })

  it('computes cross margin long liquidation price with excess equity', () => {
    const entryPrice = 50000
    const positionSize = 0.1
    const maintenanceFraction = getMaintenanceMarginFraction('BTC')
    const accountValue = 1500 // account equity allocated to cross margin

    const liquidationPrice = calculateLiquidationPrice({
      entryPrice,
      positionSize,
      side: 'long',
      marginType: 'cross',
      accountValue,
      maintenanceMarginFraction: maintenanceFraction,
    })

    expect(liquidationPrice).toBeCloseTo(35443.038, 4)
  })

  it('computes cross margin short liquidation price with excess equity', () => {
    const entryPrice = 50000
    const positionSize = 0.1
    const maintenanceFraction = getMaintenanceMarginFraction('BTC')
    const accountValue = 1500

    const liquidationPrice = calculateLiquidationPrice({
      entryPrice,
      positionSize,
      side: 'short',
      marginType: 'cross',
      accountValue,
      maintenanceMarginFraction: maintenanceFraction,
    })

    expect(liquidationPrice).toBeCloseTo(64197.5309, 4)
  })

  it('supports negative liquidation price when margin greatly exceeds requirement', () => {
    const entryPrice = 50000
    const positionSize = 0.1
    const maintenanceFraction = getMaintenanceMarginFraction('BTC')
    const accountValue = 10000

    const liquidationPrice = calculateLiquidationPrice({
      entryPrice,
      positionSize,
      side: 'long',
      marginType: 'cross',
      accountValue,
      maintenanceMarginFraction: maintenanceFraction,
    })

    expect(liquidationPrice).toBeLessThan(0)
    expect(liquidationPrice).toBeCloseTo(-50632.9114, 4)
  })

  it('applies maintenance deductions when using higher margin tiers', () => {
    const entryPrice = 50000
    const positionSize = 4000 // $200M notional
    const accountValue = 5_000_000
    const maintenanceFraction = 1 / (2 * 20)
    const maintenanceDeduction = 150_000_000 * (maintenanceFraction - (1 / (2 * 40)))

    const liquidationPrice = calculateLiquidationPrice({
      entryPrice,
      positionSize,
      side: 'long',
      marginType: 'cross',
      accountValue,
      maintenanceMarginFraction: maintenanceFraction,
      maintenanceMarginDeduction: maintenanceDeduction,
    })

    expect(liquidationPrice).toBeCloseTo(49519.2308, 4)
  })

  it('selects default maintenance fraction for unknown coins', () => {
    const entryPrice = 1000
    const positionSize = 1
    const maintenanceFraction = getMaintenanceMarginFraction('UNKNOWN')

    const liquidationPrice = calculateLiquidationPrice({
      entryPrice,
      positionSize,
      side: 'long',
      marginType: 'isolated',
      isolatedMargin: 100,
      maintenanceMarginFraction: maintenanceFraction,
    })

    expect(maintenanceFraction).toBeCloseTo(0.05, 10)
    expect(liquidationPrice).toBeCloseTo(947.3684, 4)
  })

  it('throws when position size is zero', () => {
    const maintenanceFraction = getMaintenanceMarginFraction('BTC')

    expect(() =>
      calculateLiquidationPrice({
        entryPrice: 50000,
        positionSize: 0,
        side: 'long',
        marginType: 'isolated',
        isolatedMargin: 1000,
        maintenanceMarginFraction: maintenanceFraction,
      })
    ).toThrow('Position size must be greater than 0.')
  })
})

describe('calculateLiquidationPriceFromInputs', () => {
  it('derives isolated margin liquidation using leverage and isolated margin only', () => {
    const liquidationPrice = calculateLiquidationPriceFromInputs({
      entryPrice: 50000,
      leverage: 10,
      side: 'buy',
      coin: 'BTC',
      marginMode: 'isolated',
      isolatedMargin: 1000,
    })

    expect(liquidationPrice).toBeCloseTo(45569.6203, 4)
  })

  it('derives cross margin liquidation when only account equity is provided', () => {
    const liquidationPrice = calculateLiquidationPriceFromInputs({
      entryPrice: 50000,
      leverage: 10,
      side: 'sell',
      coin: 'BTC',
      marginMode: 'cross',
      accountValue: 1500,
    })

    expect(liquidationPrice).toBeCloseTo(54320.9877, 4)
  })

  it('uses at least initial margin when provided cross equity is below requirement', () => {
    const liquidationPrice = calculateLiquidationPriceFromInputs({
      entryPrice: 20000,
      leverage: 20,
      side: 'buy',
      coin: 'BTC',
      marginMode: 'cross',
      accountValue: 100, // below initial margin requirement (1000)
      positionSize: 1,
    })

    // With cross mode we assume at least the initial margin is sourced
    expect(liquidationPrice).toBeCloseTo(19240.5063, 4)
  })

  it('derives cross liquidation using transfer requirement fallback (capped to at least initial margin)', () => {
    const liquidationPrice = calculateLiquidationPriceFromInputs({
      entryPrice: 115510,
      leverage: 9,
      side: 'buy',
      coin: 'BTC',
      marginMode: 'cross',
      walletBalance: 976.17,
      transferRequirement: 8537.52,
      positionSize: 1,
    })

    expect(liquidationPrice).toBeCloseTo(103975.246, 3)
  })

  it('respects margin tier deductions when provided (cross equity at least initial margin)', () => {
    const liquidationPrice = calculateLiquidationPriceFromInputs({
      entryPrice: 50000,
      leverage: 5,
      side: 'buy',
      coin: 'BTC',
      marginMode: 'cross',
      accountValue: 5_000_000,
      positionSize: 4000,
      marginTiers: [
        { lowerBound: 0, maxLeverage: 40 },
        { lowerBound: 150_000_000, maxLeverage: 20 },
      ],
      maxLeverage: 40,
    })

    // Initial margin here is 200,000,000 / 5 = 40,000,000, which dominates account equity
    expect(liquidationPrice).toBeCloseTo(40544.8718, 4)
  })
})
