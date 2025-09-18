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
  sizeUnit: 'USD' | string
  sizePercentage: number
  reduceOnly: boolean
  takeProfitStopLoss: boolean
  limitPrice: string
  limitPriceManuallySet: boolean
  timeInForce: 'GTC' | 'IOC' | 'ALO'
  stopLossPrice: string
  takeProfitPrice: string
  takeProfitGain: string
  stopLossLoss: string
  // Scale order specific fields
  scaleStartPrice: string
  scaleEndPrice: string
  scaleStepSize: string
  scaleOrderCount: string
  scaleSizeDistribution: 'equal' | 'linear'
  // TWAP order specific fields
  twapRunningTimeHours: string
  twapRunningTimeMinutes: string
  twapNumberOfIntervals: string
  twapOrderType: 'market' | 'limit'
  twapPriceOffset: string
  twapRandomize: boolean
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
    limitPriceManuallySet: false,
    timeInForce: 'GTC',
    stopLossPrice: '',
    takeProfitPrice: '',
    takeProfitGain: '10',
    stopLossLoss: '10',
    // Scale order defaults
    scaleStartPrice: '',
    scaleEndPrice: '',
    scaleStepSize: '',
    scaleOrderCount: '5',
    scaleSizeDistribution: 'equal',
    // TWAP order defaults
    twapRunningTimeHours: '0',
    twapRunningTimeMinutes: '30',
    twapNumberOfIntervals: '10',
    twapOrderType: 'market',
    twapPriceOffset: '0.1',
    twapRandomize: false
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

  // Validation functions
  const validateOrder = useCallback(() => {
    const errors: string[] = []

    // Basic validation
    if (!state.size || parseFloat(state.size) <= 0) {
      errors.push('Order size must be greater than 0')
    }

    if (parseFloat(state.size) < 0.001) {
      errors.push('Minimum order size is 0.001')
    }

    // Order type specific validation
    switch (state.orderType) {
      case 'limit':
        if (!state.limitPrice || parseFloat(state.limitPrice) <= 0) {
          errors.push('Limit price must be greater than 0')
        }
        break

      case 'scale':
        if (!state.scaleStartPrice || parseFloat(state.scaleStartPrice) <= 0) {
          errors.push('Scale start price must be greater than 0')
        }
        if (!state.scaleEndPrice || parseFloat(state.scaleEndPrice) <= 0) {
          errors.push('Scale end price must be greater than 0')
        }
        if (!state.scaleOrderCount || parseInt(state.scaleOrderCount) <= 0) {
          errors.push('Scale order count must be greater than 0')
        }
        if (parseInt(state.scaleOrderCount) > 20) {
          errors.push('Maximum 20 scale orders allowed')
        }
        if (parseFloat(state.scaleStartPrice) <= parseFloat(state.scaleEndPrice)) {
          errors.push('Start price must be higher than end price')
        }
        break

      case 'twap':
        if (!state.twapRunningTimeHours || !state.twapRunningTimeMinutes) {
          errors.push('TWAP running time is required')
        }
        const totalMinutes = (parseInt(state.twapRunningTimeHours) * 60) + parseInt(state.twapRunningTimeMinutes)
        if (totalMinutes < 5) {
          errors.push('Minimum TWAP running time is 5 minutes')
        }
        if (totalMinutes > 1440) {
          errors.push('Maximum TWAP running time is 24 hours')
        }
        if (!state.twapNumberOfIntervals || parseInt(state.twapNumberOfIntervals) <= 0) {
          errors.push('Number of intervals must be greater than 0')
        }
        if (parseInt(state.twapNumberOfIntervals) > 100) {
          errors.push('Maximum 100 intervals allowed')
        }
        break
    }

    // Take Profit / Stop Loss validation
    if (state.takeProfitStopLoss) {
      if (state.takeProfitPrice && parseFloat(state.takeProfitPrice) <= 0) {
        errors.push('Take profit price must be greater than 0')
      }
      if (state.stopLossPrice && parseFloat(state.stopLossPrice) <= 0) {
        errors.push('Stop loss price must be greater than 0')
      }
      if (state.takeProfitGain && (parseFloat(state.takeProfitGain) <= 0 || parseFloat(state.takeProfitGain) > 1000)) {
        errors.push('Take profit gain must be between 0.01% and 1000%')
      }
      if (state.stopLossLoss && (parseFloat(state.stopLossLoss) <= 0 || parseFloat(state.stopLossLoss) > 100)) {
        errors.push('Stop loss must be between 0.01% and 100%')
      }
    }

    return errors
  }, [state])

  // Place order
  const placeOrder = useCallback(async (convertedSize?: string, currentPrice?: number) => {
    if (!hyperliquidService.isReady()) {
      setError('SDK not initialized')
      return
    }

    // Validate order parameters
    const validationErrors = validateOrder()
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '))
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Handle scale orders differently
      if (state.orderType === 'scale') {
        return await placeScaleOrder(convertedSize, currentPrice)
      }

      // Handle TWAP orders differently
      if (state.orderType === 'twap') {
        return await placeTwapOrder(convertedSize, currentPrice)
      }

      // Format order according to Hyperliquid API specification
      const orderParams: OrderParams = {
        coin: state.selectedCoin,  // Use selected coin instead of default
        is_buy: state.side === 'buy',  // is_buy
        sz: convertedSize || state.size,  // Use converted size if provided, otherwise use original size
        reduce_only: state.reduceOnly,  // reduce_only
        order_type: getOrderType(state.orderType, state.timeInForce)  // order_type
      }

      // Add price for both limit and market orders
      if (state.orderType === 'limit' && state.limitPrice) {
        const limitPrice = parseFloat(state.limitPrice)
        orderParams.limit_px = formatPriceForTickSize(limitPrice, state.selectedCoin)
      } else if (state.orderType === 'market' && currentPrice) {
        // For market orders, use current market price with a small buffer to ensure execution
        // Add 1% buffer to ensure the order executes immediately
        const buffer = state.side === 'buy' ? 1.01 : 0.99 // 1% above for buy, 1% below for sell
        const marketPrice = formatPriceForTickSize(currentPrice * buffer, state.selectedCoin)
        orderParams.limit_px = marketPrice
        
        console.log('🎣 Hook: Market order price calculation:', {
          currentPrice,
          side: state.side,
          buffer,
          marketPrice,
          orderParams
        })
      }

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

  // Place scale order (multiple orders)
  const placeScaleOrder = useCallback(async (convertedSize?: string, currentPrice?: number) => {
    const startPrice = parseFloat(state.scaleStartPrice)
    const endPrice = parseFloat(state.scaleEndPrice)
    const orderCount = parseInt(state.scaleOrderCount)
    const totalSize = parseFloat(convertedSize || state.size)
    
    // Use currentPrice for validation if needed
    console.log('🎣 Hook: Scale order with current price:', currentPrice)

    // Validate scale order parameters
    if (isNaN(startPrice) || isNaN(endPrice) || isNaN(orderCount) || orderCount <= 0) {
      setError('Please enter valid scale order parameters')
      return
    }

    if (startPrice <= endPrice) {
      setError('Start price must be higher than end price')
      return
    }

    const results = []
    const priceStep = (startPrice - endPrice) / (orderCount - 1)

    for (let i = 0; i < orderCount; i++) {
      const rawPrice = startPrice - (priceStep * i)
      const price = formatPriceForTickSize(rawPrice, state.selectedCoin)
      let size = totalSize / orderCount // Equal distribution
      
      if (state.scaleSizeDistribution === 'linear') {
        // Linear distribution - larger sizes at better prices
        const factor = (orderCount - i) / orderCount
        size = totalSize * factor * (2 / orderCount)
      }

      const orderParams: OrderParams = {
        coin: state.selectedCoin,
        is_buy: state.side === 'buy',
        sz: size.toFixed(4),
        reduce_only: state.reduceOnly,
        order_type: getOrderType('limit', 'GTC'), // Scale orders are limit orders with GTC
        limit_px: price
      }

      try {
        const result = await hyperliquidService.placeOrder(orderParams)
        results.push({ order: i + 1, result, price, size: size.toFixed(4) })
        console.log(`Scale order ${i + 1} placed: $${price} × ${size.toFixed(4)}`)
      } catch (err) {
        console.error(`Failed to place scale order ${i + 1}:`, err)
        results.push({ order: i + 1, error: err, price, size: size.toFixed(4) })
      }
    }

    // Reload account data after all orders
    await loadAccountData()
    
    return {
      type: 'scale',
      results,
      totalOrders: orderCount,
      successfulOrders: results.filter(r => !r.error).length
    }
  }, [state, loadAccountData])

  // Place TWAP order (scheduled orders)
  const placeTwapOrder = useCallback(async (convertedSize?: string, currentPrice?: number) => {
    const runningTimeHours = parseInt(state.twapRunningTimeHours)
    const runningTimeMinutes = parseInt(state.twapRunningTimeMinutes)
    const numberOfIntervals = parseInt(state.twapNumberOfIntervals)
    const totalSize = parseFloat(convertedSize || state.size)
    const priceOffset = parseFloat(state.twapPriceOffset)
    
    // Use currentPrice for validation if needed
    console.log('🎣 Hook: TWAP order with current price:', currentPrice)

    // Calculate total running time in minutes
    const totalRunningTimeMinutes = (runningTimeHours * 60) + runningTimeMinutes
    const intervalDuration = totalRunningTimeMinutes / numberOfIntervals

    // Validate TWAP order parameters
    if (isNaN(runningTimeHours) || isNaN(runningTimeMinutes) || isNaN(numberOfIntervals) || isNaN(totalSize) || isNaN(priceOffset)) {
      setError('Please enter valid TWAP order parameters')
      return
    }

    if (totalRunningTimeMinutes < 5 || totalRunningTimeMinutes > 1440) {
      setError('Running time must be between 5 minutes and 24 hours')
      return
    }

    if (numberOfIntervals <= 0 || totalSize <= 0) {
      setError('Number of intervals and total size must be positive')
      return
    }

    const subOrderSize = totalSize / numberOfIntervals
    const results = []
    const startTime = Date.now()

    // Place the first order immediately
    try {
      const firstOrderParams: OrderParams = {
        coin: state.selectedCoin,
        is_buy: state.side === 'buy',
        sz: subOrderSize.toFixed(4),
        reduce_only: state.reduceOnly,
        order_type: state.twapOrderType === 'market' ? getOrderType('market') : getOrderType('limit', 'GTC')
      }

      // Add price offset for limit orders
      if (state.twapOrderType === 'limit' && currentPrice) {
        // Calculate price with offset for limit orders
        const priceOffset = parseFloat(state.twapPriceOffset) || 0
        const offsetPrice = state.side === 'buy' 
          ? currentPrice - priceOffset 
          : currentPrice + priceOffset
        firstOrderParams.limit_px = formatPriceForTickSize(offsetPrice, state.selectedCoin)
      }

      const firstResult = await hyperliquidService.placeOrder(firstOrderParams)
      results.push({ 
        order: 1, 
        result: firstResult, 
        size: subOrderSize.toFixed(4),
        scheduledTime: new Date(startTime).toISOString(),
        executedTime: new Date().toISOString()
      })
      console.log(`TWAP order 1 placed immediately: ${subOrderSize.toFixed(4)}`)
    } catch (err) {
      console.error(`Failed to place TWAP order 1:`, err)
      results.push({ 
        order: 1, 
        error: err, 
        size: subOrderSize.toFixed(4),
        scheduledTime: new Date(startTime).toISOString()
      })
    }

    // Schedule remaining orders
    for (let i = 1; i < numberOfIntervals; i++) {
      const scheduledTime = startTime + (i * intervalDuration * 60 * 1000) // Convert minutes to milliseconds
      const delay = scheduledTime - Date.now()
      
      if (delay > 0) {
        setTimeout(async () => {
          try {
            const orderParams: OrderParams = {
              coin: state.selectedCoin,
              is_buy: state.side === 'buy',
              sz: subOrderSize.toFixed(4),
              reduce_only: state.reduceOnly,
              order_type: state.twapOrderType === 'market' ? getOrderType('market') : getOrderType('limit', 'GTC')
            }

            // Add price offset for limit orders
            if (state.twapOrderType === 'limit' && currentPrice) {
              const priceOffset = parseFloat(state.twapPriceOffset) || 0
              const offsetPrice = state.side === 'buy' 
                ? currentPrice - priceOffset 
                : currentPrice + priceOffset
              orderParams.limit_px = formatPriceForTickSize(offsetPrice, state.selectedCoin)
            }

            await hyperliquidService.placeOrder(orderParams)
            console.log(`TWAP order ${i + 1} placed: ${subOrderSize.toFixed(4)}`)
          } catch (err) {
            console.error(`Failed to place TWAP order ${i + 1}:`, err)
          }
        }, delay)
      }
    }

    // Reload account data after first order
    await loadAccountData()
    
    return {
      type: 'twap',
      results,
      totalOrders: numberOfIntervals,
      successfulOrders: results.filter(r => !r.error).length,
      totalDuration: totalRunningTimeMinutes,
      intervalDuration,
      subOrderSize: subOrderSize.toFixed(4)
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

  // Helper function to format price according to tick size requirements
  const formatPriceForTickSize = (price: number, coin: string): string => {
    // Extract base coin from coin pair (e.g., "BTC-PERP" -> "BTC")
    const baseCoin = coin.toUpperCase().split('-')[0]
    
    // Define tick sizes for different assets
    const tickSizes: { [key: string]: number } = {
      'BTC': 0.5,      // BTC tick size is typically 0.5
      'ETH': 0.05,     // ETH tick size is typically 0.05
      'SOL': 0.01,     // SOL tick size is typically 0.01
      'DOGE': 0.0001,  // DOGE tick size is typically 0.0001
      'default': 0.01  // Default tick size
    }
    
    const tickSize = tickSizes[baseCoin] || tickSizes.default
    
    // Round price to nearest tick size
    const roundedPrice = Math.round(price / tickSize) * tickSize
    
    // Format with appropriate decimal places
    const decimalPlaces = tickSize < 1 ? Math.abs(Math.log10(tickSize)) : 0
    return roundedPrice.toFixed(decimalPlaces)
  }

  // Helper function to get order type
  const getOrderType = (orderType: string, timeInForce?: string) => {
    switch (orderType) {
      case 'market':
        return { limit: { tif: 'Ioc' as const } } // Market order using IOC limit
      case 'limit':
        // Use selected TIF for limit orders
        const tifMap: { [key: string]: 'Gtc' | 'Ioc' | 'Alo' } = {
          'GTC': 'Gtc',
          'IOC': 'Ioc', 
          'ALO': 'Alo'
        }
        return { limit: { tif: tifMap[timeInForce || 'GTC'] || 'Gtc' } }
      case 'scale':
        return { limit: { tif: 'Gtc' as const } } // Scale orders use GTC
      case 'twap':
        return { limit: { tif: 'Gtc' as const } } // TWAP orders use GTC
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

  // Get position for a specific coin
  const getPositionForCoin = useCallback(async (coin: string) => {
    try {
      const clearinghouseState = await hyperliquidService.getClearinghouseState()
      if (clearinghouseState?.assetPositions) {
        // Find position for the specific coin
        const coinPosition = clearinghouseState.assetPositions.find(
          (pos: any) => pos.position?.coin === coin
        )
        
        if (coinPosition?.position) {
          const position = coinPosition.position
          const size = parseFloat(position.szi || '0')
          const coinName = position.coin || coin
          
          if (size === 0) {
            return `0.00000 ${coinName}`
          } else {
            const side = size > 0 ? 'Long' : 'Short'
            return `${Math.abs(size).toFixed(5)} ${coinName} (${side})`
          }
        }
      }
      return `0.00000 ${coin}`
    } catch (error) {
      console.error('Failed to get position for coin:', error)
      return `0.00000 ${coin}`
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
    getNetworkStatus,
    getPositionForCoin,
    formatPriceForTickSize
  }
}
