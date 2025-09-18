import { useState, useEffect, useCallback } from 'react'
import { hyperliquidService, LeverageParams, OrderParams } from '../services/hyperliquidService'
import { CONFIG } from '../config/config'

export interface TradingState {
  selectedCoin: string
  marginMode: 'isolated' | 'cross'
  leverage: number
  orderType: 'market' | 'limit' | 'scale' | 'twap'
  side: 'buy' | 'sell'
  size: string
  sizeUnit: 'USD' | 'BTC'
  sizePercentage: number
  reduceOnly: boolean
  takeProfitStopLoss: boolean
  limitPrice: string
  stopLossPrice: string
  takeProfitPrice: string
}

export interface AccountInfo {
  availableToTrade: string
  currentPosition: string
  liquidationPrice: string
  orderValue: string
  marginRequired: string
  slippage: string
  fees: string
}

export const useTrading = () => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({
    availableToTrade: '56.78',
    currentPosition: '0.00000 BTC',
    liquidationPrice: 'N/A',
    orderValue: 'N/A',
    marginRequired: 'N/A',
    slippage: 'Est: 0% / Max: 8.00%',
    fees: '0.0432% / 0.0144%'
  })

  const [state, setState] = useState<TradingState>({
    selectedCoin: CONFIG.DEFAULT_COIN,
    marginMode: CONFIG.DEFAULT_MARGIN_MODE,
    leverage: CONFIG.DEFAULT_LEVERAGE,
    orderType: 'market',
    side: 'buy',
    size: '',
    sizeUnit: 'USD',
    sizePercentage: 0,
    reduceOnly: false,
    takeProfitStopLoss: false,
    limitPrice: '',
    stopLossPrice: '',
    takeProfitPrice: ''
  })

  // Initialize the SDK
  const initializeSDK = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      await hyperliquidService.initialize(CONFIG.PRIVATE_KEY, CONFIG.USE_TESTNET)
      setIsInitialized(true)
      
      // Load initial account data
      await loadAccountData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize SDK')
      setIsInitialized(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load account data
  const loadAccountData = useCallback(async () => {
    if (!hyperliquidService.isReady()) return

    try {
      // Get wallet balance for account info
      const walletBalance = await hyperliquidService.getWalletBalance()
      
      // Get clearinghouse state for additional info
      const clearinghouseState = await hyperliquidService.getClearinghouseState()

      // Update account info based on the response
      if (walletBalance) {
        const accountValue = parseFloat(walletBalance.accountValue || '0')
        const totalMarginUsed = parseFloat(walletBalance.totalMarginUsed || '0')
        const availableToTrade = accountValue - totalMarginUsed

        setAccountInfo(prev => ({
          ...prev,
          availableToTrade: availableToTrade.toFixed(2),
          currentPosition: clearinghouseState?.assetPositions?.[0]?.position?.coin || '0.00000 BTC',
          liquidationPrice: clearinghouseState?.assetPositions?.[0]?.position?.liquidationPx || 'N/A',
          marginRequired: totalMarginUsed.toFixed(2)
        }))
      }
    } catch (err) {
      console.error('Failed to load account data:', err)
    }
  }, [])

  // Place order
  const placeOrder = useCallback(async () => {
    if (!hyperliquidService.isReady()) {
      setError('SDK not initialized')
      return
    }

    if (!state.size || parseFloat(state.size) <= 0) {
      setError('Please enter a valid order size')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Format order according to Hyperliquid API specification
      const orderParams: OrderParams = {
        coin: state.selectedCoin,  // Use selected coin instead of default
        is_buy: state.side === 'buy',  // is_buy
        sz: state.size,  // size
        reduce_only: state.reduceOnly,  // reduce_only
        order_type: getOrderType(state.orderType)  // order_type
      }

      // Add price only for limit orders
      if (state.orderType === 'limit' && state.limitPrice) {
        orderParams.limit_px = state.limitPrice
      }
      // For market orders, let the server determine the appropriate price

      // Note: Take Profit/Stop Loss orders would need to be placed separately
      // as they are different order types in Hyperliquid

      const result = await hyperliquidService.placeOrder(orderParams)
      console.log('Order placed successfully:', result)
      
      // Reload account data after successful order
      await loadAccountData()
      
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [state, loadAccountData])

  // Update leverage
  const updateLeverage = useCallback(async (leverage: number) => {
    if (!hyperliquidService.isReady()) {
      setError('SDK not initialized')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const leverageParams: LeverageParams = {
        coin: state.selectedCoin,
        leverageMode: state.marginMode,
        leverage
      }

      const result = await hyperliquidService.updateLeverage(leverageParams)
      console.log('Leverage updated successfully:', result)
      
      setState(prev => ({ ...prev, leverage }))
      await loadAccountData()
      
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update leverage')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [state.marginMode, loadAccountData])

  // Update margin mode
  const updateMarginMode = useCallback(async (marginMode: 'isolated' | 'cross') => {
    if (!hyperliquidService.isReady()) {
      setError('SDK not initialized')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Update leverage with new margin mode
      const leverageParams: LeverageParams = {
        coin: state.selectedCoin,
        leverageMode: marginMode,
        leverage: state.leverage
      }

      const result = await hyperliquidService.updateLeverage(leverageParams)
      console.log('Margin mode updated successfully:', result)
      
      setState(prev => ({ ...prev, marginMode }))
      await loadAccountData()
      
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update margin mode')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [state.leverage, loadAccountData])

  // Cancel all orders
  const cancelAllOrders = useCallback(async (coin?: string) => {
    if (!hyperliquidService.isReady()) {
      setError('SDK not initialized')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const result = await hyperliquidService.cancelAllOrders(coin)
      console.log('All orders cancelled successfully:', result)
      
      await loadAccountData()
      
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel orders')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [loadAccountData])

  // Helper function to get order type
  const getOrderType = (orderType: string) => {
    switch (orderType) {
      case 'market':
        return { limit: { tif: 'Ioc' as const } } // Market order using IOC limit
      case 'limit':
        return { limit: { tif: 'Gtc' as const } }
      case 'scale':
        return { limit: { tif: 'Gtc' as const } } // Simplified for now
      case 'twap':
        return { limit: { tif: 'Gtc' as const } } // Simplified for now
      default:
        return { limit: { tif: 'Ioc' as const } }
    }
  }

  // Switch network
  const switchNetwork = useCallback(async (network: 'testnet' | 'mainnet') => {
    console.log('🎣 Hook: Switching network to:', network)
    console.log('🎣 Hook: Service ready?', hyperliquidService.isReady())
    
    if (!hyperliquidService.isReady()) {
      setError('Service not initialized')
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      
      const result = await hyperliquidService.switchNetwork(network)
      
      console.log('🎣 Hook: Network switched:', result)
      
      // Reload account data to reflect new network
      await loadAccountData()
      
    } catch (err) {
      console.error('🎣 Hook: Failed to switch network:', err)
      setError(err instanceof Error ? err.message : 'Failed to switch network')
    } finally {
      setIsLoading(false)
    }
  }, [loadAccountData])

  // Get current network status
  const getNetworkStatus = useCallback(async () => {
    try {
      const health = await hyperliquidService.getHealth()
      return health.network
    } catch (err) {
      console.error('Failed to get network status:', err)
      return 'unknown'
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    initializeSDK()
  }, [initializeSDK])

  return {
    state,
    setState,
    accountInfo,
    isInitialized,
    isLoading,
    error,
    placeOrder,
    updateLeverage,
    updateMarginMode,
    cancelAllOrders,
    loadAccountData,
    switchNetwork,
    getNetworkStatus
  }
}
