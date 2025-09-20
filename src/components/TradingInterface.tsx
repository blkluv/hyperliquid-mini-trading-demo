import React, { useState, useEffect } from 'react'
import { ChevronDown, AlertCircle, Network } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { useTrading } from '../hooks/useTrading'
import { usePriceSubscription } from '../hooks/usePriceSubscription'
import OrderResponsePopup, { OrderResponse } from './OrderResponsePopup'
import { CONFIG } from '../config/config'
import { TradingConfigHelper } from '../config/tradingConfig'
import { hyperliquidService } from '../services/hyperliquidService'
import { validateHyperliquidPrice, validateHyperliquidSizeSync, formatHyperliquidPriceSync, formatHyperliquidSizeSync, getHyperliquidSizeValidationError, validateHyperliquidPriceSync, HyperliquidPrecision } from '../utils/hyperliquidPrecision'
import { leverageService, LeverageInfo } from '../services/leverageService'

const applyMaxDigitLimit = (value: string, maxDigits = 12) => {
  if (!value) {
    return value
  }

  // Count total characters including decimal point
  const totalLength = value.replace(/\s/g, '').length
  
  if (totalLength <= maxDigits) {
    return value
  }

  const [integerPartRaw = '', ...restDecimalParts] = value.split('.')
  const integerPart = integerPartRaw
  const decimalCombined = restDecimalParts.join('')
  const hasDecimal = restDecimalParts.length > 0

  if (!hasDecimal) {
    // No decimal point, just truncate integer part
    return integerPart.slice(0, maxDigits)
  }

  // Has decimal point - need to account for the decimal point in the count
  const maxDigitsForContent = maxDigits - 1 // Subtract 1 for the decimal point
  
  if (integerPart.length >= maxDigitsForContent) {
    // Integer part is too long, truncate it
    return integerPart.slice(0, maxDigitsForContent)
  }

  const allowedDecimalDigits = Math.max(0, maxDigitsForContent - integerPart.length)
  const truncatedDecimal = decimalCombined.slice(0, allowedDecimalDigits)
  return truncatedDecimal.length > 0 ? `${integerPart}.${truncatedDecimal}` : integerPart
}

const getDigitCount = (value: string | null | undefined) => {
  if (!value) {
    return 0
  }
  // Count all characters except spaces - including decimal points
  return value.replace(/\s/g, '').length
}

// Helper function to move cursor to end
const moveCursorToEnd = (inputEl?: HTMLInputElement) => {
  if (inputEl?.setSelectionRange) {
    const cursorPosition = inputEl.value.length
    requestAnimationFrame(() => inputEl.setSelectionRange(cursorPosition, cursorPosition))
  }
}

// 移除validateLeadingZeros函数，使用normalizeLeadingZeros代替


const normalizeLeadingZeros = (value: string) => {
  if (!value) {
    return value
  }

  const endsWithDot = value.endsWith('.')
  const [integerPartRaw = '', ...decimalParts] = value.split('.')
  let integerPart = integerPartRaw

  if (integerPart === '') {
    integerPart = '0'
  } else if (/^0+$/.test(integerPart)) {
    integerPart = '0'
  } else {
    integerPart = integerPart.replace(/^0+/, '')
    if (integerPart === '') {
      integerPart = '0'
    }
  }

  const decimalPart = decimalParts.join('')
  let result = integerPart

  if (decimalParts.length > 0) {
    result += decimalPart ? `.${decimalPart}` : '.'
  } else if (endsWithDot) {
    result += '.'
  }

  return result
}

// Helper function to check if decimal insertion in middle is valid
const isValidDecimalInsertion = (value: string, currentValue: string, maxDecimals: number | null | undefined): boolean => {
  if (maxDecimals === 0) {
    return !value.includes('.')
  }

  // Check for multiple decimal points - reject if more than one
  const dotCount = (value.match(/\./g) || []).length
  if (dotCount > 1) {
    return false // Multiple decimal points are invalid
  }

  if (!value.includes('.')) {
    return true // No decimal point is always valid
  }
  
  // If current value already has a decimal point and user is trying to add another
  if (currentValue && currentValue.includes('.') && value.includes('.')) {
    return false // Reject additional decimal points
  }
  
  // Check if decimal point is in the middle
  const lastDotIndex = value.lastIndexOf('.')
  if (lastDotIndex === value.length - 1) {
    return true // Decimal point at the end is always valid
  }
  
  if (typeof maxDecimals === 'number' && maxDecimals >= 0) {
    const parts = value.split('.')
    if (parts.length === 2) {
      const decimalPart = parts[1]
      if (decimalPart.length > maxDecimals) {
        return false // Invalid decimal length
      }
    }
  }
  
  return true
}

const enforceMaxDigits = (
  value: string,
  previousValue: string,
  inputEl?: HTMLInputElement,
  maxDigits = 12
) => {
  const digitsOnlyLength = getDigitCount(value)

  if (digitsOnlyLength > maxDigits) {
    const previousDigits = getDigitCount(previousValue)

    if (previousDigits >= maxDigits) {
      // Already at max digits, do nothing but move cursor to end
      moveCursorToEnd(inputEl)
      return null
    }

    const limitedValue = applyMaxDigitLimit(value, maxDigits)
    moveCursorToEnd(inputEl)
    return limitedValue
  }

  return value
}

type TopCoin = {
  symbol: string
  name: string
  maxLeverage: number
  szDecimals?: number
  pxDecimals?: number
  marginTableId?: number
  dayNotionalVolume?: number
  dayBaseVolume?: number
  markPrice?: number | null
  midPrice?: number | null
  oraclePrice?: number | null
  change24h?: number | null
  change24hPercent?: number | null
}

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
  
  // Dynamic leverage state
  const [leverageInfo, setLeverageInfo] = useState<LeverageInfo | null>(null)
  const [maxLeverage, setMaxLeverage] = useState<number>(50) // Default fallback
  const [availableLeverage, setAvailableLeverage] = useState<number>(50)
  
  // Leverage update delay state
  const [leverageUpdateTimeout, setLeverageUpdateTimeout] = useState<NodeJS.Timeout | null>(null)
  
  // Coin dropdown state
  const [isCoinDropdownOpen, setIsCoinDropdownOpen] = useState<boolean>(false)
  
  // Order type dropdown state
  const [isOrderTypeDropdownOpen, setIsOrderTypeDropdownOpen] = useState<boolean>(false)
  
  // Dynamic top coins from API
  const [topCoins, setTopCoins] = useState<TopCoin[]>([])

  const [assetPrecision, setAssetPrecision] = useState<{ szDecimals: number | null; pxDecimals: number | null }>({
    szDecimals: null,
    pxDecimals: null
  })

  const formatNotionalVolume = React.useCallback((volume?: number) => {
    if (typeof volume !== 'number' || !Number.isFinite(volume) || volume <= 0) {
      return '—'
    }

    const absoluteVolume = Math.abs(volume)
    if (absoluteVolume >= 1e9) {
      return `$${(absoluteVolume / 1e9).toFixed(2)}B`
    }
    if (absoluteVolume >= 1e6) {
      return `$${(absoluteVolume / 1e6).toFixed(2)}M`
    }
    if (absoluteVolume >= 1e3) {
      return `$${(absoluteVolume / 1e3).toFixed(1)}K`
    }
    return `$${absoluteVolume.toFixed(0)}`
  }, [])

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
      
      /* Custom scrollbar for coin dropdown */
      .coin-dropdown-scroll::-webkit-scrollbar {
        width: 6px;
      }
      
      .coin-dropdown-scroll::-webkit-scrollbar-track {
        background: #374151;
        border-radius: 3px;
      }
      
      .coin-dropdown-scroll::-webkit-scrollbar-thumb {
        background: #6b7280;
        border-radius: 3px;
      }
      
      .coin-dropdown-scroll::-webkit-scrollbar-thumb:hover {
        background: #9ca3af;
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


  // Helper function to check if there's insufficient balance
  const hasInsufficientBalance = (): boolean => {
    if (!accountInfo || !state.size) return false
    
    const sizeValue = parseFloat(state.size)
    if (isNaN(sizeValue) || sizeValue <= 0) return false
    
    const orderValue = state.sizeUnit === 'USD' 
      ? sizeValue  // For USD, order value is the size itself
      : sizeValue * (currentPrice || topCardPrice || 0)  // For coin units, multiply by price
    
    if (state.side === 'buy') {
      const availableBalance = parseFloat(accountInfo.availableToTrade || '0')
      return orderValue > availableBalance
    }
    
    return false
  }

  // Helper function to check if size is zero or invalid
  const hasZeroOrInvalidSize = (): boolean => {
    if (!state.size || state.size.trim() === '') return true
    
    const sizeValue = parseFloat(state.size.trim())
    return isNaN(sizeValue) || sizeValue <= 0
  }

  // Helper function to check if USD converts to coin size below minimum decimal
  const hasInsufficientCoinSize = (): boolean => {
    if (state.sizeUnit !== 'USD' || !state.size || !currentPrice) return false
    
    const usdAmount = parseFloat(state.size.trim())
    if (isNaN(usdAmount) || usdAmount <= 0) return false
    
    // Convert USD to coin size
    const convertedCoinSize = usdAmount / currentPrice
    
    try {
      // Get the coin's szDecimals to determine minimum size
      const defaultAssetInfo = HyperliquidPrecision.getDefaultAssetInfo(state.selectedCoin)
      const szDecimals = assetPrecision.szDecimals ?? defaultAssetInfo.szDecimals
      
      // Calculate minimum size based on szDecimals
      const minSize = Math.pow(10, -szDecimals) // e.g., szDecimals=5 → minSize=0.00001
      
      return convertedCoinSize < minSize
    } catch (error) {
      console.warn('Could not check coin size minimum:', error)
      return false
    }
  }

  // Helper function to get size input restrictions for current coin
  const getSizeInputRestrictions = () => {
    if (state.sizeUnit === 'USD') {
      return {
        placeholder: 'Size (max 12 digits, 2 decimals)',
        title: 'Enter size in USD (max 12 digits total, 2 decimal places)',
        szDecimals: 2 // USD has max 2 decimal places
      }
    }
    
    try {
      const defaultAssetInfo = HyperliquidPrecision.getDefaultAssetInfo(state.selectedCoin)
      const szDecimals = assetPrecision.szDecimals ?? defaultAssetInfo.szDecimals
      
      console.log(`📏 Size restrictions for ${state.selectedCoin}:`, {
        szDecimals,
        defaultAssetInfo,
        assetPrecision
      })
      
      if (szDecimals === 0) {
        return {
          placeholder: 'Size (whole numbers only)',
          title: `${state.selectedCoin} only accepts whole numbers (no decimals)`,
          szDecimals: 0
        }
      } else {
        return {
          placeholder: `Size (max ${szDecimals} decimal${szDecimals === 1 ? '' : 's'})`,
          title: `${state.selectedCoin} accepts up to ${szDecimals} decimal place${szDecimals === 1 ? '' : 's'}`,
          szDecimals
        }
      }
    } catch (error) {
      console.warn('Could not get size restrictions:', error)
      return {
        placeholder: 'Size',
        title: 'Enter size',
        szDecimals: null
      }
    }
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
    const precision = TradingConfigHelper.getSzDecimals(coinKey)
    
    if (precision === 0) {
      // Round to integer
      return roundDown(rawSize)
    } else {
      // Round to specified decimal places
      const multiplier = Math.pow(10, precision)
      return roundDown(Math.round(rawSize * multiplier) / multiplier)
    }
  }

  // Helper function to convert USD to coin size with Hyperliquid precision (round down)
  const convertUsdToCoinSize = (usdAmount: number, coinPrice: number, coin: string): number => {
    const rawSize = usdAmount / coinPrice
    
    try {
      // Get asset info for rounding
      const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(coin)
      const szDecimals = assetInfo.szDecimals
      
      // Round DOWN according to coin size decimal
      let roundedSize: number
      if (szDecimals === 0) {
        // For DOGE (szDecimals = 0), round DOWN to nearest integer
        roundedSize = Math.floor(rawSize)
      } else {
        // For other coins, round DOWN to szDecimals
        const multiplier = Math.pow(10, szDecimals)
        roundedSize = Math.floor(rawSize * multiplier) / multiplier
      }
      
      return roundedSize
    } catch (error) {
      console.error('Error formatting coin size:', error)
      // Fallback to original logic
      const baseCoin = coin.toUpperCase().split('-')[0]
      return roundCoinSize(rawSize, baseCoin)
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

  /**
   * Calculate the liquidation price for a position
   *
   * @param {Object} params - Input parameters
   * @param {number} params.entryPrice - Entry price of the asset
   * @param {number} params.positionSize - Size of the position (contracts or units)
   * @param {("long"|"short")} params.side - Trade direction
   * @param {("cross"|"isolated")} params.marginType - Margin type
   * @param {number} params.accountValue - (cross only) Total account equity
   * @param {number} params.isolatedMargin - (isolated only) Margin allocated to this position
   * @param {number} params.maintenanceMarginRequired - Maintenance margin required
   * @param {number} params.maintenanceLeverage - Exchange-defined maintenance leverage
   * @returns {number} liquidation price
   */
  const calculateLiquidationPrice = (params: {
    entryPrice: number;
    positionSize: number;
    side: 'long' | 'short';
    marginType: 'cross' | 'isolated';
    accountValue?: number;
    isolatedMargin?: number;
    maintenanceMarginRequired: number;
    maintenanceLeverage: number;
  }) => {
    const {
      entryPrice,
      positionSize,
      side,
      marginType,
      accountValue = 0,
      isolatedMargin = 0,
      maintenanceMarginRequired,
      maintenanceLeverage
    } = params;

    if (positionSize === 0) {
      throw new Error("Position size cannot be zero.");
    }

    // Convert side string to numeric
    const sideNum = side === "long" ? 1 : -1;

    // Compute margin_available based on margin type
    let marginAvailable: number;
    if (marginType === "cross") {
      marginAvailable = accountValue - maintenanceMarginRequired;
    } else if (marginType === "isolated") {
      marginAvailable = isolatedMargin - maintenanceMarginRequired;
    } else {
      throw new Error("Invalid marginType: must be 'cross' or 'isolated'");
    }

    // l = 1 / MAINTENANCE_LEVERAGE
    const l = 1 / maintenanceLeverage;

    // Formula:
    // liq_price = price - side * (margin_available / position_size) / (1 - l * side)
    const numerator = marginAvailable / positionSize;
    const denominator = 1 - (l * sideNum);

    if (denominator === 0) {
      throw new Error("Invalid parameters: denominator becomes zero.");
    }

    const liquidationPrice = entryPrice - sideNum * (numerator / denominator);

    return liquidationPrice;
  }

  // Helper function to convert legacy parameters to new format
  const calculateLiquidationPriceLegacy = (
    entryPrice: number,
    leverage: number,
    side: 'buy' | 'sell',
    coin: string = 'BTC',
    marginMode: 'isolated' | 'cross' = 'isolated',
    _walletBalance: number = 0,
    positionSize: number = 0,
    accountValue: number = 0,
    isolatedMargin: number = 0
  ) => {
    // Maintenance leverage ratios (1 / MAINTENANCE_LEVERAGE)
    const maintenanceLeverages: { [key: string]: number } = {
      'BTC': 0.004,   // 0.4% (1/250)
      'ETH': 0.005,   // 0.5% (1/200)
      'SOL': 0.01,    // 1% (1/100)
      'default': 0.005
    }
    
    const maintenanceLeverage = 1 / (maintenanceLeverages[coin] || maintenanceLeverages.default)
    const sideConverted = side === 'buy' ? 'long' : 'short'
    const marginTypeConverted = marginMode === 'isolated' ? 'isolated' : 'cross'
    
    // Calculate position size if not provided
    if (positionSize === 0) {
      const availableBalance = marginMode === 'cross' ? accountValue : isolatedMargin
      positionSize = (availableBalance * leverage) / entryPrice
    }
    
    // Calculate maintenance margin required
    const maintenanceMarginRequired = Math.abs(positionSize) * entryPrice * (maintenanceLeverages[coin] || maintenanceLeverages.default)
    
    return calculateLiquidationPrice({
      entryPrice,
      positionSize,
      side: sideConverted,
      marginType: marginTypeConverted,
      accountValue,
      isolatedMargin,
      maintenanceMarginRequired,
      maintenanceLeverage
    })
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

  // Auto-update limit price with current market price when switching to limit order
  useEffect(() => {
    if (state.orderType === 'limit' && typeof topCardPrice === 'number') {
      // Always update limit price when switching to limit order or when coin changes
      const formattedPrice = formatPriceForTickSize(topCardPrice, state.selectedCoin)
      setState(prev => ({ ...prev, limitPrice: formattedPrice }))
    }
  }, [topCardPrice, state.orderType, state.selectedCoin])

  // Update size unit when coin changes (if currently showing a coin unit)
  useEffect(() => {
    if (state.sizeUnit !== 'USD') {
      setState(prev => ({ ...prev, sizeUnit: state.selectedCoin }))
    }
  }, [state.selectedCoin])

  // Fetch dynamic leverage information when coin changes
  useEffect(() => {
    const fetchLeverageInfo = async () => {
      if (state.selectedCoin && isInitialized) {
        try {
          const coinName = state.selectedCoin.replace('-PERP', '')
          const leverageData = await leverageService.getLeverageInfo(coinName)
          
          setLeverageInfo(leverageData)
          setMaxLeverage(leverageData.maxLeverage)
          
          // Calculate available leverage based on current position size
          let availableLeverage = leverageData.maxLeverage
          if (state.size && state.size.trim() !== '') {
            const sizeValue = parseFloat(state.size.trim())
            if (!isNaN(sizeValue) && sizeValue > 0) {
              const available = await leverageService.getAvailableLeverage(coinName, sizeValue)
              availableLeverage = available
            }
          }
          setAvailableLeverage(availableLeverage)
          
          // Auto-adjust current leverage if it exceeds the new maximum
          const effectiveMaxLeverage = Math.min(leverageData.maxLeverage, availableLeverage)
          if (state.leverage > effectiveMaxLeverage) {
            console.log(`📉 Auto-adjusting leverage from ${state.leverage}x to ${effectiveMaxLeverage}x due to new limits`)
            setState(prev => ({ ...prev, leverage: effectiveMaxLeverage }))
            
          }
          
          console.log(`📊 Dynamic leverage info for ${coinName}:`, {
            maxLeverage: leverageData.maxLeverage,
            availableLeverage: availableLeverage,
            marginTable: leverageData.marginTable
          })
        } catch (error) {
          console.error('Failed to fetch leverage info:', error)
          // Keep default values
        }
      }
    }

    fetchLeverageInfo()
  }, [state.selectedCoin, isInitialized])

  // Update available leverage when position size changes
  useEffect(() => {
    const updateAvailableLeverage = async () => {
      if (state.selectedCoin && state.size && state.size.trim() !== '' && isInitialized) {
        try {
          const coinName = state.selectedCoin.replace('-PERP', '')
          const sizeValue = parseFloat(state.size.trim())
          
          if (!isNaN(sizeValue) && sizeValue > 0) {
            const available = await leverageService.getAvailableLeverage(coinName, sizeValue)
            setAvailableLeverage(available)
            
            // Auto-adjust current leverage if it exceeds the new available leverage
            if (state.leverage > available) {
              console.log(`📉 Auto-adjusting leverage from ${state.leverage}x to ${available}x due to position size`)
              setState(prev => ({ ...prev, leverage: available }))
              
              // Show notification to user
              toast.success(`Leverage automatically adjusted to ${available}x due to position size`, {
                duration: 4000,
                style: {
                  background: '#1e40af',
                  color: '#ffffff',
                  border: '1px solid #3b82f6',
                },
              })
            }
          }
        } catch (error) {
          console.error('Failed to update available leverage:', error)
        }
      }
    }

    updateAvailableLeverage()
  }, [state.size, state.selectedCoin, isInitialized])

  // Close coin dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (isCoinDropdownOpen && !target.closest('.coin-dropdown-container')) {
        setIsCoinDropdownOpen(false)
      }
      if (isOrderTypeDropdownOpen && !target.closest('.order-type-dropdown-container')) {
        setIsOrderTypeDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isCoinDropdownOpen, isOrderTypeDropdownOpen])

  // Fetch top coins from API
  useEffect(() => {
    const fetchTopCoins = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/top-coins')
        if (response.ok) {
          const data = await response.json() as { coins: TopCoin[] }
          if (Array.isArray(data.coins)) {
            // 移除primeCacheFromCoins调用，不再使用缓存
          setTopCoins(data.coins)
          console.log('📊 Top coins from API:', data.coins)
          } else {
            console.error('❌ Top coins response missing coins array')
          }
        } else {
          console.error('❌ Failed to fetch top coins:', response.status)
          // Fallback to hardcoded list
          setTopCoins(CONFIG.AVAILABLE_COINS.map(coin => ({
            symbol: coin.symbol,
            name: coin.name,
            maxLeverage: 10 // Default fallback
          })))
        }
      } catch (error) {
        console.error('❌ Error fetching top coins:', error)
        // Fallback to hardcoded list
        setTopCoins(CONFIG.AVAILABLE_COINS.map(coin => ({
          symbol: coin.symbol,
          name: coin.name,
          maxLeverage: 10 // Default fallback
        })))
      }
    }
    
    fetchTopCoins()
  }, [])

  // Fetch precision metadata for the selected coin
  useEffect(() => {
    let isMounted = true

    const applyPrecision = (sz: number | null, px: number | null) => {
      if (isMounted) {
        setAssetPrecision({
          szDecimals: typeof sz === 'number' ? sz : null,
          pxDecimals: typeof px === 'number' ? px : null
        })
      }
    }

    if (!state.selectedCoin) {
      applyPrecision(null, null)
      return () => {
        isMounted = false
      }
    }

    const topCoinEntry = topCoins.find(coin => coin.symbol === state.selectedCoin)
    let needsFetch = true

    if (topCoinEntry) {
      applyPrecision(topCoinEntry.szDecimals ?? null, topCoinEntry.pxDecimals ?? null)
      needsFetch = !(
        typeof topCoinEntry.szDecimals === 'number' &&
        typeof topCoinEntry.pxDecimals === 'number'
      )
    }

    const loadPrecision = async () => {
      if (!needsFetch) {
        return
      }

      try {
        const precision = await HyperliquidPrecision.getAssetInfo(state.selectedCoin)
        applyPrecision(precision.szDecimals ?? null, precision.pxDecimals ?? null)
      } catch (error) {
        console.error('Failed to load asset precision for', state.selectedCoin, error)
        if (!topCoinEntry) {
          applyPrecision(null, null)
        }
      }
    }

    loadPrecision()

    return () => {
      isMounted = false
    }
  }, [state.selectedCoin, topCoins])

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
    // Note: Order quantity validation is now handled in button disabled state, not as validation error

    // 2. Valid Quantity & Data Type Safety (only show if size field has been touched)
    if (touchedFields.has('size') && state.size && state.size.trim() !== '') {
      const sizeValue = parseFloat(state.size.trim())
        
        // Validate size precision according to Hyperliquid requirements
      // Skip validation if size unit is USD (no precision restrictions for USD)
      if (state.sizeUnit !== 'USD') {
        try {
          if (!validateHyperliquidSizeSync(sizeValue, state.selectedCoin)) {
            const errorMessage = getHyperliquidSizeValidationError(sizeValue, state.selectedCoin)
            errors.push(errorMessage)
          }
        } catch (error) {
          console.error('Error validating order size:', error)
          errors.push('Order size validation failed')
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
      }
    }

    // 4. Sufficient Balance (frontend hint) - only show if size field has been touched
    if (touchedFields.has('size') && state.size && state.side && currentPrice && accountInfo) {
      const sizeValue = parseFloat(state.size.trim())
      if (!isNaN(sizeValue) && sizeValue > 0) {
        if (state.side === 'buy') {
          // Note: Insufficient balance is now handled in button disabled state, not as validation error
          
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
                const formattedAvailablePosition = formatHyperliquidSizeSync(availablePosition, state.selectedCoin)
                errors.push(`Reduce-only sell order would increase position. Maximum sell size: ${formattedAvailablePosition} ${state.selectedCoin}`)
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
            } else {
              // Validate price precision according to Hyperliquid requirements
              // Skip validation if size unit is USD (no precision restrictions for USD)
              if (state.sizeUnit !== 'USD') {
              try {
                if (!validateHyperliquidPrice(priceValue, state.selectedCoin)) {
                  errors.push('Limit price does not meet Hyperliquid precision requirements')
                }
              } catch (error) {
                console.error('Error validating limit price:', error)
                // Continue with original validation if precision validation fails
                }
              }
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
            } else {
              // Validate price precision using Hyperliquid rules
              // Skip validation if size unit is USD (no precision restrictions for USD)
              if (state.sizeUnit !== 'USD') {
                try {
                  const isValidPrice = validateHyperliquidPrice(startPrice, state.selectedCoin)
                  if (!isValidPrice) {
                    errors.push(`Scale start price precision is invalid for ${state.selectedCoin}. Please check the price format.`)
                  }
                } catch (error) {
                  console.error('Error validating start price:', error)
                  errors.push('Invalid scale start price format')
                }
              }
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
            } else {
              // Validate price precision using Hyperliquid rules
              // Skip validation if size unit is USD (no precision restrictions for USD)
              if (state.sizeUnit !== 'USD') {
                try {
                  const isValidPrice = validateHyperliquidPrice(endPrice, state.selectedCoin)
                  if (!isValidPrice) {
                    errors.push(`Scale end price precision is invalid for ${state.selectedCoin}. Please check the price format.`)
                  }
                } catch (error) {
                  console.error('Error validating end price:', error)
                  errors.push('Invalid scale end price format')
                }
              }
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
            
            // Validate all sub-order prices for precision
            // Skip validation if size unit is USD (no precision restrictions for USD)
            if (state.sizeUnit !== 'USD') {
              const priceStep = (endPrice - startPrice) / Math.max(1, orderCount - 1)
              for (let i = 0; i < orderCount; i++) {
                const subOrderPrice = startPrice + (priceStep * i)
                try {
                  const isValidPrice = validateHyperliquidPrice(subOrderPrice, state.selectedCoin)
                  if (!isValidPrice) {
                    errors.push(`Scale order ${i + 1} price precision is invalid for ${state.selectedCoin}. Please adjust price range.`)
                    break // Only show one error to avoid spam
                  }
                } catch (error) {
                  console.error('Error validating sub-order price:', error)
                  errors.push(`Invalid price format for scale order ${i + 1}`)
                  break
                }
              }
            }
            
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
        const requiredMargin = orderValue / state.leverage
        
        
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
        
        // Dynamic asset-specific leverage validations
        if (leverageInfo) {
          const maxLeverageForAsset = Math.min(maxLeverage, availableLeverage)
          if (state.leverage > maxLeverageForAsset) {
            errors.push(`Maximum leverage for ${state.selectedCoin} is ${maxLeverageForAsset}x (based on position size and asset limits)`)
          }
        } else {
          // Fallback to hardcoded limits if dynamic data unavailable
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
  

  const handleSizeChange = (value: string, inputEl?: HTMLInputElement) => {
  // Normalize input: trim spaces, allow only numbers and decimal point
  let normalizedValue = value.trim().replace(/[^0-9.]/g, '')
  normalizedValue = normalizeLeadingZeros(normalizedValue)

  const restrictions = getSizeInputRestrictions()
  const decimalLimit = restrictions.szDecimals

  if (!isValidDecimalInsertion(normalizedValue, state.size || '', decimalLimit)) {
    return
  }

  const enforcedValue = enforceMaxDigits(normalizedValue, state.size || '', inputEl)
  if (enforcedValue === null) {
    return
  }
  normalizedValue = enforcedValue

  if (state.sizeUnit === 'USD') {
    const parts = normalizedValue.split('.')
    if (parts.length > 2) {
      return
    }

    if (parts.length > 1) {
      parts[1] = parts[1].substring(0, 2)
      normalizedValue = `${parts[0]}.${parts[1]}`
    }

    markFieldAsTouched('size')
    setState(prev => ({ ...prev, size: normalizedValue }))
    return
  }

  if (decimalLimit !== null) {
    if (decimalLimit === 0) {
      normalizedValue = normalizedValue.replace(/\./g, '')
    } else {
      const parts = normalizedValue.split('.')
      if (parts.length > 2) {
        return
      }

      if (parts.length > 1) {
        parts[1] = parts[1].substring(0, decimalLimit)
        normalizedValue = parts.join('.')
      }
    }
  }

  markFieldAsTouched('size')
  setState(prev => ({ ...prev, size: normalizedValue }))
}









  const handleLimitPriceChange = (value: string, inputEl?: HTMLInputElement) => {
  // Normalize input: trim spaces, only allow numeric input (including decimal point)
  const trimmedValue = value.trim()
  let numericValue = trimmedValue.replace(/[^0-9.]/g, '')
  numericValue = normalizeLeadingZeros(numericValue)

  // Get price precision for the selected coin
  let maxDecimals: number | null = null
  try {
    const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(state.selectedCoin)
    maxDecimals = assetInfo.pxDecimals
    console.log(`🔍 Limit price precision for ${state.selectedCoin}: ${maxDecimals} decimals`)
    console.log(`🔍 Asset info for ${state.selectedCoin}:`, assetInfo)
  } catch (error) {
    console.error('Error getting price precision for limit price:', error)
    // Fallback to default precision
    maxDecimals = 4
  }

  if (!isValidDecimalInsertion(numericValue, state.limitPrice || '', maxDecimals)) {
    moveCursorToEnd(inputEl)
    return
  }

  const enforcedValue = enforceMaxDigits(numericValue, state.limitPrice || '', inputEl)
  if (enforcedValue === null) {
    return
  }
  numericValue = enforcedValue

  // Apply price precision limits
  const parts = numericValue.split('.')
  if (parts.length > 2) {
    moveCursorToEnd(inputEl)
    return
  }

  // Limit decimal places according to price precision
  if (parts.length === 2 && maxDecimals !== null) {
    const decimalPart = parts[1]
    if (decimalPart.length > maxDecimals) {
      parts[1] = decimalPart.substring(0, maxDecimals)
      numericValue = parts.join('.')
      // Move cursor to end after truncating
      moveCursorToEnd(inputEl)
    }
  }

  markFieldAsTouched('limitPrice')
  setState(prev => ({ ...prev, limitPrice: numericValue }))
}





  const handleLimitPriceBlur = () => {
    // Format price according to Hyperliquid precision requirements when user finishes editing
    if (state.limitPrice && !isNaN(parseFloat(state.limitPrice))) {
      const price = parseFloat(state.limitPrice)
      
      // Check if the price is valid according to Hyperliquid rules
      if (!validateHyperliquidPriceSync(price, state.selectedCoin)) {
        // Don't format if it's invalid - let user see the warning
        return
      }
      
      try {
        const formattedPrice = formatHyperliquidPriceSync(price, state.selectedCoin)
        setState(prev => ({ ...prev, limitPrice: formattedPrice }))
      } catch (error) {
        console.error('Error formatting limit price:', error)
        // Fallback to original formatting
        const formattedPrice = formatPriceForTickSize(price, state.selectedCoin)
        setState(prev => ({ ...prev, limitPrice: formattedPrice }))
      }
    }
  }

  // Scale order start price handlers

  const handleScaleStartPriceChange = (value: string, inputEl?: HTMLInputElement) => {
  const trimmedValue = value.trim()
  let numericValue = trimmedValue.replace(/[^0-9.]/g, '')
  numericValue = normalizeLeadingZeros(numericValue)

  // Get price precision for the selected coin
  let maxDecimals: number | null = null
  try {
    const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(state.selectedCoin)
    maxDecimals = assetInfo.pxDecimals
  } catch (error) {
    console.error('Error getting price precision for scale start price:', error)
    maxDecimals = 4
  }

  if (!isValidDecimalInsertion(numericValue, state.scaleStartPrice || '', maxDecimals)) {
    moveCursorToEnd(inputEl)
    return
  }

  const enforcedValue = enforceMaxDigits(numericValue, state.scaleStartPrice || '', inputEl)
  if (enforcedValue === null) {
    return
  }
  numericValue = enforcedValue

  // Apply price precision limits
  const parts = numericValue.split('.')
  if (parts.length > 2) {
    moveCursorToEnd(inputEl)
    return
  }

  // Limit decimal places according to price precision
  if (parts.length === 2 && maxDecimals !== null) {
    const decimalPart = parts[1]
    if (decimalPart.length > maxDecimals) {
      parts[1] = decimalPart.substring(0, maxDecimals)
      numericValue = parts.join('.')
    }
  }

  markFieldAsTouched('scaleStartPrice')
  setState(prev => ({ ...prev, scaleStartPrice: numericValue }))
}




  const handleScaleStartPriceBlur = () => {
    // Format price according to Hyperliquid precision requirements when user finishes editing
    if (state.scaleStartPrice && !isNaN(parseFloat(state.scaleStartPrice))) {
      const price = parseFloat(state.scaleStartPrice)
      
      // Check if the price is valid according to Hyperliquid rules
      if (!validateHyperliquidPriceSync(price, state.selectedCoin)) {
        // Don't format if it's invalid - let user see the warning
        return
      }
      
      try {
        const formattedPrice = formatHyperliquidPriceSync(price, state.selectedCoin)
        setState(prev => ({ ...prev, scaleStartPrice: formattedPrice }))
      } catch (error) {
        console.error('Error formatting scale start price:', error)
        // Fallback to original formatting
        const formattedPrice = formatPriceForTickSize(price, state.selectedCoin)
        setState(prev => ({ ...prev, scaleStartPrice: formattedPrice }))
      }
    }
  }

  // Scale order end price handlers

  const handleScaleEndPriceChange = (value: string, inputEl?: HTMLInputElement) => {
  const trimmedValue = value.trim()
  let numericValue = trimmedValue.replace(/[^0-9.]/g, '')
  numericValue = normalizeLeadingZeros(numericValue)

  // Get price precision for the selected coin
  let maxDecimals: number | null = null
  try {
    const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(state.selectedCoin)
    maxDecimals = assetInfo.pxDecimals
  } catch (error) {
    console.error('Error getting price precision for scale end price:', error)
    maxDecimals = 4
  }

  if (!isValidDecimalInsertion(numericValue, state.scaleEndPrice || '', maxDecimals)) {
    moveCursorToEnd(inputEl)
    return
  }

  const enforcedValue = enforceMaxDigits(numericValue, state.scaleEndPrice || '', inputEl)
  if (enforcedValue === null) {
    return
  }
  numericValue = enforcedValue

  // Apply price precision limits
  const parts = numericValue.split('.')
  if (parts.length > 2) {
    moveCursorToEnd(inputEl)
    return
  }

  // Limit decimal places according to price precision
  if (parts.length === 2 && maxDecimals !== null) {
    const decimalPart = parts[1]
    if (decimalPart.length > maxDecimals) {
      parts[1] = decimalPart.substring(0, maxDecimals)
      numericValue = parts.join('.')
    }
  }

  markFieldAsTouched('scaleEndPrice')
  setState(prev => ({ ...prev, scaleEndPrice: numericValue }))
}




  const handleScaleEndPriceBlur = () => {
    // Format price according to Hyperliquid precision requirements when user finishes editing
    if (state.scaleEndPrice && !isNaN(parseFloat(state.scaleEndPrice))) {
      const price = parseFloat(state.scaleEndPrice)
      
      // Check if the price is valid according to Hyperliquid rules
      if (!validateHyperliquidPriceSync(price, state.selectedCoin)) {
        // Don't format if it's invalid - let user see the warning
        return
      }
      
      try {
        const formattedPrice = formatHyperliquidPriceSync(price, state.selectedCoin)
        setState(prev => ({ ...prev, scaleEndPrice: formattedPrice }))
      } catch (error) {
        console.error('Error formatting scale end price:', error)
        // Fallback to original formatting
        const formattedPrice = formatPriceForTickSize(price, state.selectedCoin)
        setState(prev => ({ ...prev, scaleEndPrice: formattedPrice }))
      }
    }
  }



  const handleScaleOrderCountChange = (value: string, inputEl?: HTMLInputElement) => {
  const sanitizedValue = value.trim().replace(/[^0-9]/g, '')
  const normalizedValue = normalizeLeadingZeros(sanitizedValue)

  const enforcedValue = enforceMaxDigits(normalizedValue, state.scaleOrderCount || '', inputEl)
  if (enforcedValue === null) {
    return
  }

  markFieldAsTouched('scaleOrderCount')
  setState(prev => ({ ...prev, scaleOrderCount: enforcedValue }))
}

  const handleSizeSkewChange = (value: string, inputEl?: HTMLInputElement) => {
  const trimmedValue = value.trim().replace(/[^0-9.]/g, '')
  let numericValue = normalizeLeadingZeros(trimmedValue)

  if (!isValidDecimalInsertion(numericValue, state.scaleSizeSkew || '', 2)) {
    return
  }

  const parts = numericValue.split('.')
  if (parts.length > 2) {
    return
  }

  if (parts.length > 1) {
    parts[1] = parts[1].substring(0, 2)
    numericValue = parts.join('.')
  }

  const numericValueFloat = parseFloat(numericValue)
  if (!isNaN(numericValueFloat) && numericValueFloat > 100) {
    setState(prev => ({ ...prev, scaleSizeSkew: '100.00' }))
    return
  }

  const enforcedValue = enforceMaxDigits(numericValue, state.scaleSizeSkew || '', inputEl)
  if (enforcedValue === null) {
    return
  }

  markFieldAsTouched('scaleSizeSkew')
  setState(prev => ({ ...prev, scaleSizeSkew: enforcedValue }))
}



  const handleTwapNumericChange = (field: 'twapRunningTimeHours' | 'twapRunningTimeMinutes' | 'twapNumberOfIntervals' | 'twapPriceOffset', value: string, inputEl?: HTMLInputElement) => {
    // Normalize input: trim spaces, only allow numeric input (including decimal point)
    const trimmedValue = value.trim()
    let numericValue = trimmedValue.replace(/[^0-9.]/g, '')
    numericValue = normalizeLeadingZeros(numericValue)

    const previousValue = String((state as unknown as Record<string, string | undefined>)[field] ?? '')

  if (field === 'twapRunningTimeHours' || field === 'twapRunningTimeMinutes') {
    numericValue = numericValue.replace(/\./g, '')
  } else {
    if (!isValidDecimalInsertion(numericValue, previousValue, undefined)) {
      return
    }

    const parts = numericValue.split('.')
    if (parts.length > 2) {
      return
    }
  }

  numericValue = normalizeLeadingZeros(numericValue)

  const enforcedValue = enforceMaxDigits(numericValue, previousValue || '', inputEl)
  if (enforcedValue === null) {
    return
  }
  numericValue = enforcedValue

  if (field === 'twapRunningTimeHours' || field === 'twapRunningTimeMinutes') {
    markFieldAsTouched('twapRunningTime')
  } else {
    markFieldAsTouched(field)
  }

  setState(prev => ({ ...prev, [field]: numericValue }))
}








  const handleTPSLChange = (field: 'takeProfitPrice' | 'stopLossPrice' | 'takeProfitGain' | 'stopLossLoss', value: string, inputEl?: HTMLInputElement) => {
    // Normalize input: trim spaces, only allow numeric input (including decimal point)
    const trimmedValue = value.trim()
    let numericValue = trimmedValue.replace(/[^0-9.]/g, '')
    numericValue = normalizeLeadingZeros(numericValue)

    const previousValue = String((state as unknown as Record<string, string | undefined>)[field] ?? '')

  if (!isValidDecimalInsertion(numericValue, previousValue, undefined)) {
    return
  }

  numericValue = normalizeLeadingZeros(numericValue)

  const enforcedValue = enforceMaxDigits(numericValue, previousValue || '', inputEl)
  if (enforcedValue === null) {
    return
  }
  numericValue = enforcedValue

  const parts = numericValue.split('.')
  if (parts.length > 2) {
    return
  }

  markFieldAsTouched(field)

  setState(prev => {
    const newState = { ...prev, [field]: numericValue }

    if (typeof topCardPrice === 'number' && numericValue) {
      if (field === 'takeProfitGain') {
        const gainPercent = parseFloat(numericValue) / 100
        if (!isNaN(gainPercent)) {
          newState.takeProfitPrice = (topCardPrice * (prev.side === 'buy' ? 1 + gainPercent : 1 - gainPercent)).toFixed(2)
        }
      } else if (field === 'stopLossLoss') {
        const lossPercent = parseFloat(numericValue) / 100
        if (!isNaN(lossPercent)) {
          newState.stopLossPrice = (topCardPrice * (prev.side === 'buy' ? 1 - lossPercent : 1 + lossPercent)).toFixed(2)
        }
      }
    }

    return newState
  })
}





  // Take Profit Price handlers with pxDecimals formatting

  const handleTakeProfitPriceChange = (value: string, inputEl?: HTMLInputElement) => {
  const trimmedValue = value.trim()
  let numericValue = trimmedValue.replace(/[^0-9.]/g, '')
  numericValue = normalizeLeadingZeros(numericValue)

  // Get price precision for the selected coin
  let maxDecimals: number | null = null
  try {
    const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(state.selectedCoin)
    maxDecimals = assetInfo.pxDecimals
  } catch (error) {
    console.error('Error getting price precision for take profit price:', error)
    maxDecimals = 4
  }

  if (!isValidDecimalInsertion(numericValue, state.takeProfitPrice || '', maxDecimals)) {
    moveCursorToEnd(inputEl)
    return
  }

  const parts = numericValue.split('.')
  if (parts.length > 2) {
    moveCursorToEnd(inputEl)
    return
  }

  // Limit decimal places according to price precision
  if (parts.length === 2 && maxDecimals !== null) {
    const decimalPart = parts[1]
    if (decimalPart.length > maxDecimals) {
      parts[1] = decimalPart.substring(0, maxDecimals)
      numericValue = parts.join('.')
    }
  }

  const enforcedValue = enforceMaxDigits(numericValue, state.takeProfitPrice || '', inputEl)
  if (enforcedValue === null) {
    return
  }

  markFieldAsTouched('takeProfitPrice')
  setState(prev => ({ ...prev, takeProfitPrice: enforcedValue }))
}



  const handleTakeProfitPriceBlur = () => {
    // Format price according to Hyperliquid precision requirements when user finishes editing
    if (state.takeProfitPrice && !isNaN(parseFloat(state.takeProfitPrice))) {
      const price = parseFloat(state.takeProfitPrice)
      
      // Check if the price is valid according to Hyperliquid rules
      if (!validateHyperliquidPriceSync(price, state.selectedCoin)) {
        // Don't format if it's invalid - let user see the warning
        return
      }
      
      try {
        const formattedPrice = formatHyperliquidPriceSync(price, state.selectedCoin)
        setState(prev => ({ ...prev, takeProfitPrice: formattedPrice }))
      } catch (error) {
        console.error('Error formatting take profit price:', error)
        // Fallback to original formatting
        const formattedPrice = formatPriceForTickSize(price, state.selectedCoin)
        setState(prev => ({ ...prev, takeProfitPrice: formattedPrice }))
      }
    }
  }

  // Stop Loss Price handlers with pxDecimals formatting

  const handleStopLossPriceChange = (value: string, inputEl?: HTMLInputElement) => {
  const trimmedValue = value.trim()
  let numericValue = trimmedValue.replace(/[^0-9.]/g, '')
  numericValue = normalizeLeadingZeros(numericValue)

  // Get price precision for the selected coin
  let maxDecimals: number | null = null
  try {
    const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(state.selectedCoin)
    maxDecimals = assetInfo.pxDecimals
  } catch (error) {
    console.error('Error getting price precision for stop loss price:', error)
    maxDecimals = 4
  }

  if (!isValidDecimalInsertion(numericValue, state.stopLossPrice || '', maxDecimals)) {
    moveCursorToEnd(inputEl)
    return
  }

  const enforcedValue = enforceMaxDigits(numericValue, state.stopLossPrice || '', inputEl)
  if (enforcedValue === null) {
    return
  }

  // Apply price precision limits
  const parts = enforcedValue.split('.')
  if (parts.length > 2) {
    moveCursorToEnd(inputEl)
    return
  }

  // Limit decimal places according to price precision
  if (parts.length === 2 && maxDecimals !== null) {
    const decimalPart = parts[1]
    if (decimalPart.length > maxDecimals) {
      parts[1] = decimalPart.substring(0, maxDecimals)
      numericValue = parts.join('.')
    }
  }

  markFieldAsTouched('stopLossPrice')
  setState(prev => ({ ...prev, stopLossPrice: enforcedValue }))
}



  const handleStopLossPriceBlur = () => {
    // Format price according to Hyperliquid precision requirements when user finishes editing
    if (state.stopLossPrice && !isNaN(parseFloat(state.stopLossPrice))) {
      const price = parseFloat(state.stopLossPrice)
      
      // Check if the price is valid according to Hyperliquid rules
      if (!validateHyperliquidPriceSync(price, state.selectedCoin)) {
        // Don't format if it's invalid - let user see the warning
        return
      }
      
      try {
        const formattedPrice = formatHyperliquidPriceSync(price, state.selectedCoin)
        setState(prev => ({ ...prev, stopLossPrice: formattedPrice }))
      } catch (error) {
        console.error('Error formatting stop loss price:', error)
        // Fallback to original formatting
        const formattedPrice = formatPriceForTickSize(price, state.selectedCoin)
        setState(prev => ({ ...prev, stopLossPrice: formattedPrice }))
      }
    }
  }

  const handleCoinChange = async (coin: string) => {
    markFieldAsTouched('selectedCoin')
    
    // Clear all price and size related inputs when switching coins
    setState(prev => ({ 
      ...prev, 
      selectedCoin: coin,
      // Clear size and price inputs
      size: '',
      limitPrice: '',
      scaleStartPrice: '',
      scaleEndPrice: '',
      takeProfitPrice: '',
      stopLossPrice: '',
      // Reset size unit to coin unit (not USD)
      sizeUnit: coin.replace('-PERP', ''),
      // Clear touched fields for price/size inputs
      limitPriceManuallySet: false
    }))
    
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
            // Has position for this coin - use the leverage from position
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
          } else {
            // No position for this coin - set leverage to maximum available
            try {
              const coinName = coin.replace('-PERP', '')
              const leverageData = await leverageService.getLeverageInfo(coinName)
              const maxLeverage = leverageData.maxLeverage
              
              setState(prev => ({ ...prev, leverage: maxLeverage }))
              console.log(`📊 No position for ${coin}, setting leverage to max: ${maxLeverage}x`)
            } catch (leverageError) {
              console.error('Failed to get max leverage for coin:', leverageError)
              // Keep current leverage as fallback
            }
          }
        } else {
          // No clearinghouse state available - set leverage to maximum available
          try {
            const coinName = coin.replace('-PERP', '')
            const leverageData = await leverageService.getLeverageInfo(coinName)
            const maxLeverage = leverageData.maxLeverage
            
            setState(prev => ({ ...prev, leverage: maxLeverage }))
            console.log(`📊 No clearinghouse state, setting leverage to max: ${maxLeverage}x`)
          } catch (leverageError) {
            console.error('Failed to get max leverage for coin:', leverageError)
            // Keep current leverage as fallback
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
      ? formatHyperliquidSizeSync(coinSize, state.selectedCoin)
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
          const liquidationPrice = calculateLiquidationPriceLegacy(
            entryPrice, 
            state.leverage, 
            state.side, 
            state.selectedCoin, 
            state.marginMode, 
            parseFloat(accountInfo.availableToTrade || '0'),
            0, // position size - will be calculated
            parseFloat(accountInfo.availableToTrade || '0') + parseFloat(accountInfo.marginRequired || '0'), // account value
            state.marginMode === 'isolated' ? parseFloat(accountInfo.availableToTrade || '0') : 0 // isolated margin
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
    // Clear existing timeout if user is still adjusting
    if (leverageUpdateTimeout) {
      clearTimeout(leverageUpdateTimeout)
    }
    
    // Update local state immediately for UI responsiveness
    setState(prev => ({ ...prev, leverage }))
    
    // Set up delayed API call
    const timeout = setTimeout(async () => {
    try {
      await updateLeverage(leverage)
      toast.success(`Leverage updated to ${leverage}x`)
    } catch (err) {
      console.error('Failed to update leverage:', err)
        
        // Revert to previous leverage on error
        setState(prev => ({ ...prev, leverage: prev.leverage }))
        
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
    }, 2000) // 2 second delay
    
    setLeverageUpdateTimeout(timeout)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (leverageUpdateTimeout) {
        clearTimeout(leverageUpdateTimeout)
      }
    }
  }, [leverageUpdateTimeout])

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
      <div className="mb-1">
        <div className="relative">
          {/* Clickable header to toggle dropdown */}
          <div 
            className="w-full p-4 bg-gray-800 rounded-lg border border-gray-600 hover:border-teal-primary focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
            onClick={() => !isLoading && setIsCoinDropdownOpen(!isCoinDropdownOpen)}
          >
            {/* Left side - Selected coin info */}
            <div className="flex items-center gap-3">
              <span className="text-white font-medium">
                {state.selectedCoin || 'Select Coin'}
              </span>
              {leverageInfo && (
                <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                  {maxLeverage}x
                </span>
              )}
            </div>
            
            {/* Right side - Price and chevron */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Price:</span>
              <span className="text-lg font-semibold text-white">
                {priceError ? (
                  <span className="text-red-400">{priceError}</span>
                ) : currentPrice ? (
                  (() => {
                    try {
                      const formattedPrice = formatHyperliquidPriceSync(currentPrice, state.selectedCoin)
                      return `$${formattedPrice}`
                    } catch (error) {
                      console.error('Error formatting current price:', error)
                      return `$${currentPrice.toLocaleString()}`
                    }
                  })()
                ) : priceConnected ? (
                  <span className="text-gray-400">Loading...</span>
                ) : (
                  <span className="text-gray-400">Connecting...</span>
                )}
              </span>
              <ChevronDown 
                size={20} 
                className={`text-gray-400 transition-transform ${isCoinDropdownOpen ? 'rotate-180' : ''}`} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Coin Selection Table - Floating dropdown */}
      {isCoinDropdownOpen && (
        <>
          {/* Background overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/20" 
            onClick={() => setIsCoinDropdownOpen(false)}
          />
          
          {/* Floating dropdown */}
          <div className="relative mb-4 coin-dropdown-container">
            <div className="absolute left-0 right-0 z-50 bg-gray-800 rounded-lg border border-gray-600 overflow-hidden shadow-2xl transform transition-all duration-200 ease-out">
            {/* Table Header */}
            <div className="grid grid-cols-2 gap-4 px-4 py-3 bg-gray-700 border-b border-gray-600">
              <div className="text-sm font-medium text-gray-300">Symbol</div>
              <div className="text-sm font-medium text-gray-300 text-right">Last Price</div>
            </div>
            
            {/* Table Rows - Scrollable container */}
            <div className="max-h-64 overflow-y-auto coin-dropdown-scroll">
              {topCoins.map((coin: TopCoin) => {
              const coinKey = coin.symbol.toUpperCase()
              let coinPrice = priceMap && priceMap[coinKey] ? (
                typeof priceMap[coinKey] === 'object' && priceMap[coinKey] !== null && 'price' in priceMap[coinKey]
                  ? parseFloat(priceMap[coinKey].price.toString())
                  : parseFloat(String(priceMap[coinKey]))
              ) : null
              
              if (!coinPrice && typeof coin.markPrice === 'number' && !isNaN(coin.markPrice)) {
                coinPrice = coin.markPrice
              } else if (!coinPrice && typeof coin.midPrice === 'number' && !isNaN(coin.midPrice)) {
                coinPrice = coin.midPrice
              }
              
              // Get max leverage for this coin
              const coinMaxLeverage = leverageInfo && coin.symbol === state.selectedCoin 
                ? maxLeverage 
                : coin.maxLeverage
              
              return (
                <div 
                  key={coin.symbol}
                  className={`grid grid-cols-2 gap-4 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-700 ${
                    state.selectedCoin === coin.symbol ? 'bg-teal-900/20 border-l-4 border-teal-500' : ''
                  }`}
                  onClick={() => {
                    handleCoinChange(coin.symbol)
                    setIsCoinDropdownOpen(false) // Close dropdown after selection
                  }}
                >
                  {/* Symbol Column */}
                  <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{coin.symbol}</span>
                    <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">
                      {coinMaxLeverage}x
                    </span>
                    </div>
                    {coin.dayNotionalVolume ? (
                      <span className="text-xs text-gray-400">24h Vol {formatNotionalVolume(coin.dayNotionalVolume)}</span>
                    ) : null}
                  </div>
                  
                  {/* Last Price Column */}
                  <div className="text-white text-right">
                    {coinPrice ? (
                      (() => {
                        try {
                          const formattedPrice = formatHyperliquidPriceSync(coinPrice, coin.symbol)
                          return `$${formattedPrice}`
                        } catch (error) {
                          return `$${coinPrice.toLocaleString()}`
                        }
                      })()
                    ) : (
                      <span className="text-gray-400">Loading...</span>
                    )}
                  </div>
                </div>
              )
            })}
            </div>
            </div>
          </div>
        </>
      )}

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
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 font-medium min-w-[24px]">1x</span>
           <input
             type="range"
             min="1"
             max={Math.min(maxLeverage, availableLeverage)}
            value={state.leverage}
            onChange={(e) => handleLeverageChange(parseInt(e.target.value))}
            disabled={isLoading}
             className="flex-1 h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
             style={{
               background: `linear-gradient(to right, #14b8a6 0%, #14b8a6 ${((state.leverage - 1) / (Math.min(maxLeverage, availableLeverage) - 1)) * 100}%, #374151 ${((state.leverage - 1) / (Math.min(maxLeverage, availableLeverage) - 1)) * 100}%, #374151 100%)`
             }}
           />
           <span className="text-xs text-gray-400 font-medium min-w-[32px]">
             {Math.min(maxLeverage, availableLeverage)}x
           </span>
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
              // Prefill limit price with current market price (formatted)
              limitPrice: typeof topCardPrice === 'number' ? formatPriceForTickSize(topCardPrice, prev.selectedCoin) : prev.limitPrice
            }))
          }}
        >
          Limit
        </button>
        <div className="flex-1 order-type-dropdown-container relative">
          {/* Clickable header to toggle order type dropdown */}
          <div 
            className={`w-full px-3 py-2 rounded text-sm font-medium border focus:border-teal-primary focus:outline-none cursor-pointer flex items-center justify-between ${
                state.orderType === 'scale' || state.orderType === 'twap'
                  ? 'bg-white text-black underline'
                  : 'bg-transparent text-gray-400 hover:text-white border-gray-600'
              }`}
            onClick={() => setIsOrderTypeDropdownOpen(!isOrderTypeDropdownOpen)}
          >
            <span>
              {state.orderType === 'scale' ? 'Scale' : 
               state.orderType === 'twap' ? 'TWAP' : 'Pro'}
            </span>
            <ChevronDown 
              size={12} 
              className={`text-gray-400 transition-transform ${isOrderTypeDropdownOpen ? 'rotate-180' : ''}`} 
            />
          </div>

          {/* Order Type Dropdown - Floating dropdown */}
          {isOrderTypeDropdownOpen && (
            <>
              {/* Background overlay */}
              <div
                className="fixed inset-0 bg-black bg-opacity-20 z-40"
                onClick={() => setIsOrderTypeDropdownOpen(false)}
              />
              
              {/* Dropdown content */}
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-2xl z-50 overflow-hidden">
                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                  {/* Scale Option */}
                  <div
                    className={`px-4 py-3 cursor-pointer transition-colors hover:bg-gray-700 ${
                      state.orderType === 'scale' ? 'bg-teal-900/20 border-l-4 border-teal-500' : ''
                    }`}
                    onClick={() => {
                      setState(prev => ({ ...prev, orderType: 'scale' }))
                      setIsOrderTypeDropdownOpen(false)
                    }}
                  >
                    <span className="text-white font-medium">Scale</span>
                  </div>
                  
                  {/* TWAP Option */}
                  <div
                    className={`px-4 py-3 cursor-pointer transition-colors hover:bg-gray-700 ${
                      state.orderType === 'twap' ? 'bg-teal-900/20 border-l-4 border-teal-500' : ''
                    }`}
                    onClick={() => {
                      setState(prev => ({ ...prev, orderType: 'twap' }))
                      setIsOrderTypeDropdownOpen(false)
                    }}
                  >
                    <span className="text-white font-medium">TWAP</span>
                  </div>
                </div>
              </div>
            </>
          )}
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
            placeholder={getSizeInputRestrictions().placeholder}
            value={state.size}
            onChange={(e) => handleSizeChange(e.target.value, e.currentTarget)}
            onKeyDown={(e) => {
              // Prevent typing characters that would exceed decimal limits
              const restrictions = getSizeInputRestrictions()
              
              // For szDecimals = 0, prevent decimal point entirely
              if (restrictions.szDecimals === 0 && e.key === '.') {
                e.preventDefault()
                return
              }
              
              // For szDecimals > 0 (including USD with 2 decimals), prevent typing beyond the limit
              if (restrictions.szDecimals !== null && restrictions.szDecimals > 0) {
                const currentValue = e.currentTarget.value
                const cursorPosition = e.currentTarget.selectionStart || 0
                const decimalIndex = currentValue.indexOf('.')
                
                // If there's a decimal point and cursor is after it
                if (decimalIndex !== -1 && cursorPosition > decimalIndex) {
                  const decimalPlaces = cursorPosition - decimalIndex - 1
                  if (decimalPlaces >= restrictions.szDecimals) {
                    // Prevent typing if we're at the limit
                    if (e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                      e.preventDefault()
                    }
                  }
                }
              }
            }}
            title={getSizeInputRestrictions().title}
            className="flex-1 px-3 py-2 bg-dark-border border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-teal-primary"
          />
          <select
            value={state.sizeUnit}
            onChange={(e) => {
              const newUnit = e.target.value as 'USD' | string
              const currentSize = parseFloat(state.size)
              
              // If switching from USD to coin unit, convert USD to coin size
              if (state.sizeUnit === 'USD' && newUnit !== 'USD' && !isNaN(currentSize) && currentSize > 0) {
                try {
                  // Get current coin price
                  const coinPrice = currentPrice || topCardPrice
                  if (coinPrice && coinPrice > 0) {
                    // Convert USD to coin size: size = usd / coin-price
                    const convertedSize = currentSize / coinPrice
                    
                    // Get the target coin's szDecimals for rounding
                    const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(state.selectedCoin)
                    const szDecimals = assetInfo.szDecimals
                    
                    console.log(`🔄 Size conversion for ${state.selectedCoin}:`, {
                      originalSize: currentSize,
                      coinPrice,
                      convertedSize,
                      szDecimals,
                      assetInfo
                    })
                    
                    // Round DOWN according to coin size decimal
                    let roundedSize: number
                    if (szDecimals === 0) {
                      // For DOGE (szDecimals = 0), round DOWN to nearest integer
                      roundedSize = Math.floor(convertedSize)
                    } else {
                      // For other coins, round DOWN to szDecimals
                      const multiplier = Math.pow(10, szDecimals)
                      roundedSize = Math.floor(convertedSize * multiplier) / multiplier
                    }
                    
                    // Check if rounded size is valid (not zero or negative)
                    if (roundedSize > 0) {
                      // Format the size according to szDecimals
                      const formattedSize = szDecimals === 0 
                        ? roundedSize.toString()
                        : roundedSize.toFixed(szDecimals)
                      
                      setState(prev => ({ ...prev, sizeUnit: newUnit, size: formattedSize }))
                      return
                    } else {
                      // If converted size is too small (like 0.8 for DOGE), clear the input
                      setState(prev => ({ ...prev, sizeUnit: newUnit, size: '' }))
                      return
                    }
                  } else {
                    // No price available, clear the input
                    setState(prev => ({ ...prev, sizeUnit: newUnit, size: '' }))
                    return
                  }
                } catch (error) {
                  console.warn('Could not convert USD to coin size:', error)
                  setState(prev => ({ ...prev, sizeUnit: newUnit, size: '' }))
                  return
                }
              }
              
              // If switching from coin unit to USD, convert coin size to USD
              if (state.sizeUnit !== 'USD' && newUnit === 'USD' && !isNaN(currentSize) && currentSize > 0) {
                try {
                  // Get current coin price
                  const coinPrice = currentPrice || topCardPrice
                  if (coinPrice && coinPrice > 0) {
                    // Convert coin size to USD: usd = size * coin-price
                    const convertedUSD = currentSize * coinPrice
                    
                    // Round DOWN to 2 decimal places for USD
                    const roundedUSD = Math.floor(convertedUSD * 100) / 100
                    
                    // Check if converted USD is valid (not zero or negative)
                    if (roundedUSD > 0) {
                      // Format to 2 decimal places
                      const formattedUSD = roundedUSD.toFixed(2)
                      
                      setState(prev => ({ ...prev, sizeUnit: newUnit, size: formattedUSD }))
                      return
                    } else {
                      // If converted USD is too small, clear the input
                      setState(prev => ({ ...prev, sizeUnit: newUnit, size: '' }))
                      return
                    }
                  } else {
                    // No price available, clear the input
                    setState(prev => ({ ...prev, sizeUnit: newUnit, size: '' }))
                    return
                  }
                } catch (error) {
                  console.warn('Could not convert coin size to USD:', error)
                  setState(prev => ({ ...prev, sizeUnit: newUnit, size: '' }))
                  return
                }
              }
              
              setState(prev => ({ ...prev, sizeUnit: newUnit }))
            }}
            className="px-3 py-2 bg-dark-border border border-gray-600 rounded text-white focus:outline-none focus:border-teal-primary"
          >
            <option value="USD">USD</option>
            <option value={state.selectedCoin}>{state.selectedCoin?.replace('-PERP', '')}</option>
          </select>
        </div>

        {/* Coin Size Display - always reserve space but only show when USD is selected */}
        <div className="mb-2 text-sm text-gray-400" style={{ minHeight: '20px' }}>
        {state.sizeUnit === 'USD' && state.size && topCardPrice && (
            <>
            <span>Coin Size: </span>
            <span className="text-white">
              {(() => {
                const coinSize = convertUsdToCoinSize(parseFloat(state.size), topCardPrice, state.selectedCoin)
                
                // Use Hyperliquid precision formatting
                try {
                  const formattedSize = formatHyperliquidSizeSync(coinSize, state.selectedCoin)
                  return `${formattedSize} ${state.selectedCoin}`
                } catch (error) {
                  console.error('Error formatting coin size display:', error)
                  // Fallback to Hyperliquid precision formatting
                  const fallbackFormattedSize = formatHyperliquidSizeSync(coinSize, state.selectedCoin)
                  return `${fallbackFormattedSize} ${state.selectedCoin}`
                }
              })()}
            </span>
            </>
        )}
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
                onChange={(e) => handleLimitPriceChange(e.target.value, e.currentTarget)}
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
                    console.log(`🔄 Mid button clicked - updated limit price to: ${formattedPrice}`)
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
                onChange={(e) => handleScaleStartPriceChange(e.target.value, e.currentTarget)}
                onBlur={handleScaleStartPriceBlur}
                onKeyDown={(e) => {
                  // Prevent invalid decimal inputs based on pxDecimals
                  try {
                    const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(state.selectedCoin)
                    const pxDecimals = assetInfo.pxDecimals
                    const currentValue = e.currentTarget.value
                    const cursorPosition = e.currentTarget.selectionStart || 0
                    const decimalIndex = currentValue.indexOf('.')
                    
                    if (decimalIndex !== -1 && cursorPosition > decimalIndex) {
                      const decimalPlaces = cursorPosition - decimalIndex - 1
                      if (decimalPlaces >= pxDecimals) {
                        if (e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                          e.preventDefault()
                        }
                      }
                    }
                  } catch (error) {
                    console.warn('Could not get pxDecimals for keydown prevention:', error)
                  }
                }}
                  className="w-32 px-3 py-2 bg-dark-border border border-gray-600 rounded text-white text-right focus:outline-none focus:border-teal-primary"
                  placeholder="0"
              />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">End (USD)</span>
              <input
                type="text"
                value={state.scaleEndPrice}
                onChange={(e) => handleScaleEndPriceChange(e.target.value, e.currentTarget)}
                onBlur={handleScaleEndPriceBlur}
                onKeyDown={(e) => {
                  // Prevent invalid decimal inputs based on pxDecimals
                  try {
                    const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(state.selectedCoin)
                    const pxDecimals = assetInfo.pxDecimals
                    const currentValue = e.currentTarget.value
                    const cursorPosition = e.currentTarget.selectionStart || 0
                    const decimalIndex = currentValue.indexOf('.')
                    
                    if (decimalIndex !== -1 && cursorPosition > decimalIndex) {
                      const decimalPlaces = cursorPosition - decimalIndex - 1
                      if (decimalPlaces >= pxDecimals) {
                        if (e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                          e.preventDefault()
                        }
                      }
                    }
                  } catch (error) {
                    console.warn('Could not get pxDecimals for keydown prevention:', error)
                  }
                }}
                  className="w-32 px-3 py-2 bg-dark-border border border-gray-600 rounded text-white text-right focus:outline-none focus:border-teal-primary"
                  placeholder="0"
              />
            </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Total Orders</span>
              <input
                type="text"
                  value={state.scaleOrderCount}
                  onChange={(e) => handleScaleOrderCountChange(e.target.value, e.currentTarget)}
                  className="w-32 px-3 py-2 bg-dark-border border border-gray-600 rounded text-white text-right focus:outline-none focus:border-teal-primary"
                  placeholder="10"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Size Skew</span>
              <input
                type="text"
                  value={state.scaleSizeSkew}
                  onChange={(e) => handleSizeSkewChange(e.target.value, e.currentTarget)}
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
                      const rawPrice = startPrice + (priceStep * i)
                      
                      // Validate price before formatting
                      if (isNaN(rawPrice) || !isFinite(rawPrice) || rawPrice <= 0) {
                        orders.push(
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-gray-300">Order {i + 1}:</span>
                            <span className="text-red-400">Invalid price</span>
                          </div>
                        )
                        continue
                      }
                      
                      const price = formatHyperliquidPriceSync(rawPrice, state.selectedCoin)
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
                      
                      // Use Hyperliquid precision formatting
                      const formattedSize = formatHyperliquidSizeSync(rawSize, state.selectedCoin)
                      
                      orders.push(
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-gray-300">Order {i + 1}:</span>
                          <span className="text-white">${price} × {formattedSize}</span>
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
                    onChange={(e) => handleTwapNumericChange('twapRunningTimeHours', e.target.value, e.currentTarget)}
                    onKeyDown={(e) => {
                      // Prevent typing if already at 12 digits
                      if (e.currentTarget.value.length >= 12 && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                        e.preventDefault()
                      }
                    }}
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
                    onChange={(e) => handleTwapNumericChange('twapRunningTimeMinutes', e.target.value, e.currentTarget)}
                    onKeyDown={(e) => {
                      // Prevent typing if already at 12 digits
                      if (e.currentTarget.value.length >= 12 && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
                        e.preventDefault()
                      }
                    }}
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
                              
                              // Format with appropriate decimal places using hyperliquidPrecisionConfig
                              const assetInfo = HyperliquidPrecision.getDefaultAssetInfo(state.selectedCoin)
                              const decimalPlaces = assetInfo.szDecimals
                              
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
                    (() => {
                      try {
                        const formattedPrice = formatHyperliquidPriceSync(topCardPrice, state.selectedCoin)
                        return `$${formattedPrice}`
                      } catch (error) {
                        console.error('Error formatting market price:', error)
                        return `$${topCardPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}`
                      }
                    })()
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
                    onChange={(e) => handleTakeProfitPriceChange(e.target.value, e.currentTarget)}
                    onBlur={handleTakeProfitPriceBlur}
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
                    onChange={(e) => handleTPSLChange('takeProfitGain', e.target.value, e.currentTarget)}
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
                    onChange={(e) => handleStopLossPriceChange(e.target.value, e.currentTarget)}
                    onBlur={handleStopLossPriceBlur}
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
                    onChange={(e) => handleTPSLChange('stopLossLoss', e.target.value, e.currentTarget)}
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
        disabled={!isInitialized || isLoading || hasZeroOrInvalidSize() || hasInsufficientCoinSize() || validationErrors.length > 0 || hasInsufficientBalance() ||
          (state.orderType === 'scale' && (!state.scaleStartPrice || !state.scaleEndPrice || !state.scaleOrderCount || !state.scaleSizeSkew)) ||
          (state.orderType === 'twap' && (!state.twapRunningTimeHours || !state.twapRunningTimeMinutes || !state.twapNumberOfIntervals))}
        className="w-full py-3 bg-teal-primary hover:bg-teal-hover disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded mb-6 transition-colors"
      >
        {isLoading ? 'Processing...' : 
         hasInsufficientBalance() ? 'Not Enough Margin' :
         state.orderType === 'scale' ? 'Place Scale Orders' :
         state.orderType === 'twap' ? 'Place TWAP Order' :
         'Place Order'}
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
                  
                  // Use Hyperliquid precision formatting
                  const formattedSize = formatHyperliquidSizeSync(rawSize, state.selectedCoin)
                  
                  const formattedStartPrice = formatHyperliquidPriceSync(startPrice, state.selectedCoin)
                  return `${formattedSize} ${state.sizeUnit} @ $${formattedStartPrice}`
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
                  
                  // Use Hyperliquid precision formatting
                  const formattedSize = formatHyperliquidSizeSync(rawSize, state.selectedCoin)
                  
                  const formattedEndPrice = formatHyperliquidPriceSync(endPrice, state.selectedCoin)
                  return `${formattedSize} ${state.sizeUnit} @ $${formattedEndPrice}`
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
                    
                    // Use Hyperliquid precision formatting
                    const formattedSize = formatHyperliquidSizeSync(rawSize, state.selectedCoin)
                    const sizeValue = parseFloat(formattedSize)
                    
                    totalValue += sizeValue * price
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
                    
                    // Use Hyperliquid precision formatting
                    const formattedSize = formatHyperliquidSizeSync(rawSize, state.selectedCoin)
                    const sizeValue = parseFloat(formattedSize)
                    
                    totalValue += sizeValue * price
                  }
                  
                  const margin = totalValue / state.leverage
                  return `$${margin.toFixed(2)}`
                })()}
              </span>
            </div>
            {/* <div className="flex justify-between">
              <span className="text-gray-400">Fees:</span>
              <span className="text-white">0.0450% / 0.0150%</span>
            </div> */}
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
                
                    const liquidationPrice = calculateLiquidationPriceLegacy(
                      entryPrice, 
                      leverage, 
                      state.side, 
                      state.selectedCoin, 
                      state.marginMode, 
                      parseFloat(accountInfo.availableToTrade || '0'),
                      0, // position size - will be calculated
                      parseFloat(accountInfo.availableToTrade || '0') + parseFloat(accountInfo.marginRequired || '0'), // account value
                      state.marginMode === 'isolated' ? parseFloat(accountInfo.availableToTrade || '0') : 0 // isolated margin
                    )
                    
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
            {/* <div className="flex justify-between">
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
            </div> */}
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
