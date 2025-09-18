import React, { useState, useEffect } from 'react'
import { ChevronDown, TrendingUp, AlertCircle, Network } from 'lucide-react'
import { useTrading } from '../hooks/useTrading'
import { usePriceSubscription } from '../hooks/usePriceSubscription'
import OrderResponsePopup, { OrderResponse } from './OrderResponsePopup'
import { CONFIG } from '../config/config'

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
    formatPriceForTickSize
  } = useTrading()

  const [currentNetwork, setCurrentNetwork] = useState<'testnet' | 'mainnet' | 'unknown'>('unknown')
  const [orderResponse, setOrderResponse] = useState<OrderResponse | null>(null)
  const [showOrderPopup, setShowOrderPopup] = useState(false)
  const [currentPosition, setCurrentPosition] = useState<string>('0.00000 BTC')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set())
  const [showConfirmPopup, setShowConfirmPopup] = useState(false)
  const [pendingOrder, setPendingOrder] = useState<any>(null)
  
  // Helper function to mark field as touched
  const markFieldAsTouched = (fieldName: string) => {
    setTouchedFields(prev => new Set(prev).add(fieldName))
  }

  // Helper function to convert USD to coin size with coin-specific rounding
  const convertUsdToCoinSize = (usdAmount: number, coinPrice: number, coin: string): number => {
    const rawSize = usdAmount / coinPrice
    
    // Extract base coin from coin pair (e.g., "BTC-PERP" -> "BTC")
    const baseCoin = coin.toUpperCase().split('-')[0]
    
    // Apply coin-specific rounding rules
    switch (baseCoin) {
      case 'DOGE':
        // DOGE: Round up to integer
        return Math.ceil(rawSize)
      case 'BTC':
        // BTC: Round up to 0.00001 (5 decimal places)
        return Math.ceil(rawSize * 100000) / 100000
      case 'ETH':
        // ETH: Round up to 0.0001 (4 decimal places)
        return Math.ceil(rawSize * 10000) / 10000
      case 'SOL':
        // SOL: Round up to 0.01 (2 decimal places)
        return Math.ceil(rawSize * 100) / 100
      default:
        // Default: Round up to 0.000001 (6 decimal places)
        return Math.ceil(rawSize * 1000000) / 1000000
    }
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
  const calculateLiquidationPrice = (entryPrice: number, leverage: number, side: 'buy' | 'sell', coin: string = 'BTC') => {
    // Different maintenance margins for different assets (typical values)
    const maintenanceMargins: { [key: string]: number } = {
      'BTC': 0.04,  // 4% for BTC
      'ETH': 0.05,  // 5% for ETH
      'SOL': 0.06,  // 6% for SOL
      'default': 0.05 // 5% default
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
          setCurrentPosition(position)
        } catch (error) {
          console.error('Failed to initialize position for selected coin:', error)
          setCurrentPosition(`0.00000 ${state.selectedCoin}`)
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
    ? priceMap[selectedCoinKey]
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
      } else if (sizeValue < 0.001) {
        errors.push('Minimum order size is 0.001')
      } else {
        // 3. Check minimum order value (should be > 10 USD)
        const orderValue = state.sizeUnit === 'USD' 
          ? sizeValue  // For USD, order value is the size itself
          : sizeValue * (currentPrice || 0)  // For coin units, multiply by price
        
        if (orderValue > 0 && orderValue < 10) {
          errors.push('Minimum order value is $10 USD')
        }
        
        // 5. UX Warnings for extreme values
        if (orderValue > 1000000) {
          errors.push('Warning: Order value is extremely large (>$1M)')
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
        } else {
          // For sell orders, check position and margin requirements
          const availableBalance = parseFloat(accountInfo.availableToTrade || '0')
          const positionMatch = currentPosition.match(/(\d+\.?\d*)\s+(\w+)/)
          
          if (positionMatch) {
            const availablePosition = parseFloat(positionMatch[1])
            
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
          const startPrice = parseFloat(state.scaleStartPrice.trim())
          const endPrice = parseFloat(state.scaleEndPrice.trim())
          if (!isNaN(startPrice) && !isNaN(endPrice) && startPrice <= endPrice) {
            errors.push('Start price must be higher than end price')
          }
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
                // Higher leverage with more orders increases risk
                if (orderCount > 10 && state.leverage > 10) {
                  errors.push('Maximum 10x leverage allowed for scale orders with more than 10 orders')
                }
                if (orderCount > 15 && state.leverage > 5) {
                  errors.push('Maximum 5x leverage allowed for scale orders with more than 15 orders')
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
                if (totalMinutes > 720 && state.leverage > 10) { // > 12 hours
                  errors.push('Maximum 10x leverage for TWAP orders longer than 12 hours')
                }
                if (totalMinutes > 1440 && state.leverage > 5) { // > 24 hours
                  errors.push('Maximum 5x leverage for TWAP orders longer than 24 hours')
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
        if (state.leverage >= 20 && requiredMargin < 100) {
          errors.push('Minimum margin required for 20x+ leverage is $100')
        }
        if (state.leverage >= 30 && requiredMargin < 200) {
          errors.push('Minimum margin required for 30x+ leverage is $200')
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
          errors.push('Take profit gain must be between 0.01% and 1000%')
        }
      }
      
      if (touchedFields.has('stopLossLoss') && state.stopLossLoss && state.stopLossLoss.trim() !== '') {
        const slLoss = parseFloat(state.stopLossLoss.trim())
        if (isNaN(slLoss) || slLoss <= 0 || slLoss > 100) {
          errors.push('Stop loss must be between 0.01% and 100%')
        }
      }
    }

    setValidationErrors(errors)
  }, [state, currentPrice, accountInfo, touchedFields, currentPosition])
  
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

  const handleScalePriceChange = (field: 'scaleStartPrice' | 'scaleEndPrice' | 'scaleStepSize', value: string) => {
    // Normalize input: trim spaces, only allow numeric input (including decimal point)
    const trimmedValue = value.trim()
    const numericValue = trimmedValue.replace(/[^0-9.]/g, '')
    // Prevent multiple decimal points
    const parts = numericValue.split('.')
    const formattedValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : numericValue
    markFieldAsTouched(field)
    setState(prev => ({ ...prev, [field]: formattedValue }))
  }

  const handleScaleOrderCountChange = (value: string) => {
    // Normalize input: trim spaces, only allow positive integers
    const trimmedValue = value.trim()
    const numericValue = trimmedValue.replace(/[^0-9]/g, '')
    markFieldAsTouched('scaleOrderCount')
    setState(prev => ({ ...prev, scaleOrderCount: numericValue }))
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
    
    // Update position for the selected coin
    try {
      const position = await getPositionForCoin(coin)
      setCurrentPosition(position)
      console.log(`Position for ${coin}:`, position)
    } catch (error) {
      console.error('Failed to update position for selected coin:', error)
      setCurrentPosition(`0.00000 ${coin}`)
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

    // Prepare order details for confirmation
    const orderDetails = {
      action: state.side === 'buy' ? 'Buy' : 'Sell',
      size: state.sizeUnit === 'USD' 
        ? `${convertedSize || state.size} ${state.selectedCoin}` 
        : `${state.size} ${state.selectedCoin}`,
      price: state.orderType === 'market' ? 'Market' : state.limitPrice,
      liquidationPrice: (() => {
        if (state.size && typeof topCardPrice === 'number') {
          const entryPrice = state.orderType === 'limit' && state.limitPrice 
            ? parseFloat(state.limitPrice) 
            : topCardPrice
          const leverage = state.leverage
          const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, state.side, state.selectedCoin)
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
      leverage: state.leverage
    }

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
          setOrderResponse({
            success: true,
            orderId: `Scale Order (${successfulOrders}/${totalOrders})`,
            status: 'All Orders Placed',
            message: `Scale order completed: ${successfulOrders}/${totalOrders} orders placed successfully`,
            data: result
          })
        } else if (successfulOrders > 0) {
          setOrderResponse({
            success: true,
            orderId: `Scale Order (${successfulOrders}/${totalOrders})`,
            status: 'Partial Success',
            message: `Scale order partially completed: ${successfulOrders}/${totalOrders} orders placed successfully`,
            data: result
          })
        } else {
          setOrderResponse({
            success: false,
            error: 'All scale orders failed',
            message: 'Scale order placement failed',
            data: result
          })
        }
      } else if (result?.type === 'twap') {
        const successfulOrders = result.successfulOrders
        const totalOrders = result.totalOrders
        const totalDuration = result.totalDuration
        
        setOrderResponse({
          success: true,
          orderId: `TWAP Order (${successfulOrders}/${totalOrders})`,
          status: 'TWAP Started',
          message: `TWAP order started: ${successfulOrders}/${totalOrders} orders placed immediately. Remaining orders will execute over ${totalDuration} minutes.`,
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
    } catch (err) {
      console.error('Failed to update leverage:', err)
    }
  }

  const handleMarginModeChange = async (marginMode: 'isolated' | 'cross') => {
    try {
      await updateMarginMode(marginMode)
    } catch (err) {
      console.error('Failed to update margin mode:', err)
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
      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded flex items-center gap-2 text-red-400">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Validation Errors Display */}
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

      {/* Loading Indicator */}
      {isLoading && (
        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500 rounded text-blue-400 text-sm">
          Processing...
        </div>
      )}

      {/* SDK Status */}
      {!isInitialized && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500 rounded text-yellow-400 text-sm">
          Initializing Hyperliquid SDK...
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
        <div className="mt-4 p-3 bg-gray-900/60 rounded-lg flex justify-between items-center border border-gray-700">
          <span className="text-gray-400 text-sm">
            {formatPairLabel(state.selectedCoin)} Price:
          </span>
          <span className="text-green-400 font-bold text-lg">
            {priceError ? (
              <span className="text-red-400 text-sm">{priceError}</span>
            ) : typeof topCardPrice === 'number' ? (
              `$${topCardPrice.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })}`
            ) : priceConnected ? (
              <span className="text-gray-400 text-sm">Loading...</span>
            ) : (
              <span className="text-gray-400 text-sm">Connecting...</span>
            )}
          </span>
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
                    <span className="text-2xl">{selectedCoinData?.icon}</span>
                    <span className="text-lg font-medium text-white">{selectedCoinData?.name}</span>
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
      <div className="flex gap-2 mb-4">
        {/* Margin Mode Dropdown */}
        <div className="relative">
          <select
            value={state.marginMode}
            onChange={(e) => handleMarginModeChange(e.target.value as 'isolated' | 'cross')}
            disabled={isLoading}
            className="px-3 py-1 rounded text-sm font-medium bg-dark-border text-white border border-gray-600 focus:border-teal-primary focus:outline-none appearance-none pr-8 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="cross">Cross</option>
            <option value="isolated">Isolated</option>
          </select>
          <ChevronDown size={16} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        {/* Leverage Dropdown */}
        <div className="relative">
          <select
            value={state.leverage}
            onChange={(e) => handleLeverageChange(parseInt(e.target.value))}
            disabled={isLoading}
            className="px-3 py-1 rounded text-sm font-medium bg-dark-border text-white border border-gray-600 focus:border-teal-primary focus:outline-none appearance-none pr-8 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value={1}>1x</option>
            <option value={3}>3x</option>
            <option value={5}>5x</option>
            <option value={9}>9x</option>
          </select>
          <ChevronDown size={16} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <button
          className="px-3 py-1 rounded text-sm font-medium bg-dark-border text-white"
        >
          One-Way
        </button>
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
          <span className="text-white">{currentPosition}</span>
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
          <div className="mb-2 space-y-2">
            <div className="text-sm text-gray-400 mb-2">Scale Order Configuration</div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Start Price"
                value={state.scaleStartPrice}
                onChange={(e) => handleScalePriceChange('scaleStartPrice', e.target.value)}
                className="px-3 py-2 bg-dark-border border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-teal-primary"
              />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="End Price"
                value={state.scaleEndPrice}
                onChange={(e) => handleScalePriceChange('scaleEndPrice', e.target.value)}
                className="px-3 py-2 bg-dark-border border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-teal-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Step Size"
                value={state.scaleStepSize}
                onChange={(e) => handleScalePriceChange('scaleStepSize', e.target.value)}
                className="px-3 py-2 bg-dark-border border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-teal-primary"
              />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Order Count"
                value={state.scaleOrderCount}
                onChange={(e) => handleScaleOrderCountChange(e.target.value)}
                className="px-3 py-2 bg-dark-border border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-teal-primary"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={state.scaleSizeDistribution}
                onChange={(e) => setState(prev => ({ ...prev, scaleSizeDistribution: e.target.value as 'equal' | 'linear' }))}
                className="flex-1 px-3 py-2 bg-dark-border border border-gray-600 rounded text-white focus:outline-none focus:border-teal-primary"
              >
                <option value="equal">Equal Size</option>
                <option value="linear">Linear Distribution</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  if (typeof topCardPrice === 'number') {
                    const startPrice = (topCardPrice * 1.02).toFixed(2)
                    const endPrice = (topCardPrice * 0.98).toFixed(2)
                    const stepSize = ((parseFloat(startPrice) - parseFloat(endPrice)) / 4).toFixed(2)
                    setState(prev => ({ 
                      ...prev, 
                      scaleStartPrice: startPrice,
                      scaleEndPrice: endPrice,
                      scaleStepSize: stepSize
                    }))
                  }
                }}
                disabled={typeof topCardPrice !== 'number'}
                className="px-3 py-2 bg-teal-primary text-black text-sm font-medium rounded hover:bg-teal-400 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Auto
              </button>
            </div>
            
            {/* Scale Order Preview */}
            {state.scaleStartPrice && state.scaleEndPrice && state.scaleStepSize && state.scaleOrderCount && (
              <div className="mt-3 p-3 bg-gray-800/50 border border-gray-600 rounded">
                <div className="text-xs text-gray-400 mb-2">Order Preview:</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {(() => {
                    const startPrice = parseFloat(state.scaleStartPrice)
                    const endPrice = parseFloat(state.scaleEndPrice)
                    const stepSize = parseFloat(state.scaleStepSize)
                    const orderCount = parseInt(state.scaleOrderCount)
                    const totalSize = parseFloat(state.size) || 0
                    
                    if (isNaN(startPrice) || isNaN(endPrice) || isNaN(stepSize) || isNaN(orderCount) || orderCount <= 0) {
                      return <div className="text-xs text-gray-500">Invalid parameters</div>
                    }
                    
                    const orders = []
                    const priceStep = (startPrice - endPrice) / (orderCount - 1)
                    
                    for (let i = 0; i < orderCount; i++) {
                      const price = (startPrice - (priceStep * i)).toFixed(2)
                      let size = totalSize / orderCount // Equal distribution
                      
                      if (state.scaleSizeDistribution === 'linear') {
                        // Linear distribution - larger sizes at better prices
                        const factor = (orderCount - i) / orderCount
                        size = totalSize * factor * (2 / orderCount)
                      }
                      
                      orders.push(
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-300">Order {i + 1}:</span>
                          <span className="text-white">${price} × {size.toFixed(4)}</span>
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

            {/* Additional Configuration */}
            <div className="space-y-2">
              <div className="text-sm text-gray-400">Order Configuration</div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Number of Intervals"
                  value={state.twapNumberOfIntervals}
                  onChange={(e) => handleTwapNumericChange('twapNumberOfIntervals', e.target.value)}
                  className="px-3 py-2 bg-dark-border border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-teal-primary"
                />
                <select
                  value={state.twapOrderType}
                  onChange={(e) => setState(prev => ({ ...prev, twapOrderType: e.target.value as 'market' | 'limit' }))}
                  className="px-3 py-2 bg-dark-border border border-gray-600 rounded text-white focus:outline-none focus:border-teal-primary"
                >
                  <option value="market">Market Orders</option>
                  <option value="limit">Limit Orders</option>
                </select>
              </div>
              {state.twapOrderType === 'limit' && (
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Price Offset %"
                  value={state.twapPriceOffset}
                  onChange={(e) => handleTwapNumericChange('twapPriceOffset', e.target.value)}
                  className="w-full px-3 py-2 bg-dark-border border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-teal-primary"
                />
              )}
            </div>
            
            {/* TWAP Order Preview */}
            {state.twapRunningTimeHours && state.twapRunningTimeMinutes && state.twapNumberOfIntervals && state.size && (
              <div className="mt-3 p-3 bg-gray-800/50 border border-gray-600 rounded">
                <div className="text-xs text-gray-400 mb-2">TWAP Order Preview:</div>
                <div className="space-y-1">
                  {(() => {
                    const runningTimeHours = parseInt(state.twapRunningTimeHours)
                    const runningTimeMinutes = parseInt(state.twapRunningTimeMinutes)
                    const numberOfIntervals = parseInt(state.twapNumberOfIntervals)
                    const totalSize = parseFloat(state.size)
                    
                    if (isNaN(runningTimeHours) || isNaN(runningTimeMinutes) || isNaN(numberOfIntervals) || isNaN(totalSize) || numberOfIntervals <= 0) {
                      return <div className="text-xs text-gray-500">Invalid parameters</div>
                    }
                    
                    const totalRunningTimeMinutes = (runningTimeHours * 60) + runningTimeMinutes
                    const subOrderSize = totalSize / numberOfIntervals
                    const intervalDuration = totalRunningTimeMinutes / numberOfIntervals
                    const startTime = new Date()
                    const endTime = new Date(startTime.getTime() + totalRunningTimeMinutes * 60 * 1000)
                    
                    return (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-300">Sub-order Size:</span>
                          <span className="text-white">{subOrderSize.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-300">Total Duration:</span>
                          <span className="text-white">{totalRunningTimeMinutes} minutes</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-300">Interval Duration:</span>
                          <span className="text-white">{intervalDuration.toFixed(1)} minutes</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-300">Start Time:</span>
                          <span className="text-white">{startTime.toLocaleTimeString()}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-300">End Time:</span>
                          <span className="text-white">{endTime.toLocaleTimeString()}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-300">Order Type:</span>
                          <span className="text-white capitalize">{state.twapOrderType}</span>
                        </div>
                        {state.twapOrderType === 'limit' && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-300">Price Offset:</span>
                            <span className="text-white">{state.twapPriceOffset}%</span>
                          </div>
                        )}
                        {state.twapRandomize && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-300">Randomization:</span>
                            <span className="text-white">Enabled</span>
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
                    `$${topCardPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
        
        {/* Size Percentage Slider */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-gray-400">
            <span>0%</span>
            <span>{state.sizePercentage}%</span>
            <span>100%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={state.sizePercentage}
            onChange={(e) => handleSizePercentageChange(Number(e.target.value))}
            className="w-full h-2 bg-dark-border rounded-lg appearance-none cursor-pointer slider"
          />
        </div>
      </div>

      {/* Order Options */}
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

      {/* Error Messages */}
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
          (state.orderType === 'scale' && (!state.scaleStartPrice || !state.scaleEndPrice || !state.scaleOrderCount)) ||
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
                
                const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, state.side, state.selectedCoin)
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
                const makerFee = parseFloat(state.size) * 0.0001 // 0.01% maker fee
                const takerFee = parseFloat(state.size) * 0.0002 // 0.02% taker fee
                return `${(makerFee * 100).toFixed(4)}% / ${(takerFee * 100).toFixed(4)}%`
              } else if (state.size && state.sizeUnit === state.selectedCoin && typeof topCardPrice === 'number') {
                const value = parseFloat(state.size) * topCardPrice
                const makerFee = value * 0.0001
                const takerFee = value * 0.0002
                return `${(makerFee * 100).toFixed(4)}% / ${(takerFee * 100).toFixed(4)}%`
              }
              return '0.01% / 0.02%'
            })()}
          </span>
        </div>
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
                <span className="text-white font-medium">{pendingOrder.price}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Est. Liquidation Price:</span>
                <span className="text-white font-medium">{pendingOrder.liquidationPrice}</span>
              </div>
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
    </div>
  )
}

export default TradingInterface
