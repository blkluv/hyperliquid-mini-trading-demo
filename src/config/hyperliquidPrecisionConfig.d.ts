export interface CoinPrecision {
  szDecimals: number
  pxDecimals: number
  isPerp: boolean
}

export const DEFAULT_PX_DECIMALS: number
export const DEFAULT_SZ_DECIMALS: number

export const COIN_PRECISION_CONFIG: Record<string, CoinPrecision>

export function getCoinPrecision(coin: string): CoinPrecision

export function getDefaultPrecision(): {
  szDecimals: number
  pxDecimals: number
}

export function getSzDecimals(coin: string): number

export function getPxDecimals(coin: string): number
