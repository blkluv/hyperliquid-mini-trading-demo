import React, { useState, useEffect } from 'react'
import { ChevronDown, TrendingUp, AlertCircle, Network } from 'lucide-react'
import { useTrading } from '../hooks/useTrading'
import OrderResponsePopup, { OrderResponse } from './OrderResponsePopup'

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
    getNetworkStatus
  } = useTrading()

  const [currentNetwork, setCurrentNetwork] = useState<'testnet' | 'mainnet' | 'unknown'>('unknown')
  const [orderResponse, setOrderResponse] = useState<OrderResponse | null>(null)
  const [showOrderPopup, setShowOrderPopup] = useState(false)

  const handleSizeChange = (value: string) => {
    setState(prev => ({ ...prev, size: value }))
  }

  const handleSizePercentageChange = (percentage: number) => {
    setState(prev => ({ ...prev, sizePercentage: percentage }))
  }

  const handleSubmitOrder = async () => {
    try {
      console.log('🎨 Component: Submitting order...')
      const result = await placeOrder()
      
      // Parse Hyperliquid response format
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
      </div>

      {/* Top Configuration Bar */}
      <div className="flex gap-2 mb-4">
        <button
          className={`px-3 py-1 rounded text-sm font-medium ${
            state.marginMode === 'isolated'
              ? 'bg-dark-border text-white'
              : 'bg-transparent text-gray-400 hover:text-white'
          }`}
          onClick={() => handleMarginModeChange('isolated')}
          disabled={isLoading}
        >
          Isolated
        </button>
        <div className="flex gap-1">
          {[1, 3, 5, 9].map((leverage) => (
            <button
              key={leverage}
              className={`px-2 py-1 rounded text-sm font-medium ${
                state.leverage === leverage
                  ? 'bg-dark-border text-white'
                  : 'bg-transparent text-gray-400 hover:text-white'
              }`}
              onClick={() => handleLeverageChange(leverage)}
              disabled={isLoading}
            >
              {leverage}x
            </button>
          ))}
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
          className={`px-4 py-2 rounded text-sm font-medium ${
            state.orderType === 'market'
              ? 'bg-white text-black'
              : 'bg-transparent text-gray-400 hover:text-white'
          }`}
          onClick={() => setState(prev => ({ ...prev, orderType: 'market' }))}
        >
          Market
        </button>
        <button
          className={`px-4 py-2 rounded text-sm font-medium ${
            state.orderType === 'limit'
              ? 'bg-white text-black'
              : 'bg-transparent text-gray-400 hover:text-white'
          }`}
          onClick={() => setState(prev => ({ ...prev, orderType: 'limit' }))}
        >
          Limit
        </button>
        <button
          className={`px-4 py-2 rounded text-sm font-medium ${
            state.orderType === 'scale'
              ? 'bg-white text-black'
              : 'bg-transparent text-gray-400 hover:text-white'
          }`}
          onClick={() => setState(prev => ({ ...prev, orderType: 'scale' }))}
        >
          Scale
        </button>
        <button
          className={`px-4 py-2 rounded text-sm font-medium ${
            state.orderType === 'twap'
              ? 'bg-white text-black'
              : 'bg-transparent text-gray-400 hover:text-white'
          }`}
          onClick={() => setState(prev => ({ ...prev, orderType: 'twap' }))}
        >
          TWAP
        </button>
        <div className="ml-auto">
          <button className="px-3 py-2 rounded text-sm font-medium bg-transparent text-gray-400 hover:text-white flex items-center gap-1">
            Pro
            <ChevronDown size={16} />
          </button>
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
            onChange={(e) => setState(prev => ({ ...prev, sizeUnit: e.target.value as 'USD' | 'BTC' }))}
            className="px-3 py-2 bg-dark-border border border-gray-600 rounded text-white focus:outline-none focus:border-teal-primary"
          >
            <option value="USD">USD</option>
            <option value="BTC">BTC</option>
          </select>
        </div>

        {/* Limit Price Input for Limit Orders */}
        {state.orderType === 'limit' && (
          <div className="mb-2">
            <input
              type="text"
              placeholder="Limit Price"
              value={state.limitPrice}
              onChange={(e) => setState(prev => ({ ...prev, limitPrice: e.target.value }))}
              className="w-full px-3 py-2 bg-dark-border border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-teal-primary"
            />
          </div>
        )}

        {/* Take Profit / Stop Loss Inputs */}
        {state.takeProfitStopLoss && (
          <div className="space-y-2 mb-2">
            <input
              type="text"
              placeholder="Take Profit Price"
              value={state.takeProfitPrice}
              onChange={(e) => setState(prev => ({ ...prev, takeProfitPrice: e.target.value }))}
              className="w-full px-3 py-2 bg-dark-border border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-teal-primary"
            />
            <input
              type="text"
              placeholder="Stop Loss Price"
              value={state.stopLossPrice}
              onChange={(e) => setState(prev => ({ ...prev, stopLossPrice: e.target.value }))}
              className="w-full px-3 py-2 bg-dark-border border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-teal-primary"
            />
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
        disabled={!isInitialized || isLoading || !state.size}
        className="w-full py-3 bg-teal-primary hover:bg-teal-hover disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded mb-6 transition-colors"
      >
        {isLoading ? 'Processing...' : 'Enable Trading'}
      </button>

      {/* Order Details */}
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Liquidation Price:</span>
          <span className="text-white">{accountInfo.liquidationPrice}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Order Value:</span>
          <span className="text-white">{accountInfo.orderValue}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Margin Required:</span>
          <span className="text-white">{accountInfo.marginRequired}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Slippage:</span>
          <span className="text-white">{accountInfo.slippage}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Fees:</span>
          <span className="text-green-400 flex items-center gap-1">
            <TrendingUp size={14} />
            {accountInfo.fees}
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
