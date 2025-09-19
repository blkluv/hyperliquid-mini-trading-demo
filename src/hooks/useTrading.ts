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
  scaleOrderCount: string
  scaleSizeSkew: string
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

  // TWAP task monitoring and notifications
  const [activeTwapTasks, setActiveTwapTasks] = useState<Set<string>>(new Set())
  const [twapNotifications, setTwapNotifications] = useState<boolean>(false)
  const [twapTaskDetails, setTwapTaskDetails] = useState<Map<string, any>>(new Map())

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      setTwapNotifications(permission === 'granted')
      return permission === 'granted'
    }
    return false
  }, [])

  // Monitor TWAP tasks
  const monitorTwapTasks = useCallback(async () => {
    if (activeTwapTasks.size === 0) return

    try {
      const tasks = await hyperliquidService.getTwapTasks()
      const completedTasks: string[] = []

      for (const taskId of activeTwapTasks) {
        const task = tasks.tasks.find((t: any) => t.id === taskId)
        if (task) {
          // Update task details
          setTwapTaskDetails(prev => new Map(prev.set(taskId, task)))
          
          if (task.status === 'completed' || task.status === 'failed') {
            completedTasks.push(taskId)
            
            // Show notification
            if (twapNotifications && 'Notification' in window) {
              const notification = new Notification(
                `TWAP Order ${task.status === 'completed' ? 'Completed' : 'Failed'}`,
                {
                  body: `Task ${taskId.slice(-8)}: ${task.completedOrders}/${task.intervals} orders executed`,
                  icon: '/favicon.ico',
                  tag: taskId
                }
              )
              
              // Auto close after 5 seconds
              setTimeout(() => notification.close(), 5000)
            }
          }
        }
      }

      // Remove completed tasks from active list after 30 seconds
      if (completedTasks.length > 0) {
        setTimeout(() => {
          setActiveTwapTasks(prev => {
            const newSet = new Set(prev)
            completedTasks.forEach(taskId => newSet.delete(taskId))
            return newSet
          })
          setTwapTaskDetails(prev => {
            const newMap = new Map(prev)
            completedTasks.forEach(taskId => newMap.delete(taskId))
            return newMap
          })
        }, 30000) // Keep completed tasks visible for 30 seconds
      }
    } catch (error) {
      console.error('Failed to monitor TWAP tasks:', error)
    }
  }, [activeTwapTasks, twapNotifications, hyperliquidService])

  // Start monitoring when there are active tasks
  useEffect(() => {
    if (activeTwapTasks.size > 0) {
      const interval = setInterval(monitorTwapTasks, 2000) // Check every 2 seconds
      return () => clearInterval(interval)
    }
  }, [activeTwapTasks.size, monitorTwapTasks])

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
    scaleOrderCount: '5',
    scaleSizeSkew: '1',
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

        // Get position for the currently selected coin
        let currentPosition = '0.00000 BTC'
        let liquidationPrice = 'N/A'
        
        if (clearinghouseState?.assetPositions) {
          const coinToMatch = state.selectedCoin?.replace('-PERP', '')
          const selectedCoinPosition = clearinghouseState.assetPositions.find(
            (pos: any) => pos.position?.coin === coinToMatch
          )
          
          if (selectedCoinPosition?.position) {
            const position = selectedCoinPosition.position
            const size = parseFloat(position.szi || '0')
            const coinName = position.coin || state.selectedCoin?.replace('-PERP', '') || 'BTC'
            
            if (size === 0) {
              currentPosition = `0.00000 ${coinName}`
            } else {
              const side = size > 0 ? 'Long' : 'Short'
              currentPosition = `${Math.abs(size).toFixed(5)} ${coinName} (${side})`
            }
            
            liquidationPrice = position.liquidationPx || 'N/A'
          }
        }

        setAccountInfo(prev => ({
          ...prev,
          availableToTrade: availableToTrade.toFixed(2),
          currentPosition: currentPosition,
          liquidationPrice: liquidationPrice,
          marginRequired: totalMarginUsed.toFixed(2)
        }))
      }
    } catch (err) {
      console.error('Failed to load account data:', err)
    }
  }, [state.selectedCoin])

  // Validation functions
  const validateOrder = useCallback(() => {
    const errors: string[] = []

    // Basic validation
    if (!state.size || parseFloat(state.size) <= 0) {
      errors.push('Order size must be greater than 0')
    }

    // Check minimum order size based on coin
    const minCoinSizes: { [key: string]: number } = {
      'DOGE-PERP': 1,
      'BTC-PERP': 0.00001,
      'ETH-PERP': 0.0001,
      'SOL-PERP': 0.1,
      'AVAX-PERP': 0.1
    }
    
    const coinMinSize = minCoinSizes[state.selectedCoin] || 0.001
    if (parseFloat(state.size) < coinMinSize) {
      const coinName = state.selectedCoin?.replace('-PERP', '') || 'tokens'
      errors.push(`Minimum order size is ${coinMinSize} ${coinName}`)
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
        order_type: getOrderType(state.orderType, state.timeInForce)
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

      console.log('🎯 Final orderParams before sending:', orderParams)
      
      let result: any
      
      // Check if TP/SL is enabled and we have prices
      if (state.takeProfitStopLoss && 
          (state.takeProfitPrice?.trim() || state.stopLossPrice?.trim())) {
        
        console.log('🎯 Placing grouped TP/SL orders...')
        
        // Create order array with main order + TP/SL orders
        const orders: any[] = [orderParams]
        
        // Add Take Profit order if specified
        if (state.takeProfitPrice && state.takeProfitPrice.trim() !== '') {
          console.log('🎯 Adding Take Profit order to group...')
          const tpPrice = parseFloat(state.takeProfitPrice)
          const tpOrderParams: any = {
            coin: state.selectedCoin,
            is_buy: state.side === 'sell', // TP order is opposite of main order
            sz: convertedSize || state.size,
            limit_px: formatPriceForTickSize(tpPrice, state.selectedCoin), // Execution price
            reduce_only: true, // TP/SL orders should be reduce-only
            order_type: {
              trigger: {
                triggerPx: formatPriceForTickSize(tpPrice, state.selectedCoin), // Trigger price
                isMarket: false, // Execute as limit order
                tpsl: 'tp' // Take profit trigger
              }
            }
          }
          orders.push(tpOrderParams)
        }
        
        // Add Stop Loss order if specified
        if (state.stopLossPrice && state.stopLossPrice.trim() !== '') {
          console.log('🎯 Adding Stop Loss order to group...')
          const slPrice = parseFloat(state.stopLossPrice)
          const slOrderParams: any = {
            coin: state.selectedCoin,
            is_buy: state.side === 'sell', // SL order is opposite of main order
            sz: convertedSize || state.size,
            limit_px: formatPriceForTickSize(slPrice, state.selectedCoin), // Execution price
            reduce_only: true, // TP/SL orders should be reduce-only
            order_type: {
              trigger: {
                triggerPx: formatPriceForTickSize(slPrice, state.selectedCoin), // Trigger price
                isMarket: true, // Execute as market order for SL
                tpsl: 'sl' // Stop loss trigger
              }
            }
          }
          orders.push(slOrderParams)
        }
        
        console.log('🎯 Sending grouped orders:', orders)
        result = await hyperliquidService.placeOrder(orders)
        console.log('✅ Grouped TP/SL orders placed successfully:', result)
      } else {
        // Place single order without TP/SL
        result = await hyperliquidService.placeOrder(orderParams)
        console.log('Order placed successfully:', result)
      }
      
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



    const results = []
    const priceStep = (endPrice - startPrice) / Math.max(1, orderCount - 1)

    // Calculate normalization factor for size skew to ensure total size matches
    const sizeSkew = parseFloat(state.scaleSizeSkew) || 1
    let normalizationFactor = 1
    if (orderCount > 1 && sizeSkew !== 1) {
      let totalSkewFactor = 0
      for (let j = 0; j < orderCount; j++) {
        totalSkewFactor += Math.pow(sizeSkew, j / Math.max(1, orderCount - 1))
      }
      normalizationFactor = orderCount / totalSkewFactor
    }

    for (let i = 0; i < orderCount; i++) {
      const rawPrice = startPrice + (priceStep * i)
      const price = formatPriceForTickSize(rawPrice, state.selectedCoin)
      let size = totalSize / orderCount // Base size
      
      // Apply size skew with normalization
      if (sizeSkew !== 1) {
        const skewFactor = Math.pow(sizeSkew, i / Math.max(1, orderCount - 1))
        size = size * skewFactor * normalizationFactor
      }
      
      // Round to coin-specific precision
      const baseCoin = state.selectedCoin?.toUpperCase().split('-')[0] || 'BTC'
      let roundedSize
      switch (baseCoin) {
        case 'DOGE':
          roundedSize = Math.round(size) // Round to integer
          break
        case 'BTC':
          roundedSize = Math.round(size * 100000) / 100000 // 5 decimal places
          break
        case 'ETH':
          roundedSize = Math.round(size * 10000) / 10000 // 4 decimal places
          break
        case 'SOL':
          roundedSize = Math.round(size * 100) / 100 // 2 decimal places
          break
        default:
          roundedSize = Math.round(size * 1000000) / 1000000 // 6 decimal places
      }
      
      size = roundedSize

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

  // Place TWAP order (server-side implementation)
  const placeTwapOrder = useCallback(async (convertedSize?: string, currentPrice?: number) => {
    const runningTimeHours = parseInt(state.twapRunningTimeHours)
    const runningTimeMinutes = parseInt(state.twapRunningTimeMinutes)
    const totalSize = parseFloat(convertedSize || state.size)
    
    console.log('🎯 Placing server-side TWAP order:', {
      coin: state.selectedCoin,
      side: state.side,
      totalSize,
      durationMinutes: (runningTimeHours * 60) + runningTimeMinutes,
      orderType: 'market'
    })

    // Calculate total running time in minutes and seconds
    const totalRunningTimeMinutes = (runningTimeHours * 60) + runningTimeMinutes
    const totalRunningTimeSeconds = totalRunningTimeMinutes * 60
    
    // Calculate number of orders based on 30-second frequency
    const numberOfOrders = Math.floor(totalRunningTimeSeconds / 30)

    if (numberOfOrders <= 0) {
      setError('Runtime too short. Minimum 1 minute required for TWAP orders')
      return
    }

    if (numberOfOrders < 2) {
      setError('Runtime too short. Minimum 1 minute required for TWAP orders')
      return
    }

    // Calculate raw sub-order size
    const rawSubOrderSize = totalSize / numberOfOrders
    
    // Apply coin-specific rounding (same as UI)
    const baseCoin = state.selectedCoin?.replace('-PERP', '') || 'COIN'
    let roundedSubOrderSize: number
    
    switch (baseCoin) {
      case 'DOGE':
        roundedSubOrderSize = Math.ceil(rawSubOrderSize)
        break
      case 'BTC':
        roundedSubOrderSize = Math.ceil(rawSubOrderSize * 100000) / 100000
        break
      case 'ETH':
        roundedSubOrderSize = Math.ceil(rawSubOrderSize * 10000) / 10000
        break
      case 'SOL':
        roundedSubOrderSize = Math.ceil(rawSubOrderSize * 100) / 100
        break
      default:
        roundedSubOrderSize = Math.ceil(rawSubOrderSize * 1000000) / 1000000
    }

    // Calculate sub-order USD value either from provided USD size or market price
    const totalUsdValue = (() => {
      if (state.sizeUnit === 'USD') {
        const usd = parseFloat(state.size)
        return isNaN(usd) ? null : usd
      }

      if (currentPrice && !isNaN(currentPrice) && currentPrice > 0) {
        return totalSize * currentPrice
      }

      return null
    })()

    if (totalUsdValue === null) {
      setError('Unable to validate TWAP sub-order value. Please ensure market price data is available.')
      return
    }

    // Calculate USD value using rounded size for validation
    const roundedSubOrderUsdValue = state.sizeUnit === 'USD' 
      ? totalUsdValue / numberOfOrders  // USD mode: use original USD value
      : roundedSubOrderSize * (currentPrice || 0)  // Coin mode: recalculate with rounded size
    
    if (roundedSubOrderUsdValue < 10) {
      setError(`Sub-order value too low. Each sub-order would be $${roundedSubOrderUsdValue.toFixed(2)}, but minimum is $10.00`)
      return
    }

    const minCoinSizes: { [key: string]: number } = {
      'DOGE-PERP': 1,
      'BTC-PERP': 0.00001,
      'ETH-PERP': 0.0001,
      'SOL-PERP': 0.1,
      'AVAX-PERP': 0.1
    }

    const coinMinSize = minCoinSizes[state.selectedCoin] || 0
    if (coinMinSize > 0 && roundedSubOrderSize < coinMinSize) {
      const coinLabel = state.selectedCoin?.replace('-PERP', '') || 'asset'
      setError(`Sub-order size too small. Each sub-order would be ${roundedSubOrderSize.toFixed(4)} ${coinLabel}, but minimum is ${coinMinSize} ${coinLabel}`)
      return
    }

    // Validate TWAP order parameters
    if (isNaN(runningTimeHours) || isNaN(runningTimeMinutes) || isNaN(totalSize)) {
      setError('Please enter valid TWAP order parameters')
      return
    }

    if (totalRunningTimeMinutes < 5 || totalRunningTimeMinutes > 1440) {
      setError('Running time must be between 5 minutes and 24 hours')
      return
    }

    if (totalSize <= 0) {
      setError('Total size must be positive')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Calculate adjusted total size using rounded sub-order size
      const adjustedTotalSize = roundedSubOrderSize * numberOfOrders
      
      console.log('🎯 TWAP API call with adjusted sizes:', {
        originalTotalSize: totalSize,
        roundedSubOrderSize,
        adjustedTotalSize,
        numberOfOrders
      })

      // Call server-side TWAP API
      const result = await hyperliquidService.placeTwapOrder({
        coin: state.selectedCoin,
        is_buy: state.side === 'buy',
        totalSize: adjustedTotalSize, // Use adjusted total size with rounded sub-orders
        intervals: numberOfOrders,
        durationMinutes: totalRunningTimeMinutes,
        orderType: 'market', // Always use market orders
        priceOffset: 0, // Not used for market orders
        reduceOnly: state.reduceOnly
      })

      console.log('✅ TWAP order started successfully:', result)

      // Add task to monitoring list
      setActiveTwapTasks(prev => new Set(prev.add(result.taskId)))
      
      // Request notification permission if not already granted
      if (!twapNotifications) {
        await requestNotificationPermission()
      }

      // Reload account data
      await loadAccountData()
      
      return {
        type: 'twap',
        success: true,
        taskId: result.taskId,
        message: result.message,
        task: result.task,
        totalOrders: numberOfOrders,
        totalDuration: totalRunningTimeMinutes,
        subOrderSize: roundedSubOrderSize.toFixed(6) // Use rounded size consistent with UI
      }

    } catch (err) {
      console.error('❌ TWAP order failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to place TWAP order')
      return {
        type: 'twap',
        success: false,
        error: err instanceof Error ? err.message : 'Failed to place TWAP order'
      }
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
      console.error('Failed to update leverage:', err)
      // Don't set error state here - let the component handle it with toast
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
      console.error('Failed to update margin mode:', err)
      // Don't set error state here - let the component handle it with toast
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

  // Sync network with server after initialization
  useEffect(() => {
    const syncNetwork = async () => {
      if (isInitialized) {
        try {
          const serverNetwork = await getNetworkStatus()
          const expectedNetwork = CONFIG.USE_TESTNET ? 'testnet' : 'mainnet'
          
          if (serverNetwork !== 'unknown' && serverNetwork !== expectedNetwork) {
            console.log('🔄 Syncing frontend network with server:', serverNetwork)
            await switchNetwork(serverNetwork as 'testnet' | 'mainnet')
          }
        } catch (err) {
          console.error('Failed to sync network:', err)
        }
      }
    }
    
    syncNetwork()
  }, [isInitialized, getNetworkStatus, switchNetwork])

  // Get position for a specific coin
  const getPositionForCoin = useCallback(async (coin: string) => {
    try {
      const clearinghouseState = await hyperliquidService.getClearinghouseState()
      if (clearinghouseState?.assetPositions) {
        // Find position for the specific coin (remove -PERP suffix for matching)
        const coinToMatch = coin.replace('-PERP', '')
        const coinPosition = clearinghouseState.assetPositions.find(
          (pos: any) => pos.position?.coin === coinToMatch
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

  // Update position for a specific coin immediately
  const updatePositionForCoin = useCallback(async (coin: string) => {
    try {
      const position = await getPositionForCoin(coin)
      setAccountInfo(prev => ({
        ...prev,
        currentPosition: position
      }))
      return position
    } catch (error) {
      console.error('Failed to update position for coin:', error)
      return `0.00000 ${coin}`
    }
  }, [getPositionForCoin])

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
    updatePositionForCoin,
    formatPriceForTickSize,
    // TWAP monitoring
    activeTwapTasks,
    twapTaskDetails,
    twapNotifications,
    requestNotificationPermission
  }
}
