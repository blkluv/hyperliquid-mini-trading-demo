import React, { useState, useEffect } from 'react'
import { ChevronDown, TrendingUp, AlertCircle, Network } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { useTrading } from '../hooks/useTrading'
import { usePriceSubscription } from '../hooks/usePriceSubscription'
import OrderResponsePopup, { OrderResponse } from './OrderResponsePopup'
import { CONFIG } from '../config/config'
import { TradingConfigHelper } from '../config/tradingConfig'
import { hyperliquidService } from '../services/hyperliquidService'

const TradingInterface: React.FC = () => {
  const {
    state,
    setState,
    accountInfo,
    isInitialized,
    isLoading,
    error,
    placeOrder,
    updateLeverage,
    updateMarginMode,
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
  } = useTrading()

  const [currentNetwork, setCurrentNetwork] = useState<'testnet' | 'mainnet' | 'unknown'>('unknown')
  const [orderResponse, setOrderResponse] = useState<OrderResponse | null>(null)
  const [showOrderPopup, setShowOrderPopup] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set())
  const [showConfirmPopup, setShowConfirmPopup] = useState(false)
  const [pendingOrder, setPendingOrder] = useState<any>(null)

  // Add custom styles for the leverage slider
  React.useEffect(() => {
    const style = document.createElement('style')
    style.textContent = `
      .slider {
        -webkit-appearance: none;
        appearance: none;
        height: 12px;
        border-radius: 6px;
        outline: none;
        transition: all 0.3s ease;
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
      }
      
      .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: linear-gradient(135deg, #14b8a6, #0d9488);
        cursor: pointer;
        border: 3px solid #ffffff;
        box-shadow: 0 4px 8px rgba(20, 184, 166, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;
      }
      
      .slider::-webkit-slider-thumb:hover {
        background: linear-gradient(135deg, #0d9488, #0f766e);
        transform: scale(1.15);
        box-shadow: 0 6px 12px rgba(20, 184, 166, 0.4), 0 4px 8px rgba(0, 0, 0, 0.3);
      }
      
      .slider::-webkit-slider-thumb:active {
        transform: scale(1.05);
      }
      
      .slider::-moz-range-thumb {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: linear-gradient(135deg, #14b8a6, #0d9488);
        cursor: pointer;
        border: 3px solid #ffffff;
        box-shadow: 0 4px 8px rgba(20, 184, 166, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;
      }
      
      .slider::-moz-range-thumb:hover {
        background: linear-gradient(135deg, #0d9488, #0f766e);
        transform: scale(1.15);
        box-shadow: 0 6px 12px rgba(20, 184, 166, 0.4), 0 4px 8px rgba(0, 0, 0, 0.3);
      }
      
      .slider:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .slider:disabled::-webkit-slider-thumb {
        cursor: not-allowed;
        transform: none;
      }
      
      .slider:disabled::-moz-range-thumb {
        cursor: not-allowed;
        transform: none;
      }
      
      /* Margin Mode Dropdown Styles */
      .margin-mode-dropdown {
        position: relative;
        overflow: hidden;
      }
      
      .margin-mode-dropdown::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(20, 184, 166, 0.1), transparent);
        transition: left 0.5s;
      }
      
      .margin-mode-dropdown:hover::before {
        left: 100%;
      }
      
      .margin-mode-dropdown:hover .toggle-indicator {
        transform: scale(1.1);
        background-color: #14b8a6;
      }
      
      .margin-mode-dropdown:active {
        transform: scale(0.98);
      }
    `
    document.head.appendChild(style)
    
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  // Toast notifications for loading states
  React.useEffect(() => {
    if (isLoading) {
      toast.loading('Processing your order...', {
        id: 'order-processing',
        duration: Infinity,
        style: {
          background: '#1e293b',
          color: '#14b8a6',
          border: '1px solid #14b8a6',
        },
      })
    } else {
      toast.dismiss('order-processing')
    }
  }, [isLoading])

  // Toast notification for TWAP completion
  const [completedTasks, setCompletedTasks] = React.useState<Set<string>>(new Set())
  
  React.useEffect(() => {
    if (activeTwapTasks.size > 0) {
      Array.from(activeTwapTasks).forEach(taskId => {
        const task = twapTaskDetails.get(taskId)
        if (task && !completedTasks.has(taskId)) {
          const totalProcessed = task.completedOrders + task.failedOrders
          const progress = totalProcessed >= task.intervals ? 100 : (task.completedOrders / task.intervals) * 100
          
          // Show toast when progress reaches 100% and task is completed
          if (progress >= 100 && task.status === 'completed') {
            toast.success(`TWAP order completed: ${task.completedOrders}/${task.intervals} orders executed successfully`, {
              duration: 5000,
              style: {
                background: '#065f46',
                color: '#ffffff',
                border: '1px solid #10b981',
              },
            })
            // Mark this task as completed to avoid duplicate toasts
            setCompletedTasks(prev => new Set(prev).add(taskId))
          }
        }
      })
    }
  }, [activeTwapTasks, twapTaskDetails, completedTasks])
  
  // Helper function to mark field as touched
  const markFieldAsTouched = (fieldName: string) => {
    setTouchedFields(prev => new Set(prev).add(fieldName))
  }

  // Generic rounding functions
  // Detect tick size from the number of decimals in input
  const getTick = (value: number): number => {
    const s = value.toString()
    if (s.includes('.')) {
      return 1 / Math.pow(10, s.split('.')[1].length)
    }
    return 1
  }


  const roundDown = (value: number): number => {
    const tick = getTick(value)
    return Number((Math.floor(value / tick) * tick).toFixed(safeDecimals(tick)))
  }

  // Helper: count decimals for formatting
  const safeDecimals = (tick: number): number => {
    const s = tick.toString()
    return s.includes('.') ? s.split('.')[1].length : 0
  }

  // Generic coin-specific rounding function
  const roundCoinSize = (rawSize: number, baseCoin: string): number => {
    const coinKey = `${baseCoin}-PERP`
    const precision = TradingConfigHelper.getRoundingPrecision(coinKey)
    
    if (precision === 0) {
      // Round to integer
      return roundDown(rawSize)
    } else {
      // Round to specified decimal places
      const multiplier = Math.pow(10, precision)
      return roundDown(Math.round(rawSize * multiplier) / multiplier)
    }
  }

  // Helper function to convert USD to coin size with coin-specific rounding
  const convertUsdToCoinSize = (usdAmount: number, coinPrice: number, coin: string): number => {
    const rawSize = usdAmount / coinPrice
    
    // Extract base coin from coin pair (e.g., "BTC-PERP" -> "BTC")
    const baseCoin = coin.toUpperCase().split('-')[0]
    
    // Apply coin-specific rounding rules using generic function
    return roundCoinSize(rawSize, baseCoin)
  }

  // Helper function to get the actual coin size for API calls
  const getCoinSizeForApi = (): number => {
    if (!state.size || !topCardPrice) return 0
    
    const sizeValue = parseFloat(state.size)
    if (isNaN(sizeValue) || sizeValue <= 0) return 0
    
    if (state.sizeUnit === 'USD') {
      return convertUsdToCoinSize(sizeValue, topCardPrice, state.selectedCoin)
    } else {
      return sizeValue // Already in coin units
    }
  }

  // Helper function to calculate liquidation price
  const calculateLiquidationPrice = (
    entryPrice: number,
    leverage: number,
    side: 'buy' | 'sell',
    coin: string = 'BTC',
    marginMode: 'isolated' | 'cross' = 'isolated',
    walletBalance: number = 0 // for cross margin
  ) => {
    // realistic small maintenance margin ratios (exchange-style)
    const maintenanceMargins: { [key: string]: number } = {
      'BTC': 0.004,   // 0.4%
      'ETH': 0.005,   // 0.5%
      'SOL': 0.01,    // 1%
      'default': 0.005
    }

    const maintenanceMargin = maintenanceMargins[coin] || maintenanceMargins.default
    
    if (side === 'buy') {
      // For long positions: LP = Entry Price * (1 - (1/Leverage) + Maintenance Margin)
      // Example: BTC at $50,000, 10x leverage, 4% maintenance margin
      // LP = 50,000 * (1 - (1/10) + 0.04) = 50,000 * (1 - 0.1 + 0.04) = 50,000 * 0.94 = $47,000
      // This means the price can drop by 6% before liquidation
      return entryPrice * (1 - (1 / leverage) + maintenanceMargin)
    } else {
      // For short positions: LP = Entry Price * (1 + (1/Leverage) - Maintenance Margin)
      // Example: BTC at $50,000, 10x leverage, 4% maintenance margin
      // LP = 50,000 * (1 + (1/10) - 0.04) = 50,000 * (1 + 0.1 - 0.04) = 50,000 * 1.06 = $53,000
      // This means the price can rise by 6% before liquidation
      return entryPrice * (1 + (1 / leverage) - maintenanceMargin)
    }
  }
  
  // Price subscription for selected coin
  const { price: currentPrice, prices: priceMap, isConnected: priceConnected, error: priceError } = usePriceSubscription(
    state.selectedCoin, 
    currentNetwork === 'testnet'
  )

  // Initialize position for the selected coin when component mounts or coin changes
  useEffect(() => {
    const initializePosition = async () => {
      if (state.selectedCoin && isInitialized) {
        try {
          const position = await getPositionForCoin(state.selectedCoin)
          console.log(`Position for ${state.selectedCoin}:`, position)
        } catch (error) {
          console.error('Failed to initialize position for selected coin:', error)
        }
      }
    }

    initializePosition()
  }, [state.selectedCoin, isInitialized, getPositionForCoin])


  const formatPairLabel = (symbol: string) => {
    if (!symbol) return 'N/A'
    if (symbol.includes('-PERP')) {
      return symbol.replace('-PERP', '/USDC')
    }
    if (symbol.includes('-USD')) {
      return symbol.replace('-USD', '/USD')
    }
    return symbol
  }

  const selectedCoinKey = state.selectedCoin?.toUpperCase() || ''
  const topCardPrice = selectedCoinKey && priceMap && priceMap[selectedCoinKey] !== undefined
    ? (() => {
        const priceData = priceMap[selectedCoinKey]
        // Handle both old format (number) and new format (object with price property)
        return typeof priceData === 'object' && priceData !== null && 'price' in priceData
          ? parseFloat(priceData.price.toString())
          : parseFloat(String(priceData))
      })()
    : currentPrice

  // Auto-update limit price with current market price when available (only if not manually set)
  useEffect(() => {
    if (state.orderType === 'limit' && typeof topCardPrice === 'number' && !state.limitPrice && !state.limitPriceManuallySet) {
      setState(prev => ({ ...prev, limitPrice: topCardPrice.toString() }))
    }
  }, [topCardPrice, state.orderType, state.limitPrice, state.limitPriceManuallySet])

  // Update limit price when coin changes (if limit order is selected)
  useEffect(() => {
    if (state.orderType === 'limit' && typeof topCardPrice === 'number' && !touchedFields.has('limitPrice')) {
      setState(prev => ({ ...prev, limitPrice: topCardPrice.toString() }))
    }
  }, [state.selectedCoin, topCardPrice, state.orderType, touchedFields])

  // Update size unit when coin changes (if currently showing a coin unit)
  useEffect(() => {
    if (state.sizeUnit !== 'USD') {
      setState(prev => ({ ...prev, sizeUnit: state.selectedCoin }))
    }
  }, [state.selectedCoin])

  // Auto-calculate TP/SL prices when enabled
  useEffect(() => {
    if (state.takeProfitStopLoss && typeof topCardPrice === 'number') {
      const gainPercent = parseFloat(state.takeProfitGain) / 100
      const lossPercent = parseFloat(state.stopLossLoss) / 100
      
      setState(prev => {
        const newState = { ...prev }
        
        if (prev.side === 'buy') {
          newState.takeProfitPrice = (topCardPrice * (1 + gainPercent)).toFixed(2)
          newState.stopLossPrice = (topCardPrice * (1 - lossPercent)).toFixed(2)
        } else {
          newState.takeProfitPrice = (topCardPrice * (1 - gainPercent)).toFixed(2)
          newState.stopLossPrice = (topCardPrice * (1 + lossPercent)).toFixed(2)
        }
        
        return newState
      })
    }
  }, [state.takeProfitStopLoss, topCardPrice, state.side, state.takeProfitGain, state.stopLossLoss])

  // Real-time validation
  useEffect(() => {
    const errors: string[] = []

    // 1. Required Fields Present (only show if field has been touched)
    if (touchedFields.has('selectedCoin') && !state.selectedCoin) {
      errors.push('Please select a symbol/coin')
    }
    if (touchedFields.has('side') && !state.side) {
      errors.push('Please choose order side (Buy/Sell)')
    }
    if (touchedFields.has('size') && (!state.size || state.size.trim() === '')) {
      errors.push('Please enter order quantity')
    }

    // 2. Valid Quantity & Data Type Safety (only show if size field has been touched)
    if (touchedFields.has('size') && state.size && state.size.trim() !== '') {
      const sizeValue = parseFloat(state.size.trim())
      
      // Check for valid number
      if (isNaN(sizeValue)) {
        errors.push('Order quantity must be a valid number')
      } else if (sizeValue <= 0) {
        errors.push('Order quantity must be greater than 0')
      } else {
        // Check minimum order size based on coin
        const coinMinSize = TradingConfigHelper.getMinOrderSize(state.selectedCoin)
        if (sizeValue < coinMinSize) {
          errors.push(`Minimum order size is ${coinMinSize} ${state.selectedCoin?.replace('-PERP', '') || 'tokens'}`)
        }
      }
      
      if (errors.length === 0) {
        // 3. Check minimum order value
        const orderValue = state.sizeUnit === 'USD' 
          ? sizeValue  // For USD, order value is the size itself
          : sizeValue * (currentPrice || 0)  // For coin units, multiply by price
        
        if (orderValue > 0 && !TradingConfigHelper.validateOrderValue(orderValue)) {
          errors.push(`Minimum order value is $${TradingConfigHelper.getMinOrderValueUsd()} USD`)
        }
        
        // 5. UX Warnings for extreme values
        if (orderValue > TradingConfigHelper.getMaxOrderValueWarningUsd()) {
          errors.push(`Warning: Order value is extremely large (>$${TradingConfigHelper.getMaxOrderValueWarningUsd() / 1000000}M)`)
        }
        if (orderValue > 0 && orderValue < 1) {
          errors.push('Warning: Order value is extremely small (<$1)')
        }
      }
    }

    // 4. Sufficient Balance (frontend hint) - only show if size field has been touched
    if (touchedFields.has('size') && state.size && state.side && currentPrice && accountInfo) {
      const sizeValue = parseFloat(state.size.trim())
      if (!isNaN(sizeValue) && sizeValue > 0) {
        const orderValue = state.sizeUnit === 'USD' 
          ? sizeValue  // For USD, order value is the size itself
          : sizeValue * currentPrice  // For coin units, multiply by price
        
        if (state.side === 'buy') {
          // Check available balance for buy orders
          const availableBalance = parseFloat(accountInfo.availableToTrade || '0')
          if (orderValue > availableBalance) {
            errors.push(`Insufficient balance. Required: $${orderValue.toFixed(2)}, Available: $${availableBalance.toFixed(2)}`)
          }
          
          // Reduce-only validation for buy orders
          if (state.reduceOnly) {
            const positionMatch = accountInfo.currentPosition.match(/(\d+\.?\d*)\s+(\w+)/)
            if (positionMatch) {
              const availablePosition = parseFloat(positionMatch[1])
              if (availablePosition >= 0) {
                // Buy reduce-only order when position is positive or zero would increase position
                errors.push('Reduce-only buy order would increase position. Use regular sell order to reduce position.')
              }
            } else {
              // If we can't parse position, show error for reduce-only buy orders
              errors.push('Cannot validate reduce-only buy order: Unable to parse current position. Please check your position and try again.')
            }
          }
        } else {
          // For sell orders, check position and margin requirements
          const availableBalance = parseFloat(accountInfo.availableToTrade || '0')
          const positionMatch = accountInfo.currentPosition.match(/(\d+\.?\d*)\s+(\w+)/)
          
          if (positionMatch) {
            const availablePosition = parseFloat(positionMatch[1])
            
            // Reduce-only validation: Check if order would increase position
            if (state.reduceOnly) {
              if (availablePosition <= 0) {
                // Sell reduce-only order when position is negative or zero would increase position
                errors.push('Reduce-only sell order would increase position. Use regular buy order to reduce position.')
              } else if (sizeValue > availablePosition) {
                // Sell reduce-only order for more than available position would increase position
                errors.push(`Reduce-only sell order would increase position. Maximum sell size: ${availablePosition.toFixed(6)} ${state.selectedCoin}`)
              }
            }
            
            if (sizeValue <= availablePosition) {
              // Regular sell - user has sufficient position
              // No additional validation needed
            } else {
              // Short sell - user is selling more than they own
              const shortAmount = sizeValue - availablePosition
              const shortValue = shortAmount * currentPrice
              const requiredMargin = shortValue / state.leverage
              
              if (requiredMargin > availableBalance) {
                errors.push(`Insufficient margin for short sell. Required margin: $${requiredMargin.toFixed(2)}, Available: $${availableBalance.toFixed(2)}`)
              }
              
              // Additional short sell validations
              if (state.leverage > 20) {
                errors.push('Maximum leverage for short selling is 20x')
              }
              
              if (requiredMargin < 50) {
                errors.push('Minimum margin required for short selling is $50')
              }
            }
          } else {
            // If we can't parse position, assume it's a short sell and check margin
            const shortValue = sizeValue * currentPrice
            const requiredMargin = shortValue / state.leverage
            
            // Reduce-only validation for unparseable position
            if (state.reduceOnly) {
              errors.push('Cannot validate reduce-only order: Unable to parse current position. Please check your position and try again.')
            }
            
            if (requiredMargin > availableBalance) {
              errors.push(`Insufficient margin for short sell. Required margin: $${requiredMargin.toFixed(2)}, Available: $${availableBalance.toFixed(2)}`)
            }
            
            // Additional short sell validations
            if (state.leverage > 20) {
              errors.push('Maximum leverage for short selling is 20x')
            }
            
            if (requiredMargin < 50) {
              errors.push('Minimum margin required for short selling is $50')
            }
          }
        }
      }
    }

    // Order type specific validation
    switch (state.orderType) {
      case 'limit':
        if (touchedFields.has('limitPrice')) {
          if (state.limitPrice && state.limitPrice.trim() !== '') {
            const priceValue = parseFloat(state.limitPrice.trim())
            if (isNaN(priceValue)) {
              errors.push('Limit price must be a valid number')
            } else if (priceValue <= 0) {
              errors.push('Limit price must be greater than 0')
            }
          } else {
            errors.push('Limit price is required for limit orders')
          }
        }
        break

      case 'scale':
        if (touchedFields.has('scaleStartPrice')) {
          if (state.scaleStartPrice && state.scaleStartPrice.trim() !== '') {
            const startPrice = parseFloat(state.scaleStartPrice.trim())
            if (isNaN(startPrice) || startPrice <= 0) {
              errors.push('Scale start price must be a valid positive number')
            }
          } else {
            errors.push('Scale start price is required')
          }
        }
        
        if (touchedFields.has('scaleEndPrice')) {
          if (state.scaleEndPrice && state.scaleEndPrice.trim() !== '') {
            const endPrice = parseFloat(state.scaleEndPrice.trim())
            if (isNaN(endPrice) || endPrice <= 0) {
              errors.push('Scale end price must be a valid positive number')
            }
          } else {
            errors.push('Scale end price is required')
          }
        }
        
        if ((touchedFields.has('scaleStartPrice') || touchedFields.has('scaleEndPrice')) && 
            state.scaleStartPrice && state.scaleEndPrice && 
            state.scaleStartPrice.trim() !== '' && state.scaleEndPrice.trim() !== '') {
          // Price validation is handled in individual field validations
        }
        
        if (touchedFields.has('scaleOrderCount')) {
          if (state.scaleOrderCount && state.scaleOrderCount.trim() !== '') {
            const orderCount = parseInt(state.scaleOrderCount.trim())
            if (isNaN(orderCount) || orderCount <= 0) {
              errors.push('Scale order count must be a valid positive number')
            } else if (orderCount > 20) {
              errors.push('Maximum 20 scale orders allowed')
            }
          } else {
            errors.push('Scale order count is required')
          }
        }
        
        // Scale sub-order value validation
        if (touchedFields.has('size') && state.size && state.size.trim() !== '' && 
            state.scaleOrderCount && state.scaleOrderCount.trim() !== '' &&
            state.scaleStartPrice && state.scaleEndPrice &&
            state.scaleStartPrice.trim() !== '' && state.scaleEndPrice.trim() !== '') {
          const totalSize = parseFloat(state.size.trim())
          const orderCount = parseInt(state.scaleOrderCount.trim())
          const startPrice = parseFloat(state.scaleStartPrice.trim())
          const endPrice = parseFloat(state.scaleEndPrice.trim())
          
          if (!isNaN(totalSize) && !isNaN(orderCount) && !isNaN(startPrice) && !isNaN(endPrice) && 
              totalSize > 0 && orderCount > 0 && startPrice > 0 && endPrice > 0) {
            
            // Calculate average price for sub-order value estimation
            const avgPrice = (startPrice + endPrice) / 2
            
            if (state.sizeUnit === 'USD') {
              // For USD mode, each sub-order gets equal USD value
              const subOrderUsdValue = totalSize / orderCount
              if (!TradingConfigHelper.validateOrderValue(subOrderUsdValue, true)) {
                errors.push(`Scale sub-order value too low: $${subOrderUsdValue.toFixed(2)} (minimum: $10.00)`)
              }
            } else {
              // For coin mode, calculate USD value using average price
              const subOrderSize = totalSize / orderCount
              const subOrderUsdValue = subOrderSize * avgPrice
              if (!TradingConfigHelper.validateOrderValue(subOrderUsdValue, true)) {
                errors.push(`Scale sub-order value too low: $${subOrderUsdValue.toFixed(2)} (minimum: $10.00)`)
              }
            }
          }
        }
        break

      case 'twap':
        if (touchedFields.has('twapRunningTime')) {
          if (state.twapRunningTimeHours && state.twapRunningTimeMinutes) {
            const hours = parseInt(state.twapRunningTimeHours)
            const minutes = parseInt(state.twapRunningTimeMinutes)
            if (isNaN(hours) || isNaN(minutes)) {
              errors.push('TWAP running time must be valid numbers')
            } else {
              const totalMinutes = (hours * 60) + minutes
              if (totalMinutes < 5) {
                errors.push('Minimum TWAP running time is 5 minutes')
              }
              if (totalMinutes > 1440) {
                errors.push('Maximum TWAP running time is 24 hours')
              }
            }
          } else {
            errors.push('TWAP running time is required')
          }
        }
        
        if (touchedFields.has('twapNumberOfIntervals')) {
          if (state.twapNumberOfIntervals && state.twapNumberOfIntervals.trim() !== '') {
            const intervals = parseInt(state.twapNumberOfIntervals.trim())
            if (isNaN(intervals) || intervals <= 0) {
              errors.push('Number of intervals must be a valid positive number')
            } else if (intervals > 100) {
              errors.push('Maximum 100 intervals allowed')
            }
          } else {
            errors.push('Number of intervals is required for TWAP orders')
          }
        }
        
        // TWAP sub-order value validation
        if (touchedFields.has('size') && state.size && state.size.trim() !== '' && 
            state.twapRunningTimeHours && state.twapRunningTimeMinutes) {
          const hours = parseInt(state.twapRunningTimeHours)
          const minutes = parseInt(state.twapRunningTimeMinutes)
          const totalSize = parseFloat(state.size)
          
          if (!isNaN(hours) && !isNaN(minutes) && !isNaN(totalSize)) {
            const totalRunningTimeMinutes = (hours * 60) + minutes
            const totalRunningTimeSeconds = totalRunningTimeMinutes * 60
            const numberOfOrders = Math.floor(totalRunningTimeSeconds / 30)
            
            if (numberOfOrders >= 2) {
              // Calculate sub-order size and apply rounding
              let subOrderSize: number
              let subOrderUsdValue: number
              
              if (state.sizeUnit === 'USD') {
                // For USD mode, calculate coin size from USD value
                const subOrderUsdValueRaw = totalSize / numberOfOrders
                subOrderSize = currentPrice ? subOrderUsdValueRaw / currentPrice : 0
                subOrderUsdValue = subOrderUsdValueRaw
              } else {
                // For coin mode, calculate USD value using current price
                subOrderSize = totalSize / numberOfOrders
                subOrderUsdValue = subOrderSize * (currentPrice || 0)
              }
              
              // Apply coin-specific rounding
              const baseCoin = state.selectedCoin?.replace('-PERP', '') || 'COIN'
              const roundedSubOrderSize = roundCoinSize(subOrderSize, baseCoin)
              
              // Recalculate USD value with rounded size
              const roundedSubOrderUsdValue = state.sizeUnit === 'USD' 
                ? subOrderUsdValue  // USD mode: use original USD value
                : roundedSubOrderSize * (currentPrice || 0)  // Coin mode: recalculate with rounded size
              
              if (!TradingConfigHelper.validateOrderValue(roundedSubOrderUsdValue, true)) {
                errors.push(`TWAP sub-order value too low: $${roundedSubOrderUsdValue.toFixed(2)} (minimum: $10.00)`)
              }
            }
          }
        }

        const priceForValidation = typeof topCardPrice === 'number'
          ? topCardPrice
          : (typeof currentPrice === 'number' ? currentPrice : undefined)

        const shouldValidateSubOrderValue =
          (touchedFields.has('size') && state.size && state.size.trim() !== '') ||
          touchedFields.has('twapRunningTime') ||
          touchedFields.has('twapNumberOfIntervals')

        if (shouldValidateSubOrderValue &&
            state.twapRunningTimeHours &&
            state.twapRunningTimeMinutes &&
            state.size && state.size.trim() !== '') {
          const hours = parseInt(state.twapRunningTimeHours)
          const minutes = parseInt(state.twapRunningTimeMinutes)
          const sizeValue = parseFloat(state.size.trim())

          if (!isNaN(hours) && !isNaN(minutes) && !isNaN(sizeValue) && sizeValue > 0) {
            const totalMinutes = (hours * 60) + minutes
            if (totalMinutes > 0) {
              const totalSeconds = totalMinutes * 60
              const numberOfOrders = Math.floor(totalSeconds / 30)

              if (numberOfOrders > 0) {
                let totalUsdValue: number | null = null

                if (state.sizeUnit === 'USD') {
                  totalUsdValue = sizeValue
                } else if (priceForValidation && priceForValidation > 0) {
                  totalUsdValue = sizeValue * priceForValidation
                }

                if (totalUsdValue === null) {
                  errors.push('Unable to validate TWAP sub-order value without market price data')
                } else {
                  const subOrderUsdValue = totalUsdValue / numberOfOrders
                  if (!TradingConfigHelper.validateOrderValue(subOrderUsdValue, true)) {
                    errors.push(`Each TWAP sub-order must be at least $10. Current plan is $${subOrderUsdValue.toFixed(2)}.`)
                  }

                  const coinMinSize = TradingConfigHelper.getMinOrderSize(state.selectedCoin)
                  if (coinMinSize > 0) {
                    let subOrderCoinSize: number | null = null

                    if (state.sizeUnit === 'USD') {
                      if (priceForValidation && priceForValidation > 0) {
                        const totalCoinSize = totalUsdValue / priceForValidation
                        subOrderCoinSize = totalCoinSize / numberOfOrders
                      }
                    } else {
                      subOrderCoinSize = sizeValue / numberOfOrders
                    }

                    if (subOrderCoinSize !== null && subOrderCoinSize < coinMinSize) {
                      const coinLabel = state.selectedCoin?.replace('-PERP', '') || 'asset'
                      errors.push(`Each TWAP sub-order must be at least ${coinMinSize} ${coinLabel}. Current plan is ${subOrderCoinSize.toFixed(4)} ${coinLabel}.`)
                    }
                  }
                }
              }
            }
          }
        }
        break
    }

    // 5. Leverage-specific validation for all order types
    if (touchedFields.has('size') && state.size && state.size.trim() !== '' && currentPrice && accountInfo) {
      const sizeValue = parseFloat(state.size.trim())
      if (!isNaN(sizeValue) && sizeValue > 0) {
        const orderValue = state.sizeUnit === 'USD' 
          ? sizeValue  // For USD, order value is the size itself
          : sizeValue * currentPrice  // For coin units, multiply by price
        const availableBalance = parseFloat(accountInfo.availableToTrade || '0')
        const requiredMargin = orderValue / state.leverage
        
        // Check if user has sufficient margin for the leverage
        if (requiredMargin > availableBalance) {
          errors.push(`Insufficient margin for ${state.leverage}x leverage. Required: $${requiredMargin.toFixed(2)}, Available: $${availableBalance.toFixed(2)}`)
        }
        
        // Order type specific leverage validations
        switch (state.orderType) {
          case 'market':
            // Market orders: Standard leverage limits
            if (state.leverage > 50) {
              errors.push('Maximum leverage for market orders is 50x')
            }
            if (state.leverage < 1) {
              errors.push('Minimum leverage is 1x')
            }
            break
            
          case 'limit':
            // Limit orders: Standard leverage limits
            if (state.leverage > 50) {
              errors.push('Maximum leverage for limit orders is 50x')
            }
            if (state.leverage < 1) {
              errors.push('Minimum leverage is 1x')
            }
            break
            
          case 'scale':
            // Scale orders: More conservative leverage due to multiple orders
            if (state.leverage > 20) {
              errors.push('Maximum leverage for scale orders is 20x (risk management)')
            }
            if (state.leverage < 1) {
              errors.push('Minimum leverage is 1x')
            }
            
            // Additional scale order leverage validation
            if (state.scaleOrderCount && state.scaleOrderCount.trim() !== '') {
              const orderCount = parseInt(state.scaleOrderCount.trim())
              if (!isNaN(orderCount) && orderCount > 0) {
                const maxLeverage = TradingConfigHelper.getMaxLeverageForScaleOrders(orderCount)
                if (state.leverage > maxLeverage) {
                  errors.push(`Maximum ${maxLeverage}x leverage allowed for scale orders with ${orderCount} orders`)
                }
              }
            }
            break
            
          case 'twap':
            // TWAP orders: Conservative leverage due to time exposure
            if (state.leverage > 15) {
              errors.push('Maximum leverage for TWAP orders is 15x (time exposure risk)')
            }
            if (state.leverage < 1) {
              errors.push('Minimum leverage is 1x')
            }
            
            // Additional TWAP leverage validation based on duration
            if (state.twapRunningTimeHours && state.twapRunningTimeMinutes) {
              const hours = parseInt(state.twapRunningTimeHours)
              const minutes = parseInt(state.twapRunningTimeMinutes)
              if (!isNaN(hours) && !isNaN(minutes)) {
                const totalMinutes = (hours * 60) + minutes
                
                // Longer TWAP periods require lower leverage
                const maxLeverage = TradingConfigHelper.getMaxLeverageForTwapOrders(totalMinutes)
                if (state.leverage > maxLeverage) {
                  const hours = Math.floor(totalMinutes / 60)
                  errors.push(`Maximum ${maxLeverage}x leverage for TWAP orders longer than ${hours} hours`)
                }
              }
            }
            break
        }
        
        // Side-specific leverage validations
        if (state.side === 'sell') {
          // Short selling has additional leverage restrictions
          if (state.leverage > 20) {
            errors.push('Maximum leverage for short selling is 20x')
          }
        }
        
        // Asset-specific leverage validations
        const assetLeverageLimits: { [key: string]: number } = {
          'BTC': 50,   // Bitcoin: Standard limits
          'ETH': 40,   // Ethereum: Slightly lower
          'SOL': 30,   // Solana: More volatile
          'default': 50
        }
        
        const maxLeverageForAsset = assetLeverageLimits[state.selectedCoin] || assetLeverageLimits.default
        if (state.leverage > maxLeverageForAsset) {
          errors.push(`Maximum leverage for ${state.selectedCoin} is ${maxLeverageForAsset}x`)
        }
        
        // Minimum margin requirements based on leverage
        const minMargin = TradingConfigHelper.getMinMarginRequirement(state.leverage)
        if (minMargin > 0 && requiredMargin < minMargin) {
          errors.push(`Minimum margin required for ${state.leverage}x+ leverage is $${minMargin}`)
        }
        if (state.leverage >= 40 && requiredMargin < 500) {
          errors.push('Minimum margin required for 40x+ leverage is $500')
        }
      }
    }

    // Take Profit / Stop Loss validation
    if (state.takeProfitStopLoss) {
      if (touchedFields.has('takeProfitPrice') && state.takeProfitPrice && state.takeProfitPrice.trim() !== '') {
        const tpPrice = parseFloat(state.takeProfitPrice.trim())
        if (isNaN(tpPrice) || tpPrice <= 0) {
          errors.push('Take profit price must be a valid positive number')
        }
      }
      
      if (touchedFields.has('stopLossPrice') && state.stopLossPrice && state.stopLossPrice.trim() !== '') {
        const slPrice = parseFloat(state.stopLossPrice.trim())
        if (isNaN(slPrice) || slPrice <= 0) {
          errors.push('Stop loss price must be a valid positive number')
        }
      }
      
      if (touchedFields.has('takeProfitGain') && state.takeProfitGain && state.takeProfitGain.trim() !== '') {
        const tpGain = parseFloat(state.takeProfitGain.trim())
        if (isNaN(tpGain) || tpGain <= 0 || tpGain > 1000) {
          errors.push(`Take profit gain must be between 0.01% and ${1000}%`)
        }
      }
      
      if (touchedFields.has('stopLossLoss') && state.stopLossLoss && state.stopLossLoss.trim() !== '') {
        const slLoss = parseFloat(state.stopLossLoss.trim())
        if (isNaN(slLoss) || slLoss <= 0 || slLoss > 100) {
          errors.push(`Stop loss must be between 0.01% and ${100}%`)
        }
      }
    }

    setValidationErrors(errors)
  }, [state, currentPrice, accountInfo, touchedFields, topCardPrice])
  
  const handleSizeChange = (value: string) => {
    // Normalize input: trim spaces, allow only numbers and decimal point
    const normalizedValue = value.trim().replace(/[^0-9.]/g, '')
    markFieldAsTouched('size')
    setState(prev => ({ ...prev, size: normalizedValue }))
  }

  const handleSizePercentageChange = (percentage: number) => {
    setState(prev => ({ ...prev, sizePercentage: percentage }))
  }

  const handleLimitPriceChange = (value: string) => {
    // Normalize input: trim spaces, only allow numeric input (including decimal point)
    const trimmedValue = value.trim()
    const numericValue = trimmedValue.replace(/[^0-9.]/g, '')
    // Prevent multiple decimal points
    const parts = numericValue.split('.')
    const formattedValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : numericValue
    markFieldAsTouched('limitPrice')
    setState(prev => ({ ...prev, limitPrice: formattedValue }))
  }

  const handleLimitPriceBlur = () => {
    // Format price according to tick size when user finishes editing
    if (state.limitPrice && !isNaN(parseFloat(state.limitPrice))) {
      const price = parseFloat(state.limitPrice)
      const formattedPrice = formatPriceForTickSize(price, state.selectedCoin)
      setState(prev => ({ ...prev, limitPrice: formattedPrice }))
    }
  }


  const handleTwapNumericChange = (field: 'twapRunningTimeHours' | 'twapRunningTimeMinutes' | 'twapNumberOfIntervals' | 'twapPriceOffset', value: string) => {
    // Normalize input: trim spaces, only allow numeric input (including decimal point)
    const trimmedValue = value.trim()
    const numericValue = trimmedValue.replace(/[^0-9.]/g, '')
    // Prevent multiple decimal points
    const parts = numericValue.split('.')
    const formattedValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : numericValue
    
    // Mark appropriate fields as touched
    if (field === 'twapRunningTimeHours' || field === 'twapRunningTimeMinutes') {
      markFieldAsTouched('twapRunningTime')
    } else {
      markFieldAsTouched(field)
    }
    
    setState(prev => ({ ...prev, [field]: formattedValue }))
  }

  const handleTPSLChange = (field: 'takeProfitPrice' | 'stopLossPrice' | 'takeProfitGain' | 'stopLossLoss', value: string) => {
    // Normalize input: trim spaces, only allow numeric input (including decimal point)
    const trimmedValue = value.trim()
    const numericValue = trimmedValue.replace(/[^0-9.]/g, '')
    // Prevent multiple decimal points
    const parts = numericValue.split('.')
    const formattedValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : numericValue
    
    markFieldAsTouched(field)
    
    setState(prev => {
      const newState = { ...prev, [field]: formattedValue }
      
      // Auto-calculate prices based on percentages
      if (typeof topCardPrice === 'number' && formattedValue) {
        if (field === 'takeProfitGain' && formattedValue) {
          const gainPercent = parseFloat(formattedValue) / 100
          if (prev.side === 'buy') {
            newState.takeProfitPrice = (topCardPrice * (1 + gainPercent)).toFixed(2)
          } else {
            newState.takeProfitPrice = (topCardPrice * (1 - gainPercent)).toFixed(2)
          }
        } else if (field === 'stopLossLoss' && formattedValue) {
          const lossPercent = parseFloat(formattedValue) / 100
          if (prev.side === 'buy') {
            newState.stopLossPrice = (topCardPrice * (1 - lossPercent)).toFixed(2)
          } else {
            newState.stopLossPrice = (topCardPrice * (1 + lossPercent)).toFixed(2)
          }
        }
      }
      
      return newState
    })
  }

  const handleCoinChange = async (coin: string) => {
    markFieldAsTouched('selectedCoin')
    setState(prev => ({ ...prev, selectedCoin: coin }))
    
    // Update position for the selected coin immediately
    try {
      await updatePositionForCoin(coin)
      
      // Get clearinghouse state to extract margin mode and leverage for this coin
      try {
        const clearinghouseState = await hyperliquidService.getClearinghouseState()
        
        if (clearinghouseState?.assetPositions) {
          const coinToMatch = coin.replace('-PERP', '')
          const coinPosition = clearinghouseState.assetPositions.find(
            (pos: any) => pos.position?.coin === coinToMatch
          )
          
          if (coinPosition?.position) {
            const position = coinPosition.position
            
            // Extract margin mode and leverage from position
            const positionMarginMode = position.leverage && typeof position.leverage === 'object' ? position.leverage.type : null
            const positionLeverage = position.leverage && typeof position.leverage === 'object' ? position.leverage.value : null
            
            if (positionMarginMode) {
              setState(prev => ({ ...prev, marginMode: positionMarginMode }))
              toast.success(`Margin mode updated to ${positionMarginMode} for ${coin}`, {
                duration: 3000,
                style: {
                  background: '#065f46',
                  color: '#ffffff',
                  border: '1px solid #10b981',
                },
              })
            }
            
            if (positionLeverage && !isNaN(parseFloat(positionLeverage))) {
              const leverage = parseFloat(positionLeverage)
              setState(prev => ({ ...prev, leverage }))
              toast.success(`Leverage updated to ${leverage}x for ${coin}`, {
                duration: 3000,
                style: {
                  background: '#065f46',
                  color: '#ffffff',
                  border: '1px solid #10b981',
                },
              })
            }
          }
        }
      } catch (clearinghouseError) {
        console.error('Failed to get clearinghouse state for coin:', clearinghouseError)
      }
    } catch (error) {
      console.error('Failed to update position for selected coin:', error)
    }
  }

  const handleSideChange = (side: 'buy' | 'sell') => {
    markFieldAsTouched('side')
    setState(prev => ({ ...prev, side }))
  }

  const handleSubmitOrder = async () => {
    // Show confirmation popup instead of immediately submitting
    const coinSize = getCoinSizeForApi()
    const convertedSize = state.sizeUnit === 'USD' && coinSize > 0 
      ? (() => {
          // Extract base coin from coin pair (e.g., "BTC-PERP" -> "BTC")
          const baseCoin = state.selectedCoin.toUpperCase().split('-')[0]
          
          // Use appropriate decimal places based on base coin
          switch (baseCoin) {
            case 'DOGE':
              return coinSize.toFixed(0)
            case 'BTC':
              return coinSize.toFixed(5)
            case 'ETH':
              return coinSize.toFixed(4)
            case 'SOL':
              return coinSize.toFixed(2)
            default:
              return coinSize.toFixed(6)
          }
        })()
      : undefined

    // Construct the actual order payload that will be sent to the server
    const orderPayload = (() => {
      const payload: any = {
        coin: state.selectedCoin,
        is_buy: state.side === 'buy',
        sz: convertedSize || state.size,
        reduce_only: state.reduceOnly,
        order_type: (() => {
          switch (state.orderType) {
            case 'market':
              return { limit: { tif: 'Ioc' } }
            case 'limit':
              const tifMap: { [key: string]: 'Gtc' | 'Ioc' | 'Alo' } = {
                'GTC': 'Gtc',
                'IOC': 'Ioc', 
                'ALO': 'Alo'
              }
              return { limit: { tif: tifMap[state.timeInForce] || 'Gtc' } }
            default:
              return { limit: { tif: 'Ioc' } }
          }
        })()
      }

      // Add price for both limit and market orders
      if (state.orderType === 'limit' && state.limitPrice) {
        const limitPrice = parseFloat(state.limitPrice)
        payload.limit_px = formatPriceForTickSize(limitPrice, state.selectedCoin)
        console.log('🎯 Added limit_px for limit order:', payload.limit_px)
      } else if (state.orderType === 'market' && topCardPrice) {
        const buffer = state.side === 'buy' ? 1.01 : 0.99
        const marketPrice = formatPriceForTickSize(topCardPrice * buffer, state.selectedCoin)
        payload.limit_px = marketPrice
        console.log('🎯 Added limit_px for market order:', payload.limit_px)
      } else {
        console.log('🎯 No limit_px added - orderType:', state.orderType, 'limitPrice:', state.limitPrice, 'topCardPrice:', topCardPrice)
      }

      // Note: TP/SL orders will be placed separately as trigger orders
      // The main order payload doesn't include TP/SL parameters
      console.log('🎯 Confirmation Popup - Main order payload (TP/SL will be separate trigger orders):', {
        takeProfitStopLoss: state.takeProfitStopLoss,
        takeProfitPrice: state.takeProfitPrice,
        stopLossPrice: state.stopLossPrice
      })

      console.log('🎯 Final payload for confirmation popup:', payload)
      console.log('🎯 Final payload JSON string:', JSON.stringify(payload, null, 2))
      return payload
    })()

    // Prepare order details for confirmation
    const orderDetails = {
      action: state.side === 'buy' ? 'Buy' : 'Sell',
      size: state.sizeUnit === 'USD' 
        ? `${convertedSize || state.size} ${state.selectedCoin}` 
        : `${state.size} ${state.selectedCoin}`,
      price: (() => {
        if (state.orderType === 'market') {
          // For market orders, show current market price if available
          return topCardPrice ? `$${topCardPrice.toFixed(2)} (Market)` : 'Market'
        } else if (state.orderType === 'twap') {
          // For TWAP orders, show current market price
          return topCardPrice ? `$${topCardPrice.toFixed(2)} (Market)` : 'Market'
        } else if (state.orderType === 'scale') {
          // For scale orders, show start and end prices
          const startPrice = state.scaleStartPrice && state.scaleStartPrice.trim() !== '' ? state.scaleStartPrice : 'N/A'
          const endPrice = state.scaleEndPrice && state.scaleEndPrice.trim() !== '' ? state.scaleEndPrice : 'N/A'
          return `${startPrice} - ${endPrice}`
        } else {
          // For limit orders, show the limit price or N/A if missing
          return state.limitPrice && state.limitPrice.trim() !== '' ? state.limitPrice : 'N/A'
        }
      })(),
      liquidationPrice: (() => {
        // Check if we have the required data for liquidation price calculation
        if (!state.size || state.size.trim() === '') {
          return 'N/A'
        }
        
        // Determine entry price for calculation
        let entryPrice: number | null = null
        
        if (state.orderType === 'limit' && state.limitPrice && state.limitPrice.trim() !== '') {
          const limitPrice = parseFloat(state.limitPrice)
          if (!isNaN(limitPrice) && limitPrice > 0) {
            entryPrice = limitPrice
          }
        }
        
        // If no valid limit price, use market price
        if (!entryPrice && typeof topCardPrice === 'number' && topCardPrice > 0) {
          entryPrice = topCardPrice
        }
        
        // If we have a valid entry price, calculate liquidation price
        if (entryPrice && state.leverage > 0) {
          const liquidationPrice = calculateLiquidationPrice(
            entryPrice, 
            state.leverage, 
            state.side, 
            state.selectedCoin, 
            state.marginMode, 
            parseFloat(accountInfo.availableToTrade || '0')
          )
          
          // Handle negative liquidation price (very safe position in cross margin)
          if (liquidationPrice < 0) {
            return `Very Safe (${liquidationPrice.toFixed(2)})`
          }
          
          return `$${liquidationPrice.toFixed(2)}`
        }
        
        return 'N/A'
      })(),
      convertedSize,
      originalSize: state.size,
      sizeUnit: state.sizeUnit,
      coinSize,
      orderType: state.orderType,
      selectedCoin: state.selectedCoin,
      side: state.side,
      leverage: state.leverage,
      takeProfitStopLoss: state.takeProfitStopLoss,
      takeProfitPrice: state.takeProfitPrice,
      stopLossPrice: state.stopLossPrice,
      reduceOnly: state.reduceOnly,
      payload: orderPayload
    }

    console.log('🎯 Order Details for Confirmation Popup:', {
      takeProfitStopLoss: orderDetails.takeProfitStopLoss,
      takeProfitPrice: orderDetails.takeProfitPrice,
      stopLossPrice: orderDetails.stopLossPrice,
      takeProfitPriceTrimmed: orderDetails.takeProfitPrice?.trim(),
      stopLossPriceTrimmed: orderDetails.stopLossPrice?.trim()
    })

    setPendingOrder(orderDetails)
    setShowConfirmPopup(true)
  }

  const handleConfirmOrder = async () => {
    if (!pendingOrder) return

    try {
      console.log('🎨 Component: Confirming order...')
      
      console.log('🎨 Component: Size conversion:', {
        originalSize: pendingOrder.originalSize,
        sizeUnit: pendingOrder.sizeUnit,
        coinSize: pendingOrder.coinSize,
        convertedSize: pendingOrder.convertedSize,
        orderType: pendingOrder.orderType
      })
      
      const result = await placeOrder(pendingOrder.convertedSize, topCardPrice || undefined)
      
      // Handle scale order responses differently
      if (result?.type === 'scale') {
        const successfulOrders = result.successfulOrders
        const totalOrders = result.totalOrders
        
        if (successfulOrders === totalOrders) {
          toast.success(`Scale order completed: ${successfulOrders}/${totalOrders} orders placed successfully`)
          setOrderResponse({
            success: true,
            orderId: `Scale Order (${successfulOrders}/${totalOrders})`,
            status: 'All Orders Placed',
            message: `Scale order completed: ${successfulOrders}/${totalOrders} orders placed successfully`,
            data: result
          })
        } else if (successfulOrders > 0) {
          toast.success(`Scale order partially completed: ${successfulOrders}/${totalOrders} orders placed successfully`)
          setOrderResponse({
            success: true,
            orderId: `Scale Order (${successfulOrders}/${totalOrders})`,
            status: 'Partial Success',
            message: `Scale order partially completed: ${successfulOrders}/${totalOrders} orders placed successfully`,
            data: result
          })
        } else {
          toast.error('All scale orders failed')
          setOrderResponse({
            success: false,
            error: 'All scale orders failed',
            message: 'Scale order placement failed',
            data: result
          })
        }
      } else if (result?.type === 'twap') {
        const totalOrders = result.totalOrders
        const totalDuration = result.totalDuration
        
        toast.success(`TWAP order started: ${totalOrders} orders will execute over ${totalDuration} minutes`)
        setOrderResponse({
          success: true,
          orderId: `TWAP Order Started`,
          status: 'TWAP Started',
          message: `TWAP order started: ${totalOrders} orders will execute over ${totalDuration} minutes.`,
          data: result
        })
      } else {
        // Handle regular order responses
        const isSuccess = result?.status === 'ok' && 
                         result?.response?.data?.statuses?.[0]?.error === undefined
        
        if (isSuccess) {
          // Show success popup
          setOrderResponse({
            success: true,
            orderId: result?.response?.data?.statuses?.[0]?.resting?.oid || 'N/A',
            status: result?.response?.data?.statuses?.[0]?.resting?.status || 'Placed',
            message: 'Order placed successfully',
            data: result
          })
        } else {
          // Show error popup for order rejection
          const errorMsg = result?.response?.data?.statuses?.[0]?.error || 'Order rejected'
          setOrderResponse({
            success: false,
            error: errorMsg,
            message: 'Order placement failed',
            data: result
          })
        }
      }
      
      // Close confirmation popup and show order result
      setShowConfirmPopup(false)
      setPendingOrder(null)
      setShowOrderPopup(true)
      
    } catch (err) {
      console.error('🎨 Component: Failed to submit order:', err)
      
      // Show error popup for network/API errors
      setOrderResponse({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to place order',
        message: 'Order placement failed',
        data: err
      })
      
      // Close confirmation popup and show error
      setShowConfirmPopup(false)
      setPendingOrder(null)
      setShowOrderPopup(true)
    }
  }

  const handleCancelOrder = () => {
    setShowConfirmPopup(false)
    setPendingOrder(null)
  }

  const handleLeverageChange = async (leverage: number) => {
    try {
      await updateLeverage(leverage)
      toast.success(`Leverage updated to ${leverage}x`)
    } catch (err) {
      console.error('Failed to update leverage:', err)
      if (err instanceof Error) {
        if (err.message.includes('Cannot switch leverage type with open position')) {
          toast.error('Cannot change leverage while you have open positions. Please close all positions first.')
        } else {
          toast.error(`Failed to update leverage: ${err.message}`)
        }
      } else {
        toast.error('Failed to update leverage')
      }
    }
  }

  const handleMarginModeChange = async (marginMode: 'isolated' | 'cross') => {
    try {
      await updateMarginMode(marginMode)
      toast.success(`Margin mode updated to ${marginMode}`)
    } catch (err) {
      console.error('Failed to update margin mode:', err)
      if (err instanceof Error) {
        if (err.message.includes('Cannot switch leverage type with open position')) {
          toast.error('Cannot change margin mode while you have open positions. Please close all positions first.')
        } else {
          toast.error(`Failed to update margin mode: ${err.message}`)
        }
      } else {
        toast.error('Failed to update margin mode')
      }
    }
  }

  const handleNetworkSwitch = async (network: 'testnet' | 'mainnet') => {
    console.log('🎨 Component: Button clicked, switching to:', network)
    try {
      await switchNetwork(network)
      setCurrentNetwork(network)
      console.log('🎨 Component: Network switch completed')
    } catch (err) {
      console.error('🎨 Component: Failed to switch network:', err)
    }
  }

  // Load current network status on mount
  useEffect(() => {
    const loadNetworkStatus = async () => {
      if (isInitialized) {
        const network = await getNetworkStatus()
        setCurrentNetwork(network as 'testnet' | 'mainnet' | 'unknown')
      }
    }
    loadNetworkStatus()
  }, [isInitialized, getNetworkStatus])


  // Close order popup
  const handleCloseOrderPopup = () => {
    setShowOrderPopup(false)
    setOrderResponse(null)
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-dark-surface rounded-lg">
      {/* Error Messages */}
      {(error || validationErrors.length > 0) && (
        <div className="mb-4 space-y-3">
          {/* General Error - Only show if not a toast error */}
          {error && !error.includes('Cannot change leverage while you have open positions') && 
           !error.includes('Failed to update leverage') && 
           !error.includes('Failed to update margin mode') && 
           !error.includes('Cannot change margin mode while you have open positions') && (
            <div className="p-3 bg-red-900/20 border border-red-500 rounded flex items-center gap-2 text-red-400">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          )}
          
        </div>
      )}


      {/* SDK Status */}
      {!isInitialized && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-400 text-sm">
          Initializing Hyperliquid SDK...
        </div>
      )}

      {/* TWAP Task Status Section */}
      {activeTwapTasks.size > 0 && Array.from(activeTwapTasks).some(taskId => {
        const task = twapTaskDetails.get(taskId)
        if (!task) return false
        const totalProcessed = task.completedOrders + task.failedOrders
        const progress = totalProcessed >= task.intervals ? 100 : (task.completedOrders / task.intervals) * 100
        return progress < 100
      }) && (
        <div className="mb-4 p-4 bg-blue-900/20 border border-blue-600/50 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <div className="text-sm text-blue-300 font-medium">🔄 Active TWAP Orders</div>
          </div>
          
          <div className="space-y-3">
            {Array.from(activeTwapTasks).map(taskId => {
              const task = twapTaskDetails.get(taskId)
              if (!task) return null
              
              const totalProcessed = task.completedOrders + task.failedOrders
              const progress = totalProcessed >= task.intervals ? 100 : (task.completedOrders / task.intervals) * 100
              
              // Hide task when progress reaches 100%
              if (progress >= 100) return null
              const plannedSubOrder = task.subOrderSizes && task.subOrderSizes.length > 0
                ? task.subOrderSizes[0]
                : (task.totalSize / task.intervals).toFixed(task.sizePrecision ?? 4)
              const statusColor = task.status === 'completed' ? 'text-green-400' : 
                                task.status === 'failed' ? 'text-red-400' : 'text-blue-400'
              const statusIcon = task.status === 'completed' ? '✅' : 
                               task.status === 'failed' ? '❌' : '🔄'
              
              return (
                <div key={taskId} className="bg-gray-800/50 border border-gray-600 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-white">
                        {statusIcon} Task {taskId.slice(-8)}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${statusColor} bg-gray-700`}>
                        {task.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {task.coin} • {task.is_buy ? 'BUY' : 'SELL'}
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>{totalProcessed}/{task.intervals} orders</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          totalProcessed >= task.intervals 
                            ? (task.completedOrders > 0 ? 'bg-green-500' : 'bg-red-500')
                            : 'bg-blue-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Order Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-gray-400">
                      <span className="text-gray-300">Size per Order:</span> {plannedSubOrder} {task.coin.replace('-PERP', '')}
                    </div>
                    <div className="text-gray-400">
                      <span className="text-gray-300">Duration:</span> {task.durationMinutes}m
                    </div>
                    <div className="text-gray-400">
                      <span className="text-gray-300">Completed:</span> {task.completedOrders}
                    </div>
                    <div className="text-gray-400">
                      <span className="text-gray-300">Failed:</span> {task.failedOrders}
                    </div>
                  </div>
                  
                  {/* Recent Results */}
                  {task.results && task.results.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-600">
                      <div className="text-xs text-gray-400 mb-1">Recent Orders:</div>
                      <div className="space-y-1 max-h-20 overflow-y-auto">
                        {task.results.slice(-3).map((result: any, index: number) => (
                          <div key={index} className="flex justify-between text-xs">
                            <span className="text-gray-300">Order {result.orderIndex}</span>
                            <span className={result.error ? 'text-red-400' : 'text-green-400'}>
                              {result.error ? '❌ Failed' : '✅ Success'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          
          {/* Notification Toggle */}
          <div className="mt-3 pt-3 border-t border-gray-600">
            <button
              onClick={requestNotificationPermission}
              className="text-xs text-blue-400 hover:text-blue-300 underline"
            >
              {twapNotifications ? 'Notifications enabled' : 'Enable notifications for completion alerts'}
            </button>
          </div>
        </div>
      )}

      {/* Network Switch */}
      <div className="mb-4 p-3 bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network size={16} className="text-gray-400" />
            <span className="text-sm text-gray-300">Network:</span>
            <span className={`text-sm font-medium px-2 py-1 rounded ${
              currentNetwork === 'testnet' 
                ? 'bg-orange-900/30 text-orange-400 border border-orange-500' 
                : currentNetwork === 'mainnet'
                ? 'bg-green-900/30 text-green-400 border border-green-500'
                : 'bg-gray-700 text-gray-400'
            }`}>
              {currentNetwork === 'testnet' ? 'Testnet' : currentNetwork === 'mainnet' ? 'Mainnet' : 'Unknown'}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => handleNetworkSwitch('testnet')}
              disabled={isLoading || !isInitialized}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                currentNetwork === 'testnet'
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              } ${isLoading || !isInitialized ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Testnet
            </button>
            <button
              onClick={() => handleNetworkSwitch('mainnet')}
              disabled={isLoading || !isInitialized}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                currentNetwork === 'mainnet'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              } ${isLoading || !isInitialized ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Mainnet
            </button>
          </div>
        </div>

      </div>

      {/* Coin Selection and Price Display */}
      <div className="mb-4">
        <div className="relative">
          <select
            value={state.selectedCoin}
            onChange={(e) => handleCoinChange(e.target.value)}
            disabled={isLoading}
            className="w-full p-4 bg-gray-800 rounded-lg border border-gray-600 focus:border-teal-primary focus:outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {CONFIG.AVAILABLE_COINS.map((coin: { symbol: string; name: string; icon: string }) => (
              <option key={coin.symbol} value={coin.symbol}>
                 {coin.name} ({coin.symbol})
              </option>
            ))}
          </select>
          
          {/* Custom display overlay */}
          <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
            {/* Left side - Coin name */}
            <div className="flex items-center gap-3">
              {(() => {
                const selectedCoinData = CONFIG.AVAILABLE_COINS.find(coin => coin.symbol === state.selectedCoin)
                return (
                  <>
                    
                  </>
                )
              })()}
            </div>
            
            {/* Right side - Price */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Price:</span>
              <span className="text-lg font-semibold text-white">
                {priceError ? (
                  <span className="text-red-400">{priceError}</span>
                ) : currentPrice ? (
                  `$${currentPrice.toLocaleString()}`
                ) : priceConnected ? (
                  <span className="text-gray-400">Loading...</span>
                ) : (
                  <span className="text-gray-400">Connecting...</span>
                )}
              </span>
              <ChevronDown size={20} className="text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Top Configuration Bar */}
      <div className="flex gap-3 mb-6">
        {/* Margin Mode Toggle */}
        <div 
          className="margin-mode-dropdown relative bg-dark-border rounded-lg border border-gray-600 hover:border-teal-primary transition-all duration-200 hover:shadow-lg hover:shadow-teal-primary/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => !isLoading && handleMarginModeChange(state.marginMode === 'cross' ? 'isolated' : 'cross')}
        >
          <div className="flex flex-col items-center justify-center px-4 py-3 min-h-[80px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-teal-primary shadow-sm"></div>
              <span className="text-xs font-medium text-gray-400">Margin Mode</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white capitalize">{state.marginMode}</span>
              <div className="toggle-indicator w-4 h-4 rounded-full bg-gray-600 flex items-center justify-center transition-all duration-200">
                <div className="w-2 h-2 rounded-full bg-white"></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Leverage Slider */}
        <div className="flex-1 bg-dark-border rounded-lg border border-gray-600 hover:border-teal-primary transition-colors p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-300">Leverage</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-teal-primary">{state.leverage}x</span>
             <div className={`px-2 py-1 rounded-full text-xs font-medium ${
               state.leverage <= 3 ? 'bg-green-900/30 text-green-400 border border-green-500/30' :
               state.leverage <= 6 ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30' :
               state.leverage <= 8 ? 'bg-orange-900/30 text-orange-400 border border-orange-500/30' :
               'bg-red-900/30 text-red-400 border border-red-500/30'
             }`}>
               {state.leverage <= 3 ? 'Low Risk' :
                state.leverage <= 6 ? 'Medium Risk' :
                state.leverage <= 8 ? 'High Risk' : 'Very High Risk'}
             </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 font-medium min-w-[24px]">1x</span>
           <input
             type="range"
             min="1"
             max="10"
             value={state.leverage}
             onChange={(e) => handleLeverageChange(parseInt(e.target.value))}
             disabled={isLoading}
             className="flex-1 h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
             style={{
               background: `linear-gradient(to right, #14b8a6 0%, #14b8a6 ${((state.leverage - 1) / 9) * 100}%, #374151 ${((state.leverage - 1) / 9) * 100}%, #374151 100%)`
             }}
           />
           <span className="text-xs text-gray-400 font-medium min-w-[32px]">10x</span>
          </div>
        </div>
 
      </div>

      {/* Order Type Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          className={`flex-1 px-4 py-2 rounded text-sm font-medium ${
            state.orderType === 'market'
              ? 'bg-white text-black underline'
              : 'bg-transparent text-gray-400 hover:text-white'
          }`}
          onClick={() => setState(prev => ({ ...prev, orderType: 'market' }))}
        >
          Market
        </button>
        <button
          className={`flex-1 px-4 py-2 rounded text-sm font-medium ${
            state.orderType === 'limit'
              ? 'bg-white text-black underline'
              : 'bg-transparent text-gray-400 hover:text-white'
          }`}
          onClick={() => {
            setState(prev => ({ 
              ...prev, 
              orderType: 'limit',
              // Prefill limit price with current market price
              limitPrice: typeof topCardPrice === 'number' ? topCardPrice.toString() : prev.limitPrice
            }))
          }}
        >
          Limit
        </button>
        <div className="flex-1">
          <div className="relative">
            <select
              value={state.orderType === 'scale' || state.orderType === 'twap' ? state.orderType : ''}
              onChange={(e) => {
                setState(prev => ({ ...prev, orderType: e.target.value as any }))
              }}
              className={`w-full px-3 py-2 rounded text-sm font-medium border focus:border-teal-primary focus:outline-none appearance-none pr-8 cursor-pointer ${
                state.orderType === 'scale' || state.orderType === 'twap'
                  ? 'bg-white text-black underline'
                  : 'bg-transparent text-gray-400 hover:text-white border-gray-600'
              }`}
            >
              <option value="" disabled>Pro</option>
              <option value="scale">Scale</option>
              <option value="twap">TWAP</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Buy/Sell Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          className={`flex-1 py-3 rounded font-medium ${
            state.side === 'buy'
              ? 'bg-teal-primary text-white'
              : 'bg-dark-border text-gray-400 hover:text-white'
          }`}
          onClick={() => handleSideChange('buy')}
        >
          Buy / Long
        </button>
        <button
          className={`flex-1 py-3 rounded font-medium ${
            state.side === 'sell'
              ? 'bg-red-600 text-white'
              : 'bg-dark-border text-gray-400 hover:text-white'
          }`}
          onClick={() => handleSideChange('sell')}
        >
          Sell / Short
        </button>
      </div>

      {/* Account Information */}
      <div className="mb-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Available to Trade:</span>
          <span className="text-white">{accountInfo.availableToTrade}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Current Position:</span>
          <span className="text-white">{accountInfo.currentPosition}</span>
        </div>
      </div>

      {/* Size Input */}
      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            placeholder="Size"
            value={state.size}
            onChange={(e) => handleSizeChange(e.target.value)}
            className="flex-1 px-3 py-2 bg-dark-border border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-teal-primary"
          />
          <select
            value={state.sizeUnit}
            onChange={(e) => setState(prev => ({ ...prev, sizeUnit: e.target.value as 'USD' | string }))}
            className="px-3 py-2 bg-dark-border border border-gray-600 rounded text-white focus:outline-none focus:border-teal-primary"
          >
            <option value="USD">USD</option>
            <option value={state.selectedCoin}>{state.selectedCoin}</option>
          </select>
        </div>

        {/* Coin Size Display (when USD is selected) */}
        {state.sizeUnit === 'USD' && state.size && topCardPrice && (
          <div className="mb-2 text-sm text-gray-400">
            <span>Coin Size: </span>
            <span className="text-white">
              {(() => {
                const coinSize = convertUsdToCoinSize(parseFloat(state.size), topCardPrice, state.selectedCoin)
                // Extract base coin from coin pair (e.g., "BTC-PERP" -> "BTC")
                const baseCoin = state.selectedCoin.toUpperCase().split('-')[0]
                
                // Show appropriate decimal places based on base coin
                switch (baseCoin) {
                  case 'DOGE':
                    return `${coinSize.toFixed(0)} ${state.selectedCoin}`
                  case 'BTC':
                    return `${coinSize.toFixed(5)} ${state.selectedCoin}`
                  case 'ETH':
                    return `${coinSize.toFixed(4)} ${state.selectedCoin}`
                  case 'SOL':
                    return `${coinSize.toFixed(2)} ${state.selectedCoin}`
                  default:
                    return `${coinSize.toFixed(6)} ${state.selectedCoin}`
                }
              })()}
            </span>
          </div>
        )}

        {/* Price Input Section */}
        {state.orderType === 'limit' ? (
          <div className="mb-2">
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Limit Price"
                value={state.limitPrice}
                onChange={(e) => handleLimitPriceChange(e.target.value)}
                onBlur={handleLimitPriceBlur}
                className="flex-1 px-3 py-2 bg-dark-border border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-teal-primary"
              />
              <button
                type="button"
                onClick={() => {
                  if (typeof topCardPrice === 'number') {
                    const formattedPrice = formatPriceForTickSize(topCardPrice, state.selectedCoin)
                    markFieldAsTouched('limitPrice')
                    setState(prev => ({ ...prev, limitPrice: formattedPrice }))
                  }
                }}
                disabled={typeof topCardPrice !== 'number'}
                className="px-3 py-2 bg-teal-primary text-black text-sm font-medium rounded hover:bg-teal-400 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Mid
              </button>
            </div>
            
            {/* Time In Force Selection */}
            <div className="mt-2">
              <select
                value={state.timeInForce}
                onChange={(e) => {
                  markFieldAsTouched('timeInForce')
                  setState(prev => ({ ...prev, timeInForce: e.target.value as 'GTC' | 'IOC' | 'ALO' }))
                }}
                className="w-full px-3 py-2 bg-dark-border border border-gray-600 rounded text-white focus:outline-none focus:border-teal-primary"
              >
                <option value="GTC">GTC - Good Till Canceled</option>
                <option value="IOC">IOC - Immediate Or Cancel</option>
                <option value="ALO">ALO - Add Liquidity Only</option>
              </select>
            </div>
          </div>
        ) : state.orderType === 'scale' ? (
          <div className="mb-2 space-y-3">
            

            {/* Scale Order Configuration */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Start (USD)</span>
                <input
                  type="text"
                  value={state.scaleStartPrice}
                  onChange={(e) => setState(prev => ({ ...prev, scaleStartPrice: e.target.value }))}
                  className="w-32 px-3 py-2 bg-dark-border border border-gray-600 rounded text-white text-right focus:outline-none focus:border-teal-primary"
                  placeholder="0"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">End (USD)</span>
                <input
                  type="text"
                  value={state.scaleEndPrice}
                  onChange={(e) => setState(prev => ({ ...prev, scaleEndPrice: e.target.value }))}
                  className="w-32 px-3 py-2 bg-dark-border border border-gray-600 rounded text-white text-right focus:outline-none focus:border-teal-primary"
                  placeholder="0"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Total Orders</span>
                <input
                  type="text"
                  value={state.scaleOrderCount}
                  onChange={(e) => setState(prev => ({ ...prev, scaleOrderCount: e.target.value }))}
                  className="w-32 px-3 py-2 bg-dark-border border border-gray-600 rounded text-white text-right focus:outline-none focus:border-teal-primary"
                  placeholder="10"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Size Skew</span>
                <input
                  type="text"
                  value={state.scaleSizeSkew}
                  onChange={(e) => setState(prev => ({ ...prev, scaleSizeSkew: e.target.value }))}
                  className="w-32 px-3 py-2 bg-dark-border border border-gray-600 rounded text-white text-right focus:outline-none focus:border-teal-primary"
                  placeholder="1"
                />
              </div>
            </div>

            {/* Reduce Only and TIF */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={state.reduceOnly}
                  onChange={(e) => setState(prev => ({ ...prev, reduceOnly: e.target.checked }))}
                  className="w-4 h-4 text-teal-primary bg-dark-border border-gray-600 rounded focus:ring-teal-primary focus:ring-2"
                />
                <span className="text-sm text-gray-400">Reduce Only</span>
              </label>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">TIF</span>
                <select
                  value={state.timeInForce}
                  onChange={(e) => setState(prev => ({ ...prev, timeInForce: e.target.value as 'GTC' | 'IOC' | 'ALO' }))}
                  className="px-2 py-1 bg-dark-border border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-teal-primary"
                >
                  <option value="GTC">GTC</option>
                  <option value="IOC">IOC</option>
                  <option value="ALO">ALO</option>
                </select>
                <ChevronDown size={12} className="text-gray-400" />
              </div>
            </div>
            
            {/* Scale Order Preview */}
            {state.scaleStartPrice && state.scaleEndPrice && state.scaleOrderCount && (
              <div className="mt-3 p-3 bg-gray-800/50 border border-gray-600 rounded">
                <div className="text-xs text-gray-400 mb-2">Order Preview:</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {(() => {
                    const startPrice = parseFloat(state.scaleStartPrice)
                    const endPrice = parseFloat(state.scaleEndPrice)
                    const orderCount = parseInt(state.scaleOrderCount)
                    const sizeSkew = parseFloat(state.scaleSizeSkew) || 1
                    let totalSize = parseFloat(state.size) || 0
                    
                    // Convert USD to coin size if needed
                    if (state.sizeUnit === 'USD' && typeof topCardPrice === 'number') {
                      totalSize = totalSize / topCardPrice
                    }
                    
                    if (isNaN(startPrice) || isNaN(endPrice) || isNaN(orderCount) || orderCount <= 0) {
                      return <div className="text-xs text-gray-500">Invalid parameters</div>
                    }
                    
                    const orders = []
                    const priceStep = (endPrice - startPrice) / Math.max(1, orderCount - 1)
                    
                    for (let i = 0; i < orderCount; i++) {
                      const price = (startPrice + (priceStep * i)).toFixed(5)
                      // Calculate size based on size skew
                      // Size skew determines the ratio between end and start order sizes
                      // If size skew = 2.0, end order will be twice the size of start order
                      // If size skew = 1.0, all orders will be equal size
                      const skewFactor = Math.pow(sizeSkew, i / Math.max(1, orderCount - 1))
                      
                      // Calculate normalization factor to ensure total size matches
                      let normalizationFactor = 1
                      if (orderCount > 1) {
                        let totalSkewFactor = 0
                        for (let j = 0; j < orderCount; j++) {
                          totalSkewFactor += Math.pow(sizeSkew, j / Math.max(1, orderCount - 1))
                        }
                        normalizationFactor = orderCount / totalSkewFactor
                      }
                      
                      const baseSize = totalSize / orderCount
                      const rawSize = baseSize * skewFactor * normalizationFactor
                      
                      // Round to coin-specific precision
                      const baseCoin = state.selectedCoin?.toUpperCase().split('-')[0] || 'BTC'
                      const roundedSize = roundCoinSize(rawSize, baseCoin)
                      
                      const size = roundedSize.toFixed(6)
                      
                      orders.push(
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-300">Order {i + 1}:</span>
                          <span className="text-white">${price} × {parseFloat(size).toFixed(4)}</span>
                        </div>
                      )
                    }
                    
                    return orders
                  })()}
                </div>
              </div>
            )}
          </div>
        ) : state.orderType === 'twap' ? (
          <div className="mb-2 space-y-3">
            {/* Running Time Section */}
            <div className="space-y-2">
              <div className="text-sm text-gray-400">Running Time (5m - 24h)</div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={state.twapRunningTimeHours}
                    onChange={(e) => handleTwapNumericChange('twapRunningTimeHours', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-dark-border border border-gray-600 rounded text-transparent focus:outline-none focus:border-teal-primary placeholder-transparent"
                    style={{ color: 'transparent' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
                    <span className="text-gray-400 text-sm">Hour(s)</span>
                    <span className="text-white font-medium">{state.twapRunningTimeHours || '0'}</span>
                  </div>
                </div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={state.twapRunningTimeMinutes}
                    onChange={(e) => handleTwapNumericChange('twapRunningTimeMinutes', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-dark-border border border-gray-600 rounded text-transparent focus:outline-none focus:border-teal-primary placeholder-transparent"
                    style={{ color: 'transparent' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
                    <span className="text-gray-400 text-sm">Minute(s)</span>
                    <span className="text-white font-medium">{state.twapRunningTimeMinutes || '0'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={state.twapRandomize}
                  onChange={(e) => setState(prev => ({ ...prev, twapRandomize: e.target.checked }))}
                  className="w-4 h-4 text-teal-primary bg-dark-border border-gray-600 rounded focus:ring-teal-primary"
                />
                <span className="text-gray-300">Randomize</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={state.reduceOnly}
                  onChange={(e) => setState(prev => ({ ...prev, reduceOnly: e.target.checked }))}
                  className="w-4 h-4 text-teal-primary bg-dark-border border-gray-600 rounded focus:ring-teal-primary"
                />
                <span className="text-gray-300">Reduce Only</span>
              </label>
            </div>

            
            {/* TWAP Order Calculation Summary */}
            {state.twapRunningTimeHours && state.twapRunningTimeMinutes && state.size && (
              <div className="mt-4 p-4 bg-gray-800/50 border border-gray-600 rounded-lg">
                <div className="text-sm text-gray-300 mb-3 font-medium">TWAP Order Summary</div>
                <div className="space-y-2">
                  {(() => {
                    const runningTimeHours = parseInt(state.twapRunningTimeHours)
                    const runningTimeMinutes = parseInt(state.twapRunningTimeMinutes)
                    const totalSize = parseFloat(state.size)
                    
                    if (isNaN(runningTimeHours) || isNaN(runningTimeMinutes) || isNaN(totalSize)) {
                      return <div className="text-sm text-gray-500">Please enter valid parameters</div>
                    }
                    
                    const totalRunningTimeMinutes = (runningTimeHours * 60) + runningTimeMinutes
                    const totalRunningTimeSeconds = totalRunningTimeMinutes * 60
                    
                    // Calculate number of orders based on 30-second frequency
                    const numberOfOrders = Math.floor(totalRunningTimeSeconds / 30)
                    
                    // Calculate sub-order size and USD value
                    let subOrderSize: number
                    let subOrderUsdValue: number
                    let totalUsdValue: number
                    
                    if (state.sizeUnit === 'USD') {
                      // For USD mode, totalSize is already in USD
                      totalUsdValue = totalSize
                      subOrderUsdValue = totalUsdValue / numberOfOrders
                      // Convert USD value to coin size using current price
                      subOrderSize = topCardPrice ? subOrderUsdValue / topCardPrice : 0
                    } else {
                      // For coin mode, calculate USD value using current price
                      subOrderSize = totalSize / numberOfOrders
                      totalUsdValue = topCardPrice ? totalSize * topCardPrice : 0
                      subOrderUsdValue = totalUsdValue / numberOfOrders
                    }
                    
                    // Format runtime display
                    const formatRuntime = (minutes: number) => {
                      if (minutes < 60) {
                        return `${minutes} minute${minutes > 1 ? 's' : ''}`
                      } else {
                        const hours = Math.floor(minutes / 60)
                        const remainingMinutes = minutes % 60
                        if (remainingMinutes === 0) {
                          return `${hours} hour${hours > 1 ? 's' : ''}`
                        } else {
                          return `${hours}h ${remainingMinutes}m`
                        }
                      }
                    }
                    
                    // Apply coin-specific rounding for validation
                    const baseCoin = state.selectedCoin?.replace('-PERP', '') || 'COIN'
                    const roundedSubOrderSize = roundCoinSize(subOrderSize, baseCoin)
                    
                    // Recalculate USD value with rounded size
                    const roundedSubOrderUsdValue = state.sizeUnit === 'USD' 
                      ? subOrderUsdValue  // USD mode: use original USD value
                      : roundedSubOrderSize * (topCardPrice || 0)  // Coin mode: recalculate with rounded size
                    
                    // Validation warnings
                    const validationWarnings = []
                    if (roundedSubOrderUsdValue < 10) {
                      validationWarnings.push(`⚠️ Sub-order value too low: $${roundedSubOrderUsdValue.toFixed(2)} (minimum: $10.00)`)
                    }
                    if (numberOfOrders < 2) {
                      validationWarnings.push(`⚠️ Runtime too short: minimum 1 minute required`)
                    }
                    
                    return (
                      <>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-gray-400 text-sm">Frequency:</span>
                          <span className="text-white text-sm font-medium">30 seconds</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-gray-400 text-sm">Runtime:</span>
                          <span className="text-white text-sm font-medium">{formatRuntime(totalRunningTimeMinutes)}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-gray-400 text-sm">Number of Orders:</span>
                          <span className="text-white text-sm font-medium">{numberOfOrders}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-gray-400 text-sm">Size per Suborder:</span>
                          <span className="text-white text-sm font-medium">
                            {(() => {
                              // Use the already calculated rounded size
                              const baseCoin = state.selectedCoin?.replace('-PERP', '') || 'COIN'
                              
                              // Format with appropriate decimal places
                              let decimalPlaces = 6
                              switch (baseCoin) {
                                case 'DOGE':
                                  decimalPlaces = 0
                                  break
                                case 'BTC':
                                  decimalPlaces = 5
                                  break
                                case 'ETH':
                                  decimalPlaces = 4
                                  break
                                case 'SOL':
                                  decimalPlaces = 2
                                  break
                              }
                              
                              return `${roundedSubOrderSize.toFixed(decimalPlaces)} ${baseCoin}`
                            })()}
                          </span>
                        </div>
                        {state.twapRandomize && (
                          <div className="flex justify-between items-center py-1">
                            <span className="text-gray-400 text-sm">Randomization:</span>
                            <span className="text-white text-sm font-medium">Enabled</span>
                          </div>
                        )}
                        
                        {/* Validation Warnings */}
                        {validationWarnings.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-red-500/30">
                            <div className="text-red-400 text-sm font-medium mb-2">⚠️ Validation Issues:</div>
                            {validationWarnings.map((warning, index) => (
                              <div key={index} className="text-red-300 text-xs mb-1">{warning}</div>
                            ))}
                          </div>
                        )}
                        
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
            
          </div>
        ) : (
          <div className="mb-2">
            <div className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Market Price:</span>
                <span className="text-green-400 font-bold">
                  {priceError ? (
                    <span className="text-red-400 text-sm">Error</span>
                  ) : typeof topCardPrice === 'number' ? (
                    `$${topCardPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}`
                  ) : priceConnected ? (
                    <span className="text-gray-400 text-sm">Loading...</span>
                  ) : (
                    <span className="text-gray-400 text-sm">Connecting...</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Take Profit / Stop Loss Inputs */}
        {state.takeProfitStopLoss && (
          <div className="space-y-3 mb-2">
            <div className="space-y-2">
              {/* Take Profit Row */}
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={state.takeProfitPrice}
                    onChange={(e) => handleTPSLChange('takeProfitPrice', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-dark-border border border-gray-600 rounded text-transparent focus:outline-none focus:border-teal-primary placeholder-transparent"
                    style={{ color: 'transparent' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
                    <span className="text-gray-400 text-sm">TP Price</span>
                    <span className="text-white font-medium">{state.takeProfitPrice || '0'}</span>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={state.takeProfitGain}
                    onChange={(e) => handleTPSLChange('takeProfitGain', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-dark-border border border-gray-600 rounded text-transparent focus:outline-none focus:border-teal-primary placeholder-transparent"
                    style={{ color: 'transparent' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
                    <span className="text-gray-400 text-sm">Gain</span>
                    <span className="text-white font-medium">{state.takeProfitGain || '0'} %</span>
                  </div>
                </div>
              </div>
              
              {/* Stop Loss Row */}
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={state.stopLossPrice}
                    onChange={(e) => handleTPSLChange('stopLossPrice', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-dark-border border border-gray-600 rounded text-transparent focus:outline-none focus:border-teal-primary placeholder-transparent"
                    style={{ color: 'transparent' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
                    <span className="text-gray-400 text-sm">SL Price</span>
                    <span className="text-white font-medium">{state.stopLossPrice || '0'}</span>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={state.stopLossLoss}
                    onChange={(e) => handleTPSLChange('stopLossLoss', e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-dark-border border border-gray-600 rounded text-transparent focus:outline-none focus:border-teal-primary placeholder-transparent"
                    style={{ color: 'transparent' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
                    <span className="text-gray-400 text-sm">Loss</span>
                    <span className="text-white font-medium">{state.stopLossLoss || '0'} %</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      
        
      </div>

      {/* Order Options - Hidden for Scale and TWAP Orders */}
      {state.orderType !== 'scale' && state.orderType !== 'twap' && (
        <div className="mb-6 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.reduceOnly}
              onChange={(e) => setState(prev => ({ ...prev, reduceOnly: e.target.checked }))}
              className="w-4 h-4 text-teal-primary bg-dark-border border-gray-600 rounded focus:ring-teal-primary"
            />
            <span className="text-gray-300">Reduce Only</span>
          </label>
          
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.takeProfitStopLoss}
              onChange={(e) => setState(prev => ({ ...prev, takeProfitStopLoss: e.target.checked }))}
              className="w-4 h-4 text-teal-primary bg-dark-border border-gray-600 rounded focus:ring-teal-primary"
            />
            <span className="text-gray-300">Take Profit / Stop Loss</span>
          </label>
        </div>
      )}

      {/* Validation Issues Display */}
      {validationErrors.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500 rounded">
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">Validation Issues:</span>
          </div>
          <ul className="text-yellow-300 text-sm space-y-1">
            {validationErrors.map((error, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-yellow-400">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmitOrder}
        disabled={!isInitialized || isLoading || !state.size || validationErrors.length > 0 ||
          (state.orderType === 'scale' && (!state.scaleStartPrice || !state.scaleEndPrice || !state.scaleOrderCount || !state.scaleSizeSkew)) ||
          (state.orderType === 'twap' && (!state.twapRunningTimeHours || !state.twapRunningTimeMinutes || !state.twapNumberOfIntervals))}
        className="w-full py-3 bg-teal-primary hover:bg-teal-hover disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded mb-6 transition-colors"
      >
        {isLoading ? 'Processing...' : 
         state.orderType === 'scale' ? 'Place Scale Orders' :
         state.orderType === 'twap' ? 'Place TWAP Order' :
         'Enable Trading'}
      </button>

      {/* Order Details */}
      <div className="space-y-3 text-sm">
        {state.orderType === 'scale' ? (
          <>
            {/* Scale Order Summary */}
            <div className="flex justify-between">
              <span className="text-gray-400">Start:</span>
              <span className="text-white">
                {(() => {
                  const startPrice = parseFloat(state.scaleStartPrice || '0')
                  const orderCount = parseInt(state.scaleOrderCount || '1')
                  let totalSize = parseFloat(state.size || '0')
                  const sizeSkew = parseFloat(state.scaleSizeSkew || '1')
                  
                  // Convert USD to coin size if needed
                  if (state.sizeUnit === 'USD' && typeof topCardPrice === 'number') {
                    totalSize = totalSize / topCardPrice
                  }
                  
                  if (orderCount <= 0 || totalSize <= 0 || startPrice <= 0) {
                    return `0 ${state.sizeUnit} @ $0.00000`
                  }
                  
                  // Calculate size for first order (i=0)
                  // For size skew = 1.0, all orders are equal size
                  // For size skew = 2.0, end order is twice the size of start order
                  const skewFactor = Math.pow(sizeSkew, 0 / Math.max(1, orderCount - 1))
                  
                  // Calculate normalization factor to ensure total size matches
                  let normalizationFactor = 1
                  if (orderCount > 1) {
                    let totalSkewFactor = 0
                    for (let j = 0; j < orderCount; j++) {
                      totalSkewFactor += Math.pow(sizeSkew, j / Math.max(1, orderCount - 1))
                    }
                    normalizationFactor = orderCount / totalSkewFactor
                  }
                  
                  const baseSize = totalSize / orderCount
                  const rawSize = baseSize * skewFactor * normalizationFactor
                  
                  // Round to coin-specific precision
                  const baseCoin = state.selectedCoin?.toUpperCase().split('-')[0] || 'BTC'
                  const roundedSize = roundCoinSize(rawSize, baseCoin)
                  
                  return `${roundedSize.toFixed(6)} ${state.sizeUnit} @ $${startPrice.toFixed(5)}`
                })()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">End:</span>
              <span className="text-white">
                {(() => {
                  const endPrice = parseFloat(state.scaleEndPrice || '0')
                  const orderCount = parseInt(state.scaleOrderCount || '1')
                  let totalSize = parseFloat(state.size || '0')
                  const sizeSkew = parseFloat(state.scaleSizeSkew || '1')
                  
                  // Convert USD to coin size if needed
                  if (state.sizeUnit === 'USD' && typeof topCardPrice === 'number') {
                    totalSize = totalSize / topCardPrice
                  }
                  
                  if (orderCount <= 0 || totalSize <= 0 || endPrice <= 0) {
                    return `0 ${state.sizeUnit} @ $0.00000`
                  }
                  
                  // Calculate size for last order (i=orderCount-1)
                  // For size skew = 1.0, all orders are equal size
                  // For size skew = 2.0, end order is twice the size of start order
                  const skewFactor = Math.pow(sizeSkew, (orderCount - 1) / Math.max(1, orderCount - 1))
                  
                  // Calculate normalization factor to ensure total size matches
                  let normalizationFactor = 1
                  if (orderCount > 1) {
                    let totalSkewFactor = 0
                    for (let j = 0; j < orderCount; j++) {
                      totalSkewFactor += Math.pow(sizeSkew, j / Math.max(1, orderCount - 1))
                    }
                    normalizationFactor = orderCount / totalSkewFactor
                  }
                  
                  const baseSize = totalSize / orderCount
                  const rawSize = baseSize * skewFactor * normalizationFactor
                  
                  // Round to coin-specific precision
                  const baseCoin = state.selectedCoin?.toUpperCase().split('-')[0] || 'BTC'
                  const roundedSize = roundCoinSize(rawSize, baseCoin)
                  
                  return `${roundedSize.toFixed(6)} ${state.sizeUnit} @ $${endPrice.toFixed(5)}`
                })()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Order Value:</span>
              <span className="text-white">
                {(() => {
                  let totalSize = parseFloat(state.size || '0')
                  const startPrice = parseFloat(state.scaleStartPrice || '0')
                  const endPrice = parseFloat(state.scaleEndPrice || '0')
                  
                  // Convert USD to coin size if needed
                  if (state.sizeUnit === 'USD' && typeof topCardPrice === 'number') {
                    totalSize = totalSize / topCardPrice
                  }
                  
                  if (totalSize <= 0 || startPrice <= 0 || endPrice <= 0) {
                    return '$0.00'
                  }
                  
                  // Calculate total value by summing all orders
                  const orderCount = parseInt(state.scaleOrderCount || '1')
                  const sizeSkew = parseFloat(state.scaleSizeSkew || '1')
                  const priceStep = (endPrice - startPrice) / Math.max(1, orderCount - 1)
                  
                  let totalValue = 0
                  for (let i = 0; i < orderCount; i++) {
                    const price = startPrice + (priceStep * i)
                    const skewFactor = Math.pow(sizeSkew, i / Math.max(1, orderCount - 1))
                    const baseSize = totalSize / orderCount
                    const rawSize = baseSize * skewFactor
                    
                    // Round to coin-specific precision
                    const baseCoin = state.selectedCoin?.toUpperCase().split('-')[0] || 'BTC'
                    const roundedSize = roundCoinSize(rawSize, baseCoin)
                    
                    totalValue += roundedSize * price
                  }
                  
                  return `$${totalValue.toFixed(2)}`
                })()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Sub-order Value:</span>
              <span className="text-white">
                {(() => {
                  let totalSize = parseFloat(state.size || '0')
                  const startPrice = parseFloat(state.scaleStartPrice || '0')
                  const endPrice = parseFloat(state.scaleEndPrice || '0')
                  const orderCount = parseInt(state.scaleOrderCount || '1')
                  
                  if (totalSize <= 0 || startPrice <= 0 || endPrice <= 0 || orderCount <= 0) {
                    return '$0.00'
                  }
                  
                  // Calculate average price for sub-order value estimation
                  const avgPrice = (startPrice + endPrice) / 2
                  
                  if (state.sizeUnit === 'USD') {
                    // For USD mode, each sub-order gets equal USD value
                    const subOrderUsdValue = totalSize / orderCount
                    return `$${subOrderUsdValue.toFixed(2)}`
                  } else {
                    // For coin mode, calculate USD value using average price
                    const subOrderSize = totalSize / orderCount
                    const subOrderUsdValue = subOrderSize * avgPrice
                    return `$${subOrderUsdValue.toFixed(2)}`
                  }
                })()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Margin Required:</span>
              <span className="text-white">
                {(() => {
                  let totalSize = parseFloat(state.size || '0')
                  const startPrice = parseFloat(state.scaleStartPrice || '0')
                  const endPrice = parseFloat(state.scaleEndPrice || '0')
                  
                  // Convert USD to coin size if needed
                  if (state.sizeUnit === 'USD' && typeof topCardPrice === 'number') {
                    totalSize = totalSize / topCardPrice
                  }
                  
                  if (totalSize <= 0 || startPrice <= 0 || endPrice <= 0) {
                    return '$0.00'
                  }
                  
                  // Calculate total value by summing all orders
                  const orderCount = parseInt(state.scaleOrderCount || '1')
                  const sizeSkew = parseFloat(state.scaleSizeSkew || '1')
                  const priceStep = (endPrice - startPrice) / Math.max(1, orderCount - 1)
                  
                  let totalValue = 0
                  for (let i = 0; i < orderCount; i++) {
                    const price = startPrice + (priceStep * i)
                    const skewFactor = Math.pow(sizeSkew, i / Math.max(1, orderCount - 1))
                    const baseSize = totalSize / orderCount
                    const rawSize = baseSize * skewFactor
                    
                    // Round to coin-specific precision
                    const baseCoin = state.selectedCoin?.toUpperCase().split('-')[0] || 'BTC'
                    const roundedSize = roundCoinSize(rawSize, baseCoin)
                    
                    totalValue += roundedSize * price
                  }
                  
                  const margin = totalValue / state.leverage
                  return `$${margin.toFixed(2)}`
                })()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Fees:</span>
              <span className="text-white">0.0450% / 0.0150%</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-gray-400">Liquidation Price:</span>
              <span className="text-white">
                {(() => {
                  if (state.size && typeof topCardPrice === 'number') {
                    // Calculate liquidation price based on order parameters
                    const entryPrice = state.orderType === 'limit' && state.limitPrice 
                      ? parseFloat(state.limitPrice) 
                      : topCardPrice // Use current price for market orders
                    const leverage = state.leverage
                    
                    const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, state.side, state.selectedCoin, state.marginMode, parseFloat(accountInfo.availableToTrade || '0'))
                    
                    // Handle negative liquidation price (very safe position in cross margin)
                    if (liquidationPrice < 0) {
                      return `Very Safe (${liquidationPrice.toFixed(2)})`
                    }
                    
                    return `$${liquidationPrice.toFixed(2)}`
                  }
                  return 'N/A'
                })()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Order Value:</span>
              <span className="text-white">
                {(() => {
                  // Check if size is valid
                  const sizeValue = parseFloat(state.size || '0')
                  const isValidSize = !isNaN(sizeValue) && sizeValue > 0
                  
                  if (state.size && state.sizeUnit === 'USD' && isValidSize) {
                    return `$${sizeValue.toFixed(2)}`
                  } else if (state.size && state.sizeUnit === state.selectedCoin && typeof topCardPrice === 'number' && isValidSize) {
                    const value = sizeValue * topCardPrice
                    return `$${value.toFixed(2)}`
                  }
                  return 'N/A'
                })()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Margin Required:</span>
              <span className="text-white">
                {(() => {
                  if (state.size && state.sizeUnit === 'USD') {
                    const margin = parseFloat(state.size) / state.leverage
                    return `$${margin.toFixed(2)}`
                  } else if (state.size && state.sizeUnit === state.selectedCoin && typeof topCardPrice === 'number') {
                    const value = parseFloat(state.size) * topCardPrice
                    const margin = value / state.leverage
                    return `$${margin.toFixed(2)}`
                  }
                  return 'N/A'
                })()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Slippage:</span>
              <span className="text-white">
                {state.orderType === 'market' ? 'Est: 0.1% / Max: 0.5%' : 'Est: 0% / Max: 0.1%'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Fees:</span>
              <span className="text-green-400 flex items-center gap-1">
                <TrendingUp size={14} />
                {(() => {
                  if (state.size && state.sizeUnit === 'USD') {
                    const makerFee = TradingConfigHelper.calculateMakerFee(parseFloat(state.size))
                    const takerFee = TradingConfigHelper.calculateTakerFee(parseFloat(state.size))
                    return `${(makerFee * 100).toFixed(4)}% / ${(takerFee * 100).toFixed(4)}%`
                  } else if (state.size && state.sizeUnit === state.selectedCoin && typeof topCardPrice === 'number') {
                    const value = parseFloat(state.size) * topCardPrice
                    const makerFee = TradingConfigHelper.calculateMakerFee(value)
                    const takerFee = TradingConfigHelper.calculateTakerFee(value)
                    return `${(makerFee * 100).toFixed(4)}% / ${(takerFee * 100).toFixed(4)}%`
                  }
                  return '0.01% / 0.02%'
                })()}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Order Confirmation Popup */}
      {showConfirmPopup && pendingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-bg border border-gray-600 rounded-lg p-6 w-96 max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Confirm Order</h3>
              <button
                onClick={handleCancelOrder}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-400">Action:</span>
                <span className={`font-medium ${pendingOrder.action === 'Buy' ? 'text-green-400' : 'text-red-400'}`}>
                  {pendingOrder.action}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Size:</span>
                <span className="text-white font-medium">{pendingOrder.size}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Price:</span>
                <span className="text-white font-medium">
                  {(() => {
                    // Handle different order types
                    if (pendingOrder.orderType === 'twap') {
                      // For TWAP orders, show market price
                      return topCardPrice ? `$${topCardPrice.toFixed(2)} (Market)` : 'Market'
                    } else if (pendingOrder.orderType === 'scale') {
                      // For scale orders, show start and end prices
                      const startPrice = state.scaleStartPrice && state.scaleStartPrice.trim() !== '' ? state.scaleStartPrice : 'N/A'
                      const endPrice = state.scaleEndPrice && state.scaleEndPrice.trim() !== '' ? state.scaleEndPrice : 'N/A'
                      return `${startPrice} - ${endPrice}`
                    } else {
                      // For market and limit orders, use the existing logic
                      if (!pendingOrder.price || pendingOrder.price === 'Market' || pendingOrder.price === '') {
                        // For market orders, show current market price if available
                        if (pendingOrder.orderType === 'market' && topCardPrice) {
                          return `$${topCardPrice.toFixed(2)} (Market)`
                        }
                        // For limit orders without price, show N/A
                        if (pendingOrder.orderType === 'limit' && (!pendingOrder.price || pendingOrder.price === '')) {
                          return 'N/A'
                        }
                        // Default fallback
                        return pendingOrder.price || 'N/A'
                      }
                      return pendingOrder.price
                    }
                  })()}
                </span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Est. Liquidation Price:</span>
                <span className="text-white font-medium">{pendingOrder.liquidationPrice}</span>
              </div>
              
              {/* Reduce Only Information */}
              {pendingOrder.reduceOnly && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Reduce Only:</span>
                  <span className="text-yellow-400 font-medium">Enabled</span>
                </div>
              )}
              
              {/* Take Profit / Stop Loss Information */}
              {pendingOrder.takeProfitStopLoss && (
                <>
                  {pendingOrder.takeProfitPrice && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Take Profit:</span>
                      <span className="text-green-400 font-medium">${pendingOrder.takeProfitPrice}</span>
                    </div>
                  )}
                  {pendingOrder.stopLossPrice && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Stop Loss:</span>
                      <span className="text-red-400 font-medium">${pendingOrder.stopLossPrice}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            

            {/* Order Payload */}
            <div className="mt-4 p-3 bg-gray-800/50 border border-gray-600 rounded">
              <div className="text-sm text-gray-400 mb-2">Main Order Payload:</div>
              <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(pendingOrder.payload, null, 2)}
              </pre>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleCancelOrder}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOrder}
                className={`flex-1 px-4 py-2 rounded transition-colors font-medium ${
                  pendingOrder.action === 'Buy'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                Confirm {pendingOrder.action}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Response Popup */}
      <OrderResponsePopup
        isOpen={showOrderPopup}
        onClose={handleCloseOrderPopup}
        response={orderResponse}
      />

      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        reverseOrder={false}
        gutter={8}
        containerStyle={{
          top: 20,
          right: 20,
        }}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1e293b',
            color: '#ffffff',
            border: '1px solid #374151',
            borderRadius: '8px',
            padding: '12px 16px',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'all 0.3s ease',
          },
          success: {
            duration: 5000,
            style: {
              background: '#065f46',
              color: '#ffffff',
              border: '1px solid #10b981',
              borderRadius: '8px',
              padding: '12px 16px',
              cursor: 'pointer',
              userSelect: 'none',
            },
          },
          error: {
            duration: 6000,
            style: {
              background: '#7f1d1d',
              color: '#ffffff',
              border: '1px solid #ef4444',
              borderRadius: '8px',
              padding: '12px 16px',
              cursor: 'pointer',
              userSelect: 'none',
            },
          },
          loading: {
            duration: Infinity,
            style: {
              background: '#1e293b',
              color: '#14b8a6',
              border: '1px solid #14b8a6',
              borderRadius: '8px',
              padding: '12px 16px',
              cursor: 'pointer',
              userSelect: 'none',
            },
          },
        }}
      />
    </div>
  )
}

export default TradingInterface
