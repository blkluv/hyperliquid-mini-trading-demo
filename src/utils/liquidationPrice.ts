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

// Debug flag helper: enable in browser console via `window.__LIQ_DEBUG = true`
const liqDebugEnabled = (): boolean => {
  try {
    // @ts-ignore - window may not exist in tests/node
    return typeof window !== 'undefined' && (window as any).__LIQ_DEBUG === true
  } catch {
    return false
  }
}

// Maintenance margin fractions (l = 1 / maintenance leverage) per asset tier
const MAINTENANCE_MARGIN_FRACTIONS: Record<string, number> = {
  // Use maintenance fraction l = 1 / (2 * maxLeverage)
  // This matches observed HL UI liquidation behavior with tiered schedules.
  BTC: 1 / (2 * 40), // 0.0125
  ETH: 1 / (2 * 25), // 0.02
  SOL: 1 / (2 * 10), // 0.02
  JUP: 1 / (2 * 50), 
  PENGU: 1 / (2 * 5),
  XRP: 1 / (2 * 20),
  DOGE: 1 / (2 * 10),
  ADA: 1 / (2 * 10),
  UNI: 1 / (2 * 10),
  NEAR: 1 / (2 * 10),
  TIA: 1 / (2 * 10),
  APT: 1 / (2 * 10),
  BCH: 1 / (2 * 10),
  HYPE: 1 / (2 * 10),
  FARTCOIN: 1 / (2 * 10),
  OP: 1 / (2 * 10),
  ARB: 1 / (2 * 10),
  ZETA: 1 / (2 * 10),
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
    // maintenance fraction uses half of initial margin: l = 1 / (2 * maxLeverage)
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

/**
 * Calculate maintenance leverage based on notional position value and margin tiers
 * Maintenance leverage = 2 * maxLeverage for the applicable tier
 * @param notional - Notional position value (positionSize * price)
 * @param marginTiers - Array of margin tiers with lowerBound and maxLeverage
 * @param fallbackMaxLeverage - Fallback max leverage if no tiers provided
 * @returns Maintenance leverage value
 */
export const calculateMaintenanceLeverage = (
  notional: number,
  marginTiers?: Array<{ lowerBound: number | string; maxLeverage: number }>,
  fallbackMaxLeverage?: number
): number => {
  if (!isFiniteNumber(notional) || notional < 0) {
    return fallbackMaxLeverage ? 2 * fallbackMaxLeverage : 20 // Default to 20x maintenance leverage
  }

  const normalizedTiers = normalizeMarginTiers(marginTiers)
  
  if (normalizedTiers.length === 0) {
    return fallbackMaxLeverage ? 2 * fallbackMaxLeverage : 20
  }

  // Find the appropriate tier based on notional value
  const sortedTiers = [...normalizedTiers].sort((a, b) => a.lowerBound - b.lowerBound)
  let selectedTier = sortedTiers[0]

  for (const tier of sortedTiers) {
    if (notional >= tier.lowerBound) {
      selectedTier = tier
    } else {
      break
    }
  }

  // Maintenance leverage = 2 * maxLeverage
  return 2 * selectedTier.maxLeverage
}

/**
 * Get maintenance leverage for a specific coin with fallback values
 * @param coin - Coin symbol
 * @param notional - Notional position value
 * @param marginTiers - Optional margin tiers
 * @param isTestnet - Whether to use testnet tiers (default: true)
 * @returns Maintenance leverage value
 */
export const getMaintenanceLeverageForCoin = (
  coin: string,
  notional: number,
  marginTiers?: Array<{ lowerBound: number | string; maxLeverage: number }>,
  isTestnet: boolean = true
): number => {
  const normalized = coin?.toUpperCase().replace(/-PERP$/, '') || ''
  
  // Use coin-specific max leverage as fallback
  const coinMaxLeverage = getCoinMaxLeverage(normalized)
  
  return calculateMaintenanceLeverage(notional, marginTiers, coinMaxLeverage)
}

/**
 * Get maintenance leverage for a specific coin with automatic network detection
 * @param coin - Coin symbol
 * @param notional - Notional position value
 * @param marginTiers - Optional margin tiers
 * @returns Maintenance leverage value
 */
export const getMaintenanceLeverageForCoinWithNetworkDetection = (
  coin: string,
  notional: number,
  marginTiers?: Array<{ lowerBound: number | string; maxLeverage: number }>
): number => {
  const normalized = coin?.toUpperCase().replace(/-PERP$/, '') || ''
  
  // If no margin tiers provided, try to get them based on network detection
  if (!marginTiers) {
    marginTiers = getMarginTiersForNetwork(coin)
  }
  
  // Use coin-specific max leverage as fallback
  const coinMaxLeverage = getCoinMaxLeverage(normalized)
  
  return calculateMaintenanceLeverage(notional, marginTiers, coinMaxLeverage)
}

/**
 * Get coin-specific max leverage for fallback calculations
 * Updated to use testnet margin tiers as per Hyperliquid documentation
 */
const getCoinMaxLeverage = (coin: string): number => {
  // Testnet margin tiers from https://hyperliquid.gitbook.io/hyperliquid-docs/trading/margin-tiers#testnet-margin-tiers
  const testnetCoinMaxLeverages: Record<string, number> = {
    // BTC - testnet only
    BTC: 40,
    // ETH - testnet only  
    ETH: 25,
    // DOGE, TIA, SUI, kSHIB, AAVE, TON - testnet only
    DOGE: 10,
    TIA: 10,
    SUI: 10,
    kSHIB: 10,
    AAVE: 10,
    TON: 10,
    // LDO, ARB, MKR, ATOM, PAXG, TAO, ICP, AVAX, FARTCOIN - testnet only
    LDO: 10,
    ARB: 10,
    MKR: 10,
    ATOM: 10,
    PAXG: 10,
    TAO: 10,
    ICP: 10,
    AVAX: 10,
    FARTCOIN: 10,
  }
  
  return testnetCoinMaxLeverages[coin] ?? 10
}

/**
 * Get mainnet margin tiers for a specific coin
 * Based on https://hyperliquid.gitbook.io/hyperliquid-docs/trading/margin-tiers#mainnet-margin-tiers
 */
export const getMainnetMarginTiers = (coin: string): Array<{ lowerBound: number; maxLeverage: number }> => {
  const normalized = coin?.toUpperCase().replace(/-PERP$/, '') || ''
  
  switch (normalized) {
    case 'BTC':
      return [
        { lowerBound: 0, maxLeverage: 40 },
        { lowerBound: 150_000_000, maxLeverage: 20 },
      ]
    
    case 'ETH':
      return [
        { lowerBound: 0, maxLeverage: 25 },
        { lowerBound: 100_000_000, maxLeverage: 15 },
      ]
    
    case 'SOL':
      return [
        { lowerBound: 0, maxLeverage: 20 },
        { lowerBound: 70_000_000, maxLeverage: 10 },
      ]
    
    case 'XRP':
      return [
        { lowerBound: 0, maxLeverage: 20 },
        { lowerBound: 40_000_000, maxLeverage: 10 },
      ]
    
    // DOGE, kPEPE, SUI, WLD, TRUMP, LTC, ENA, POPCAT, WIF, AAVE, kBONK, LINK, CRV, AVAX, ADA, UNI, NEAR, TIA, APT, BCH, HYPE, FARTCOIN
    case 'DOGE':
    case 'kPEPE':
    case 'SUI':
    case 'WLD':
    case 'TRUMP':
    case 'LTC':
    case 'ENA':
    case 'POPCAT':
    case 'WIF':
    case 'AAVE':
    case 'kBONK':
    case 'LINK':
    case 'CRV':
    case 'AVAX':
    case 'ADA':
    case 'UNI':
    case 'NEAR':
    case 'TIA':
    case 'APT':
    case 'BCH':
    case 'HYPE':
    case 'FARTCOIN':
      return [
        { lowerBound: 0, maxLeverage: 10 },
        { lowerBound: 20_000_000, maxLeverage: 5 },
      ]
    
    // OP, ARB, LDO, TON, MKR, ONDO, JUP, INJ, kSHIB, SEI, TRX, BNB, DOT
    case 'OP':
    case 'ARB':
    case 'LDO':
    case 'TON':
    case 'MKR':
    case 'ONDO':
    case 'JUP':
    case 'INJ':
    case 'kSHIB':
    case 'SEI':
    case 'TRX':
    case 'BNB':
    case 'DOT':
      return [
        { lowerBound: 0, maxLeverage: 10 },
        { lowerBound: 3_000_000, maxLeverage: 5 },
      ]
    
    default:
      // Default fallback for unknown coins
      return [
        { lowerBound: 0, maxLeverage: 10 },
        { lowerBound: 3_000_000, maxLeverage: 5 },
      ]
  }
}

/**
 * Get margin tiers based on network type (mainnet or testnet)
 * Automatically selects the appropriate tier configuration
 * @param coin - Coin symbol
 * @param isTestnet - Whether to use testnet tiers (default: true)
 * @returns Array of margin tiers
 */
export const getMarginTiers = (coin: string, isTestnet: boolean = true): Array<{ lowerBound: number; maxLeverage: number }> => {
  return isTestnet ? getTestnetMarginTiers(coin) : getMainnetMarginTiers(coin)
}

/**
 * Get margin tiers with network detection from environment
 * @param coin - Coin symbol
 * @returns Array of margin tiers
 */
export const getMarginTiersForNetwork = (coin: string): Array<{ lowerBound: number; maxLeverage: number }> => {
  // Check if we're in a browser environment and can access window
  if (typeof window !== 'undefined') {
    // Try to get network status from the app state
    try {
      // @ts-ignore - window may have app-specific properties
      const appNetwork = (window as any).__HYPERLIQUID_NETWORK
      if (appNetwork === 'mainnet' || appNetwork === 'testnet') {
        return getMarginTiers(coin, appNetwork === 'testnet')
      }
    } catch (error) {
      console.warn('Could not detect network from window, defaulting to testnet')
    }
  }
  
  // Default to testnet for safety
  return getTestnetMarginTiers(coin)
}

/**
 * Get testnet margin tiers for a specific coin
 * Based on https://hyperliquid.gitbook.io/hyperliquid-docs/trading/margin-tiers#testnet-margin-tiers
 */
export const getTestnetMarginTiers = (coin: string): Array<{ lowerBound: number; maxLeverage: number }> => {
  const normalized = coin?.toUpperCase().replace(/-PERP$/, '') || ''
  
  switch (normalized) {
    case 'BTC':
      return [
        { lowerBound: 0, maxLeverage: 40 },
        { lowerBound: 10_000, maxLeverage: 25 },
        { lowerBound: 50_000, maxLeverage: 10 },
        { lowerBound: 100_000, maxLeverage: 5 },
        { lowerBound: 300_000, maxLeverage: 3 },
      ]
    
    case 'ETH':
      return [
        { lowerBound: 0, maxLeverage: 25 },
        { lowerBound: 20_000, maxLeverage: 10 },
        { lowerBound: 50_000, maxLeverage: 5 },
        { lowerBound: 200_000, maxLeverage: 3 },
      ]
    
    case 'DOGE':
    case 'TIA':
    case 'SUI':
    case 'kSHIB':
    case 'AAVE':
    case 'TON':
      return [
        { lowerBound: 0, maxLeverage: 10 },
        { lowerBound: 20_000, maxLeverage: 5 },
        { lowerBound: 100_000, maxLeverage: 3 },
      ]
    
    case 'LDO':
    case 'ARB':
    case 'MKR':
    case 'ATOM':
    case 'PAXG':
    case 'TAO':
    case 'ICP':
    case 'AVAX':
    case 'FARTCOIN':
      return [
        { lowerBound: 0, maxLeverage: 10 },
        { lowerBound: 10_000, maxLeverage: 5 },
      ]
    
    default:
      // Default fallback for unknown coins
      return [
        { lowerBound: 0, maxLeverage: 10 },
        { lowerBound: 10_000, maxLeverage: 5 },
      ]
  }
}

/**
 * Calculate liquidation price with maintenance leverage details
 * This function provides additional information about maintenance leverage used
 */
export const calculateLiquidationWithMaintenanceLeverage = ({
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
}: InputLiquidationParams): LiquidationDetails & { maintenanceLeverage: number } => {
  // Calculate basic liquidation details
  const liquidationDetails = calculateLiquidationWithDetailsFromInputs({
    entryPrice,
    leverage,
    side,
    coin,
    marginMode,
    accountValue,
    isolatedMargin,
    positionSize,
    walletBalance,
    transferRequirement,
    marginTiers,
    maxLeverage,
  })

  // Calculate maintenance leverage for the position
  const notionalAtEntry = Math.abs(positionSize ?? 0) * entryPrice
  const maintenanceLeverage = getMaintenanceLeverageForCoin(coin, notionalAtEntry, marginTiers)

  return {
    ...liquidationDetails,
    maintenanceLeverage,
  }
}

/**
 * Calculate liquidation price with automatic network detection and maintenance leverage
 * This function automatically detects the network and uses appropriate margin tiers
 */
export const calculateLiquidationWithNetworkDetection = ({
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
  isTestnet = true, // Default to testnet for safety
}: InputLiquidationParams & { isTestnet?: boolean }): LiquidationDetails & { maintenanceLeverage: number; networkType: string } => {
  // Use provided margin tiers or get them based on network
  const effectiveMarginTiers = marginTiers || getMarginTiers(coin, isTestnet)
  
  // Calculate basic liquidation details
  const liquidationDetails = calculateLiquidationWithDetailsFromInputs({
    entryPrice,
    leverage,
    side,
    coin,
    marginMode,
    accountValue,
    isolatedMargin,
    positionSize,
    walletBalance,
    transferRequirement,
    marginTiers: effectiveMarginTiers,
    maxLeverage,
  })

  // Calculate maintenance leverage for the position
  const notionalAtEntry = Math.abs(positionSize ?? 0) * entryPrice
  const maintenanceLeverage = getMaintenanceLeverageForCoin(coin, notionalAtEntry, effectiveMarginTiers, isTestnet)

  return {
    ...liquidationDetails,
    maintenanceLeverage,
    networkType: isTestnet ? 'testnet' : 'mainnet',
  }
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
  // Use the lesser of user-selected leverage and the tier-allowed max leverage at entry notional
  // This aligns IM fallback with Hyperliquid's opening constraints for the given notional.
  let allowedLevAtEntry = leverage
  if (normalizedMarginTiers.length > 0) {
    const sorted = [...normalizedMarginTiers].sort((a, b) => a.lowerBound - b.lowerBound)
    for (const tier of sorted) {
      if (notionalAtEntry >= tier.lowerBound) {
        allowedLevAtEntry = tier.maxLeverage
      } else {
        break
      }
    }
  } else if (typeof maxLeverage === 'number' && maxLeverage > 0) {
    allowedLevAtEntry = maxLeverage
  }
  const leverageForIM = Math.max(1, Math.min(leverage, allowedLevAtEntry))
  const initialMarginRequired = notionalAtEntry / leverageForIM

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

  // In cross mode, assume at least initial margin will be sourced (transfer) to open the position.
  // Use the larger of provided account equity and the initial margin requirement.
  const resolvedAccountValue = marginType === 'cross'
    ? Math.max(providedAccountValue ?? 0, initialMarginRequired)
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

  if (liqDebugEnabled()) {
    console.log('[LIQ DEBUG][INPUTS]', {
      entryPrice,
      leverage,
      side,
      coin,
      marginMode,
      positionSize: effectivePositionSize,
      initialMarginRequired,
      providedAccountValue,
      resolvedAccountValue,
      resolvedIsolatedMargin,
      walletBalance,
      transferRequirement: transferRequirementValue,
      marginTiers: normalizedMarginTiers,
      fallbackRate,
    })
  }

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

    if (liqDebugEnabled()) {
      console.log('[LIQ DEBUG][INTERNAL]', {
        iteration: i,
        q: effectivePositionSize,
        p0: entryPrice,
        equity,
        rate,
        deduction,
        candidate,
        notionalAtCandidate: Math.abs(candidate) * effectivePositionSize,
      })
    }

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

export interface LiquidationDetails {
  price: number
  rate: number
  deduction: number
  equityUsed: number
}

export const calculateLiquidationWithDetailsFromInputs = ({
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
}: InputLiquidationParams): LiquidationDetails => {
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
  // Align IM with tier-allowed leverage at entry notional
  let allowedLevAtEntry = leverage
  if (normalizedMarginTiers.length > 0) {
    const sorted = [...normalizedMarginTiers].sort((a, b) => a.lowerBound - b.lowerBound)
    for (const tier of sorted) {
      if (notionalAtEntry >= tier.lowerBound) {
        allowedLevAtEntry = tier.maxLeverage
      } else {
        break
      }
    }
  } else if (typeof maxLeverage === 'number' && maxLeverage > 0) {
    allowedLevAtEntry = maxLeverage
  }
  const leverageForIM = Math.max(1, Math.min(leverage, allowedLevAtEntry))
  const initialMarginRequired = notionalAtEntry / leverageForIM

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

  // Optional developer override for equity to help validate scenarios
  const getEquityOverride = (): number | undefined => {
    try {
      // @ts-ignore
      const w: any = typeof window !== 'undefined' ? window : undefined
      const fromGlobal = w && typeof w.__LIQ_EQUITY_OVERRIDE === 'number' && Number.isFinite(w.__LIQ_EQUITY_OVERRIDE) && w.__LIQ_EQUITY_OVERRIDE > 0
        ? (w.__LIQ_EQUITY_OVERRIDE as number)
        : undefined
      const fromStorage = w && w.localStorage ? w.localStorage.getItem('LIQ_EQUITY_OVERRIDE') : undefined
      const parsed = fromStorage ? parseFloat(fromStorage) : NaN
      const validStorage = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
      return fromGlobal ?? validStorage
    } catch {
      return undefined
    }
  }
  const equityOverride = getEquityOverride()
  if (equityOverride !== undefined && marginType === 'cross') {
    providedAccountValue = equityOverride
  }

  const resolvedAccountValue = marginType === 'cross'
    ? Math.max(providedAccountValue ?? 0, initialMarginRequired)
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
  let lastRate = fallbackRate
  let lastDeduction = 0

  for (let i = 0; i < 8; i++) {
    const { rate, deduction } = marginParamsForPrice(estimatePrice)
    lastRate = rate
    lastDeduction = deduction

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

  return { price: liquidationPrice, rate: lastRate, deduction: lastDeduction, equityUsed: equity }
}
