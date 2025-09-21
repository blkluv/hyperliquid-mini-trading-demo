export type PositionSide = 'long' | 'short'
export type MarginType = 'cross' | 'isolated'

export interface LiquidationPriceParams {
  entryPrice: number
  positionSize: number
  side: PositionSide
  marginType: MarginType
  maintenanceMarginFraction: number
  maintenanceMarginDeduction?: number
  accountValue?: number
  isolatedMargin?: number
}

export interface InputLiquidationParams {
  entryPrice: number
  leverage: number
  side: 'buy' | 'sell'
  coin?: string
  marginMode?: MarginType
  accountValue?: number
  isolatedMargin?: number
  positionSize?: number
  walletBalance?: number
  transferRequirement?: number
  marginTiers?: Array<{ lowerBound: number | string; maxLeverage: number }>
  maxLeverage?: number
}

export interface MarginTierResolved {
  lowerBound: number
  maxLeverage: number
}

interface MaintenanceScheduleTier {
  lowerBound: number
  rate: number
  deduction: number
}

// Maintenance margin fractions (l = 1 / maintenance leverage) per asset tier
const MAINTENANCE_MARGIN_FRACTIONS: Record<string, number> = {
  BTC: 1 / (2 * 40), // 0.0125 based on max leverage 40x
  ETH: 1 / (2 * 25), // 0.02 based on max leverage 25x
  SOL: 1 / (2 * 20), // 0.025 based on max leverage 20x
}

const DEFAULT_MAINTENANCE_MARGIN_FRACTION = 1 / (2 * 10) // Assume 10x max leverage when data unavailable

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const toNumber = (value: number | string): number => {
  if (typeof value === 'number') {
    return value
  }
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : NaN
}

const normalizeMarginTiers = (
  tiers?: Array<{ lowerBound: number | string; maxLeverage: number }>
): MarginTierResolved[] => {
  if (!Array.isArray(tiers)) {
    return []
  }

  return tiers
    .map(tier => ({
      lowerBound: toNumber(tier.lowerBound),
      maxLeverage: tier.maxLeverage,
    }))
    .filter(tier => Number.isFinite(tier.lowerBound) && tier.maxLeverage > 0)
    .map(tier => ({
      lowerBound: tier.lowerBound,
      maxLeverage: tier.maxLeverage,
    }))
}

const buildMaintenanceSchedule = (tiers: MarginTierResolved[]): MaintenanceScheduleTier[] => {
  if (!tiers.length) {
    return []
  }

  const sorted = [...tiers].sort((a, b) => a.lowerBound - b.lowerBound)

  const schedule: MaintenanceScheduleTier[] = []
  let previousRate = 0
  let previousDeduction = 0

  sorted.forEach((tier, index) => {
    const rate = tier.maxLeverage > 0 ? 1 / (2 * tier.maxLeverage) : 0

    if (rate <= 0 || rate >= 1) {
      // Skip invalid rates to avoid division issues
      return
    }

    const deduction = index === 0
      ? 0
      : previousDeduction + tier.lowerBound * (rate - previousRate)

    schedule.push({
      lowerBound: tier.lowerBound,
      rate,
      deduction,
    })

    previousRate = rate
    previousDeduction = deduction
  })

  return schedule
}

const selectMaintenanceParameters = (
  notional: number,
  schedule: MaintenanceScheduleTier[],
  fallbackRate: number
): { rate: number; deduction: number } => {
  if (!schedule.length) {
    return { rate: fallbackRate, deduction: 0 }
  }

  if (!Number.isFinite(notional) || notional < 0) {
    return { rate: schedule[0].rate, deduction: schedule[0].deduction }
  }

  let selected = schedule[0]
  for (const tier of schedule) {
    if (notional >= tier.lowerBound) {
      selected = tier
    } else {
      break
    }
  }

  return selected
}

export const getMaintenanceMarginFraction = (coin: string): number => {
  const normalized = coin?.toUpperCase().replace(/-PERP$/, '') || ''
  return MAINTENANCE_MARGIN_FRACTIONS[normalized] ?? DEFAULT_MAINTENANCE_MARGIN_FRACTION
}

export const calculateMaintenanceMarginRequired = (
  positionSize: number,
  price: number,
  maintenanceMarginFraction: number,
  maintenanceMarginDeduction: number = 0
): number => {
  return Math.abs(positionSize) * price * maintenanceMarginFraction - maintenanceMarginDeduction
}

export const calculateLiquidationPrice = ({
  entryPrice,
  positionSize,
  side,
  marginType,
  maintenanceMarginFraction,
  maintenanceMarginDeduction = 0,
  accountValue = 0,
  isolatedMargin = 0,
}: LiquidationPriceParams): number => {
  if (!isFiniteNumber(entryPrice) || entryPrice <= 0) {
    throw new Error('Entry price must be greater than 0.')
  }

  if (!isFiniteNumber(positionSize) || positionSize <= 0) {
    throw new Error('Position size must be greater than 0.')
  }

  if (!isFiniteNumber(maintenanceMarginFraction) || maintenanceMarginFraction <= 0 || maintenanceMarginFraction >= 1) {
    throw new Error('Maintenance margin fraction must be between 0 and 1.')
  }

  const positionMagnitude = Math.abs(positionSize)
  const notionalAtEntry = positionMagnitude * entryPrice
  const sideMultiplier = side === 'long' ? 1 : -1
  const equity = marginType === 'cross' ? accountValue : isolatedMargin

  const numerator = notionalAtEntry - sideMultiplier * (equity + maintenanceMarginDeduction)
  const denominator = positionMagnitude * (1 - maintenanceMarginFraction * sideMultiplier)

  if (Math.abs(denominator) < 1e-12) {
    throw new Error('Invalid parameters: denominator approaches zero.')
  }

  return numerator / denominator
}

export const calculateIsolatedMarginRequirement = (
  positionSize: number,
  entryPrice: number,
  leverage: number
): number => {
  if (!isFiniteNumber(leverage) || leverage <= 0) {
    throw new Error('Leverage must be greater than 0.')
  }

  return Math.abs(positionSize) * entryPrice / leverage
}

export const calculateLiquidationPriceFromInputs = ({
  entryPrice,
  leverage,
  side,
  coin = 'BTC',
  marginMode = 'isolated',
  accountValue = 0,
  isolatedMargin = 0,
  positionSize,
  walletBalance = 0,
  transferRequirement,
  marginTiers,
  maxLeverage,
}: InputLiquidationParams): number => {
  if (!isFiniteNumber(entryPrice) || entryPrice <= 0) {
    throw new Error('Entry price must be greater than 0.')
  }

  if (!isFiniteNumber(leverage) || leverage <= 0) {
    throw new Error('Leverage must be greater than 0.')
  }

  const positionSide: PositionSide = side === 'buy' ? 'long' : 'short'
  const marginType: MarginType = marginMode

  const normalizedMarginTiers = normalizeMarginTiers(marginTiers)
  const maintenanceSchedule = buildMaintenanceSchedule(normalizedMarginTiers)

  const fallbackRate = maintenanceSchedule.length > 0
    ? maintenanceSchedule[0].rate
    : maxLeverage && maxLeverage > 0
      ? 1 / (2 * maxLeverage)
      : getMaintenanceMarginFraction(coin)

  let effectivePositionSize = Math.abs(positionSize ?? 0)
  if (effectivePositionSize === 0) {
    if (marginType === 'isolated' && isolatedMargin > 0) {
      effectivePositionSize = (isolatedMargin * leverage) / entryPrice
    } else if (marginType === 'cross') {
      const availableBalance = accountValue > 0 ? accountValue : walletBalance
      if (availableBalance > 0) {
        effectivePositionSize = (availableBalance * leverage) / entryPrice
      }
    }
  }

  if (effectivePositionSize <= 0) {
    throw new Error('Position size must be greater than 0 for liquidation calculation.')
  }

  const notionalAtEntry = effectivePositionSize * entryPrice
  const initialMarginRequired = notionalAtEntry / leverage

  const transferRequirementValue = isFiniteNumber(transferRequirement) ? transferRequirement : undefined

  let providedAccountValue: number | undefined
  if (accountValue > 0) {
    providedAccountValue = accountValue
  } else if (marginType === 'cross') {
    if (walletBalance > 0 && transferRequirementValue !== undefined) {
      providedAccountValue = walletBalance + transferRequirementValue
    } else if (walletBalance > 0) {
      providedAccountValue = walletBalance
    }
  }

  const resolvedAccountValue = marginType === 'cross'
    ? (providedAccountValue !== undefined ? providedAccountValue : initialMarginRequired)
    : 0

  const resolvedIsolatedMargin = marginType === 'isolated'
    ? (isolatedMargin > 0
        ? isolatedMargin
        : calculateIsolatedMarginRequirement(effectivePositionSize, entryPrice, leverage))
    : 0

  const equity = marginType === 'cross' ? resolvedAccountValue : resolvedIsolatedMargin

  if (!isFiniteNumber(equity) || equity < 0) {
    throw new Error('Margin equity must be a non-negative number.')
  }

  const marginParamsForPrice = (price: number) => {
    const notional = Math.abs(price) * effectivePositionSize
    return selectMaintenanceParameters(notional, maintenanceSchedule, fallbackRate)
  }

  let estimatePrice = entryPrice
  let liquidationPrice = entryPrice

  for (let i = 0; i < 8; i++) {
    const { rate, deduction } = marginParamsForPrice(estimatePrice)

    const candidate = calculateLiquidationPrice({
      entryPrice,
      positionSize: effectivePositionSize,
      side: positionSide,
      marginType,
      maintenanceMarginFraction: rate,
      maintenanceMarginDeduction: deduction,
      accountValue: resolvedAccountValue,
      isolatedMargin: resolvedIsolatedMargin,
    })

    liquidationPrice = candidate

    if (!Number.isFinite(candidate)) {
      throw new Error('Failed to compute liquidation price')
    }

    if (candidate <= 0) {
      break
    }

    const { rate: nextRate, deduction: nextDeduction } = marginParamsForPrice(candidate)

    if (
      Math.abs(candidate - estimatePrice) < 1e-8 &&
      Math.abs(nextRate - rate) < 1e-9 &&
      Math.abs(nextDeduction - deduction) < 1e-3
    ) {
      break
    }

    estimatePrice = candidate
  }

  return liquidationPrice
}
