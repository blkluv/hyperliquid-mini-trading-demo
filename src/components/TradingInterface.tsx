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
    getPositionForCoin
  } = useTrading()

  const [currentNetwork, setCurrentNetwork] = useState<'testnet' | 'mainnet' | 'unknown'>('unknown')
  const [orderResponse, setOrderResponse] = useState<OrderResponse | null>(null)
  const [showOrderPopup, setShowOrderPopup] = useState(false)
  const [currentPosition, setCurrentPosition] = useState<string>('0.00000 BTC')
  
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

  // Auto-update limit price with current market price when available
  useEffect(() => {
    if (state.orderType === 'limit' && typeof topCardPrice === 'number' && !state.limitPrice) {
      setState(prev => ({ ...prev, limitPrice: topCardPrice.toString() }))
    }
  }, [topCardPrice, state.orderType, state.limitPrice])

  // Update limit price when coin changes (if limit order is selected)
  useEffect(() => {
    if (state.orderType === 'limit' && typeof topCardPrice === 'number') {
      setState(prev => ({ ...prev, limitPrice: topCardPrice.toString() }))
    }
  }, [state.selectedCoin, topCardPrice, state.orderType])

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
  
  const handleSizeChange = (value: string) => {
    setState(prev => ({ ...prev, size: value }))
  }

  const handleSizePercentageChange = (percentage: number) => {
    setState(prev => ({ ...prev, sizePercentage: percentage }))
  }

  const handleLimitPriceChange = (value: string) => {
    // Only allow numeric input (including decimal point)
    const numericValue = value.replace(/[^0-9.]/g, '')
    // Prevent multiple decimal points
    const parts = numericValue.split('.')
    const formattedValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : numericValue
    setState(prev => ({ ...prev, limitPrice: formattedValue }))
  }

  const handleScalePriceChange = (field: 'scaleStartPrice' | 'scaleEndPrice' | 'scaleStepSize', value: string) => {
    // Only allow numeric input (including decimal point)
    const numericValue = value.replace(/[^0-9.]/g, '')
    // Prevent multiple decimal points
    const parts = numericValue.split('.')
    const formattedValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : numericValue
    setState(prev => ({ ...prev, [field]: formattedValue }))
  }

  const handleScaleOrderCountChange = (value: string) => {
    // Only allow positive integers
    const numericValue = value.replace(/[^0-9]/g, '')
    setState(prev => ({ ...prev, scaleOrderCount: numericValue }))
  }

  const handleTwapNumericChange = (field: 'twapRunningTimeHours' | 'twapRunningTimeMinutes' | 'twapNumberOfIntervals' | 'twapPriceOffset', value: string) => {
    // Only allow numeric input (including decimal point)
    const numericValue = value.replace(/[^0-9.]/g, '')
    // Prevent multiple decimal points
    const parts = numericValue.split('.')
    const formattedValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : numericValue
    setState(prev => ({ ...prev, [field]: formattedValue }))
  }

  const handleTPSLChange = (field: 'takeProfitPrice' | 'stopLossPrice' | 'takeProfitGain' | 'stopLossLoss', value: string) => {
    // Only allow numeric input (including decimal point)
    const numericValue = value.replace(/[^0-9.]/g, '')
    // Prevent multiple decimal points
    const parts = numericValue.split('.')
    const formattedValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : numericValue
    
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

  const handleSubmitOrder = async () => {
    try {
      console.log('🎨 Component: Submitting order...')
      const result = await placeOrder()
      
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
      setShowOrderPopup(true)
    }
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
          onClick={() => setState(prev => ({ ...prev, side: 'buy' }))}
        >
          Buy / Long
        </button>
        <button
          className={`flex-1 py-3 rounded font-medium ${
            state.side === 'sell'
              ? 'bg-teal-primary text-white'
              : 'bg-dark-border text-gray-400 hover:text-white'
          }`}
          onClick={() => setState(prev => ({ ...prev, side: 'sell' }))}
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
            onChange={(e) => setState(prev => ({ ...prev, sizeUnit: e.target.value as 'USD' | 'BTC' }))}
            className="px-3 py-2 bg-dark-border border border-gray-600 rounded text-white focus:outline-none focus:border-teal-primary"
          >
            <option value="USD">USD</option>
            <option value="BTC">BTC</option>
          </select>
        </div>

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
                className="flex-1 px-3 py-2 bg-dark-border border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-teal-primary"
              />
              <button
                type="button"
                onClick={() => {
                  if (typeof topCardPrice === 'number') {
                    setState(prev => ({ ...prev, limitPrice: topCardPrice.toString() }))
                  }
                }}
                disabled={typeof topCardPrice !== 'number'}
                className="px-3 py-2 bg-teal-primary text-black text-sm font-medium rounded hover:bg-teal-400 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Mid
              </button>
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

      {/* Submit Button */}
      <button
        onClick={handleSubmitOrder}
        disabled={!isInitialized || isLoading || !state.size || 
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
                // Simplified liquidation price calculation
                // In reality, this would depend on current position, margin, and leverage
                const currentPrice = topCardPrice
                const leverage = state.leverage
                
                if (state.side === 'buy') {
                  // For long positions, liquidation price is lower
                  const liquidationPrice = currentPrice * (1 - (1 / leverage) + 0.1) // 10% buffer
                  return liquidationPrice.toFixed(10)
                } else {
                  // For short positions, liquidation price is higher
                  const liquidationPrice = currentPrice * (1 + (1 / leverage) + 0.1) // 10% buffer
                  return liquidationPrice.toFixed(10)
                }
              }
              return 'N/A'
            })()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Order Value:</span>
          <span className="text-white">
            {(() => {
              if (state.size && state.sizeUnit === 'USD') {
                return `$${parseFloat(state.size).toFixed(2)}`
              } else if (state.size && state.sizeUnit === 'BTC' && typeof topCardPrice === 'number') {
                const value = parseFloat(state.size) * topCardPrice
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
              } else if (state.size && state.sizeUnit === 'BTC' && typeof topCardPrice === 'number') {
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
              } else if (state.size && state.sizeUnit === 'BTC' && typeof topCardPrice === 'number') {
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
