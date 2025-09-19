// Simple Hyperliquid Server using @nktkas/hyperliquid SDK
// Following the official documentation examples

import express from 'express'
import cors from 'cors'
import * as hl from '@nktkas/hyperliquid'
import { ethers } from 'ethers'

const app = express()
const PORT = 3001

// Middleware
app.use(cors())
app.use(express.json())

// Configuration
const CONFIG = {
  PRIVATE_KEY: process.env.PRIVATE_KEY || "0xa2c19b64f80a057ee25d39ad2ea4af26147e7cf9293e130254e9a5eba459182f",
  USE_TESTNET: process.env.USE_TESTNET !== 'false', // Default to true
  DEFAULT_COIN: "BTC-PERP"
}

// Initialize Hyperliquid SDK clients
let exchangeClient = null
let infoClient = null

// Realtime price streaming state
let latestPrices = {}
const priceStreamClients = new Set()
let pricePollInterval = null
let isFetchingPrices = false

// TWAP task management
const twapTasks = new Map()
let twapTaskCounter = 0

const getNetworkName = () => (CONFIG.USE_TESTNET ? 'testnet' : 'mainnet')

const broadcastPrices = (prices = latestPrices) => {
  if (!prices || Object.keys(prices).length === 0) {
    return
  }

  const payload = {
    type: 'priceUpdate',
    prices,
    network: getNetworkName(),
    timestamp: Date.now()
  }

  const data = `data: ${JSON.stringify(payload)}\n\n`

  for (const client of priceStreamClients) {
    try {
      client.write(data)
    } catch (error) {
      console.log('Error broadcasting to client:', error.message)
      priceStreamClients.delete(client)
    }
  }
}

const fetchPrices = async () => {
  if (isFetchingPrices || !infoClient) return
  
  isFetchingPrices = true
  try {
    // Get both mids (prices) and meta (asset names)
    const [mids, meta] = await Promise.all([
      infoClient.allMids(),
      infoClient.meta()
    ])
    
    const prices = {}
    
    if (mids && meta && meta.universe) {
      // Create a mapping from asset ID to asset name
      const assetIdToName = {}
      meta.universe.forEach(asset => {
        if (asset.name) {
          // Find the asset ID for this name
          const assetId = getAssetId(`${asset.name}-PERP`)
          assetIdToName[assetId] = asset.name
        }
      })
      
      // Map prices using asset names with -PERP suffix
      Object.keys(mids).forEach(assetId => {
        const assetName = assetIdToName[parseInt(assetId)] || assetId
        if (assetName) {
          // Add -PERP suffix for frontend compatibility
          const assetKey = assetName.includes('-PERP') ? assetName : `${assetName}-PERP`
          prices[assetKey] = {
            price: mids[assetId],
            timestamp: Date.now()
          }
        }
      })
      
      latestPrices = prices
      broadcastPrices(prices)
    }
  } catch (error) {
    console.error('Error fetching prices:', error)
  } finally {
    isFetchingPrices = false
  }
}

// Initialize SDK following the documentation examples
const initializeSDK = async () => {
  try {
    console.log(`🚀 Initializing Hyperliquid SDK for ${getNetworkName()}...`)
    
    // Create wallet from private key
    const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY)
    console.log(`📱 Wallet address: ${wallet.address}`)
    
    // Initialize InfoClient following the documentation
    infoClient = new hl.InfoClient({
      transport: new hl.HttpTransport({
        isTestnet: CONFIG.USE_TESTNET
      })
    })
    
    // Initialize ExchangeClient following the documentation
    exchangeClient = new hl.ExchangeClient({
      wallet: wallet,
      transport: new hl.HttpTransport({
        isTestnet: CONFIG.USE_TESTNET
      }),
      isTestnet: CONFIG.USE_TESTNET
    })
    
    console.log(`🔑 ExchangeClient wallet: ${exchangeClient.wallet.address}`)
    console.log(`🌐 ExchangeClient isTestnet: ${exchangeClient.isTestnet}`)
    
    // Test connection
    const meta = await infoClient.meta()
    console.log('✅ SDK initialized successfully!')
    console.log(`📊 Found ${meta.universe.length} assets`)
    
    // Start price polling only after successful initialization
    if (pricePollInterval) {
      clearInterval(pricePollInterval)
    }
    pricePollInterval = setInterval(fetchPrices, 2000) // Poll every 2 seconds
    await fetchPrices() // Initial fetch
    
  } catch (error) {
    console.error('❌ Failed to initialize SDK:', error)
    process.exit(1)
  }
}

// Initialize on startup
initializeSDK()

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    network: getNetworkName(),
    sdkInitialized: !!exchangeClient && !!infoClient,
    timestamp: Date.now()
  })
})

// Get meta data endpoint
app.get('/api/meta', async (req, res) => {
  try {
    if (!infoClient) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const meta = await infoClient.meta()
    res.json(meta)
  } catch (error) {
    console.error('❌ Meta data failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get current prices endpoint
app.get('/api/prices', async (req, res) => {
  try {
    if (!infoClient) {
      return res.status(503).json({ error: 'SDK not initialized' })
    }
    
    res.json({
      prices: latestPrices,
      network: getNetworkName(),
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('❌ Failed to fetch prices:', error)
    res.status(500).json({ error: error.message })
  }
})

// Price streaming endpoint
app.get('/api/price-stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  })

  priceStreamClients.add(res)

  req.on('close', () => {
    priceStreamClients.delete(res)
  })

  // Send initial data
  if (Object.keys(latestPrices).length > 0) {
    res.write(`data: ${JSON.stringify({
      type: 'priceUpdate',
      prices: latestPrices,
      network: getNetworkName(),
      timestamp: Date.now()
    })}\n\n`)
  }
})

// Get market data endpoint
app.get('/api/market-data', async (req, res) => {
  try {
    if (!infoClient) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const meta = await infoClient.meta()
    const prices = {}
    
    meta.universe.forEach(asset => {
      if (asset.name) {
        prices[asset.name] = {
          price: asset.markPrice,
          change24h: asset.change24h,
          volume24h: asset.volume24h,
          szDecimals: asset.szDecimals,
          pxDecimals: asset.pxDecimals
        }
      }
    })
    
    res.json({
      prices,
      network: getNetworkName(),
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('❌ Market data failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get account info endpoint
app.get('/api/account/:address', async (req, res) => {
  try {
    if (!infoClient) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const { address } = req.params
    const [clearinghouseState, spotClearinghouseState] = await Promise.all([
      infoClient.clearinghouseState({ user: address }),
      infoClient.spotClearinghouseState({ user: address })
    ])
    
    res.json({
      address,
      perpetuals: clearinghouseState,
      spot: spotClearinghouseState,
      network: getNetworkName()
    })
  } catch (error) {
    console.error('❌ Account info failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get clearinghouse state endpoint
app.get('/api/clearinghouse-state', async (req, res) => {
  try {
    if (!infoClient) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const address = req.query.address || exchangeClient?.wallet?.address
    if (!address) {
      return res.status(400).json({ error: 'Address required' })
    }
    
    const state = await infoClient.clearinghouseState({ user: address })
    res.json(state)
  } catch (error) {
    console.error('❌ Clearinghouse state failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get wallet balance endpoint
app.get('/api/wallet-balance', async (req, res) => {
  try {
    if (!infoClient) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const address = req.query.address || exchangeClient?.wallet?.address
    if (!address) {
      return res.status(400).json({ error: 'Address required' })
    }
    
    const state = await infoClient.clearinghouseState({ user: address })
    
    // Extract balance information
    const balance = {
      accountValue: state.marginSummary?.accountValue || '0',
      totalMarginUsed: state.marginSummary?.totalMarginUsed || '0',
      totalNtlPos: state.marginSummary?.totalNtlPos || '0',
      totalRawUsd: state.marginSummary?.totalRawUsd || '0',
      crossMarginSummary: state.marginSummary?.crossMarginSummary || null,
      crossMaintenanceMarginUsed: state.marginSummary?.crossMaintenanceMarginUsed || '0',
      crossMaintenanceMarginUsedRaw: state.marginSummary?.crossMaintenanceMarginUsedRaw || '0'
    }
    
    res.json(balance)
  } catch (error) {
    console.error('❌ Wallet balance failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// Place order endpoint
app.post('/api/place-order', async (req, res) => {
  try {
    if (!exchangeClient) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const orderData = req.body
    console.log('📝 Placing order:', JSON.stringify(orderData, null, 2))
    
    let orders = []
    let grouping = 'na'
    
    // Check if it's an array of orders (for TP/SL grouping)
    if (Array.isArray(orderData)) {
      orders = await Promise.all(orderData.map(async order => {
        // Handle IOC orders (market-like execution)
        let price = order.limit_px?.toString()
        if (!price || price === '0') {
          // Check if this is an IOC order (market-like)
          if (order.order_type?.limit?.tif === 'Ioc') {
            console.log(`🎯 Detected IOC order for ${order.coin}, fetching market price...`)
            const marketPrice = await getMarketPriceForIOC(order.coin, order.is_buy)
            if (marketPrice) {
              price = marketPrice
              console.log(`✅ Set IOC price for ${order.coin}: ${price}`)
            } else {
              // Fallback prices if we can't get market data
              const coinName = order.coin.replace('-PERP', '')
              if (coinName === 'DOGE') {
                price = order.is_buy ? '0.3' : '0.2' // Reasonable DOGE prices
              } else if (coinName === 'BTC') {
                price = order.is_buy ? '70000' : '60000' // Reasonable BTC prices
              } else {
                price = order.is_buy ? '100' : '0.01' // Default fallback
              }
            }
          } else {
            // For non-IOC orders without price, use fallback
            const coinName = order.coin.replace('-PERP', '')
            if (coinName === 'DOGE') {
              price = order.is_buy ? '0.3' : '0.2'
            } else if (coinName === 'BTC') {
              price = order.is_buy ? '70000' : '60000'
            } else {
              price = order.is_buy ? '100' : '0.01'
            }
          }
        }
        
        return {
          a: getAssetId(order.coin),
          b: order.is_buy,
          p: price,
          r: order.reduce_only || false,
          s: order.sz.toString(),
          t: order.order_type
        }
      }))
      
      // Check if we have trigger orders (TP/SL) and multiple orders
      const hasTriggerOrders = orderData.some(order => order.order_type?.trigger)
      grouping = hasTriggerOrders && orderData.length > 1 ? 'normalTpsl' : 'na'
    } else {
      // Single order
      let price = orderData.limit_px?.toString()
      if (!price || price === '0') {
        // Check if this is an IOC order (market-like)
        if (orderData.order_type?.limit?.tif === 'Ioc') {
          console.log(`🎯 Detected IOC order for ${orderData.coin}, fetching market price...`)
          const marketPrice = await getMarketPriceForIOC(orderData.coin, orderData.is_buy)
          if (marketPrice) {
            price = marketPrice
            console.log(`✅ Set IOC price for ${orderData.coin}: ${price}`)
          } else {
            // Fallback prices if we can't get market data
            const coinName = orderData.coin.replace('-PERP', '')
            if (coinName === 'DOGE') {
              price = orderData.is_buy ? '0.3' : '0.2'
            } else if (coinName === 'BTC') {
              price = orderData.is_buy ? '70000' : '60000'
            } else {
              price = orderData.is_buy ? '100' : '0.01'
            }
          }
        } else {
          // For non-IOC orders without price, use fallback
          const coinName = orderData.coin.replace('-PERP', '')
          if (coinName === 'DOGE') {
            price = orderData.is_buy ? '0.3' : '0.2'
          } else if (coinName === 'BTC') {
            price = orderData.is_buy ? '70000' : '60000'
          } else {
            price = orderData.is_buy ? '100' : '0.01'
          }
        }
      }
      
    const hyperliquidOrder = {
        a: getAssetId(orderData.coin),
        b: orderData.is_buy,
        p: price,
        r: orderData.reduce_only || false,
        s: orderData.sz.toString(),
        t: orderData.order_type
      }
      orders = [hyperliquidOrder]
    }
    
    console.log('🎯 Converted orders:', JSON.stringify(orders, null, 2))
    console.log('🎯 Grouping:', grouping)
    
    const result = await exchangeClient.order({
      orders: orders,
      grouping: grouping
    })
    
    console.log('✅ Order result:', JSON.stringify(result, null, 2))
    res.json(result)
  } catch (error) {
    console.error('❌ Order failed:', error)
    
    // Provide user-friendly error messages
    let userMessage = error.message
    if (error.message.includes('Order price cannot be more than 80% away from the reference price')) {
      userMessage = '订单价格偏离市场价格超过80%限制。请调整价格使其更接近当前市场价格。'
    } else if (error.message.includes('Order has invalid price')) {
      userMessage = '订单价格无效。请检查价格格式和精度。'
    } else if (error.message.includes('Order value too large')) {
      userMessage = '订单价值过大。请减少订单数量或价格。'
    } else if (error.message.includes('Insufficient balance')) {
      userMessage = '账户余额不足。请检查可用资金。'
    }
    
    res.status(500).json({ 
      error: userMessage,
      originalError: error.message,
      suggestion: error.message.includes('80% away') 
        ? '建议：调整订单价格使其更接近当前市场价格' 
        : '建议：检查订单参数和账户状态'
    })
  }
})

// Place TWAP order endpoint
app.post('/api/place-twap-order', async (req, res) => {
  try {
    if (!exchangeClient) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const { 
      coin, 
      is_buy, 
      totalSize, 
      intervals, 
      durationMinutes, 
      orderType = 'market',
      priceOffset = 0,
      reduceOnly = false 
    } = req.body
    
    console.log('🎯 Placing TWAP order:', JSON.stringify(req.body, null, 2))
    
    // Validate parameters
    if (!coin || is_buy === undefined || !totalSize || !intervals || !durationMinutes) {
      return res.status(400).json({ 
        error: 'Missing required parameters: coin, is_buy, totalSize, intervals, durationMinutes' 
      })
    }
    
    if (intervals < 2 || intervals > 100) {
      return res.status(400).json({ 
        error: 'Number of intervals must be between 2 and 100' 
      })
    }
    
    if (durationMinutes < 5 || durationMinutes > 1440) {
      return res.status(400).json({ 
        error: 'Duration must be between 5 minutes and 24 hours' 
      })
    }
    
    // Create TWAP task
    let task
    try {
      task = createTwapTask({
        coin,
        is_buy,
        totalSize,
        intervals,
        durationMinutes,
        orderType,
        priceOffset,
        reduceOnly
      })
    } catch (creationError) {
      console.error('❌ Failed to create TWAP task:', creationError.message)
      return res.status(400).json({
        error: creationError.message
      })
    }
    
    console.log(`📋 Created TWAP task: ${task.id}`)
    
    // Execute first order immediately
    try {
      await executeTwapOrder(task, 0)
      console.log(`✅ First TWAP order executed for task ${task.id}`)
    } catch (error) {
      console.error(`❌ First TWAP order failed for task ${task.id}:`, error.message)
      task.status = 'failed'
      task.failedAt = Date.now()
      
      return res.status(500).json({
        error: 'Failed to execute first TWAP order',
        taskId: task.id,
        details: error.message
      })
    }
    
    // Schedule remaining orders
    scheduleTwapOrders(task)
    
    const { sizePrecision, subOrderSizes, firstSubOrderSize } = getFormattedSubOrderSizes(task)

    res.json({
      success: true,
      taskId: task.id,
      message: 'TWAP order started successfully',
      task: {
        id: task.id,
        coin: task.coin,
        is_buy: task.is_buy,
        totalSize: task.totalSize,
        intervals: task.intervals,
        durationMinutes: task.durationMinutes,
        orderType: task.orderType,
        status: task.status,
        createdAt: task.createdAt,
        subOrderSize: firstSubOrderSize,
        subOrderSizes,
        sizePrecision,
        minOrderSize: task.minOrderSize
      }
    })
    
  } catch (error) {
    console.error('❌ TWAP order failed:', error)
    res.status(500).json({ 
      error: 'Failed to place TWAP order',
      details: error.message 
    })
  }
})

// Get TWAP task status endpoint
app.get('/api/twap-task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params
    
    const task = twapTasks.get(taskId)
    if (!task) {
      return res.status(404).json({ error: 'TWAP task not found' })
    }
    
    const { sizePrecision, subOrderSizes, firstSubOrderSize } = getFormattedSubOrderSizes(task)

    res.json({
      task: {
        id: task.id,
        coin: task.coin,
        is_buy: task.is_buy,
        totalSize: task.totalSize,
        intervals: task.intervals,
        durationMinutes: task.durationMinutes,
        orderType: task.orderType,
        priceOffset: task.priceOffset,
        reduceOnly: task.reduceOnly,
        status: task.status,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        completedOrders: task.completedOrders,
        failedOrders: task.failedOrders,
        results: task.results,
        subOrderSize: firstSubOrderSize,
        subOrderSizes,
        sizePrecision,
        minOrderSize: task.minOrderSize
      }
    })
    
  } catch (error) {
    console.error('❌ Get TWAP task failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// List all TWAP tasks endpoint
app.get('/api/twap-tasks', async (req, res) => {
  try {
    const tasks = Array.from(twapTasks.values()).map(task => {
      const { sizePrecision, subOrderSizes, firstSubOrderSize } = getFormattedSubOrderSizes(task)

      return {
        id: task.id,
        coin: task.coin,
        is_buy: task.is_buy,
        totalSize: task.totalSize,
        intervals: task.intervals,
        durationMinutes: task.durationMinutes,
        orderType: task.orderType,
        status: task.status,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
        completedOrders: task.completedOrders,
        failedOrders: task.failedOrders,
        subOrderSize: firstSubOrderSize,
        subOrderSizes,
        sizePrecision,
        minOrderSize: task.minOrderSize
      }
    })
    
    res.json({
      tasks,
      totalTasks: tasks.length,
      activeTasks: tasks.filter(t => t.status === 'active').length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length
    })
    
  } catch (error) {
    console.error('❌ List TWAP tasks failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// Cancel TWAP task endpoint
app.post('/api/cancel-twap-task/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params
    
    const task = twapTasks.get(taskId)
    if (!task) {
      return res.status(404).json({ error: 'TWAP task not found' })
    }
    
    if (task.status !== 'active') {
      return res.status(400).json({ error: 'Can only cancel active TWAP tasks' })
    }
    
    task.status = 'cancelled'
    task.cancelledAt = Date.now()
    
    console.log(`🛑 TWAP task ${taskId} cancelled`)
    
    res.json({
      success: true,
      message: 'TWAP task cancelled successfully',
      taskId: taskId
    })
    
  } catch (error) {
    console.error('❌ Cancel TWAP task failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get leverage status endpoint
app.get('/api/leverage-status/:address', async (req, res) => {
  try {
    const { address } = req.params
    
    if (!infoClient) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    console.log(`📊 Getting leverage status for ${address}`)
    
    const clearinghouseState = await infoClient.clearinghouseState({ user: address })
    
    if (!clearinghouseState) {
      return res.status(404).json({ error: 'Account not found' })
    }
    
    // Extract leverage information for each position
    const leverageStatus = {
      address,
      positions: [],
      summary: {
        totalPositions: 0,
        crossPositions: 0,
        isolatedPositions: 0,
        canSwitchMode: true
      }
    }
    
    if (clearinghouseState.assetPositions && clearinghouseState.assetPositions.length > 0) {
      leverageStatus.positions = clearinghouseState.assetPositions.map(pos => ({
        coin: pos.position.coin,
        coinKey: `${pos.position.coin}-PERP`,
        leverage: pos.position.leverage.value,
        leverageType: pos.position.leverage.type,
        positionSize: pos.position.szi,
        canSwitchMode: false, // Cannot switch with open position
        message: '有未平仓头寸，无法切换杠杆模式'
      }))
      
      leverageStatus.summary.totalPositions = leverageStatus.positions.length
      leverageStatus.summary.crossPositions = leverageStatus.positions.filter(p => p.leverageType === 'cross').length
      leverageStatus.summary.isolatedPositions = leverageStatus.positions.filter(p => p.leverageType === 'isolated').length
      leverageStatus.summary.canSwitchMode = false
      leverageStatus.summary.message = '账户有未平仓头寸，无法切换杠杆模式'
    } else {
      leverageStatus.summary.message = '账户无未平仓头寸，可以自由切换杠杆模式'
    }
    
    console.log('✅ Leverage status retrieved:', {
      address,
      positions: leverageStatus.positions.length,
      canSwitchMode: leverageStatus.summary.canSwitchMode
    })
    
    res.json(leverageStatus)
  } catch (error) {
    console.error('❌ Get leverage status failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// Update leverage endpoint
app.post('/api/update-leverage', async (req, res) => {
  try {
    if (!exchangeClient) {
      console.log('❌ Update leverage failed: SDK not initialized')
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const { coin, leverageMode, leverage } = req.body
    console.log('📊 Updating leverage:', {
      coin: coin || 'N/A',
      leverageMode: leverageMode || 'N/A',
      leverage: leverage || 'N/A',
      timestamp: new Date().toISOString()
    })
    
    // Validate required parameters
    if (!coin) {
      console.log('❌ Update leverage failed: Missing coin parameter')
      return res.status(400).json({ error: 'Missing coin parameter' })
    }
    
    if (!leverageMode) {
      console.log('❌ Update leverage failed: Missing leverageMode parameter')
      return res.status(400).json({ error: 'Missing leverageMode parameter' })
    }
    
    if (!leverage) {
      console.log('❌ Update leverage failed: Missing leverage parameter')
      return res.status(400).json({ error: 'Missing leverage parameter' })
    }
    
    // Validate leverage mode
    if (!['cross', 'isolated'].includes(leverageMode)) {
      console.log('❌ Update leverage failed: Invalid leverageMode:', leverageMode)
      return res.status(400).json({ error: 'Invalid leverageMode. Must be "cross" or "isolated"' })
    }
    
    // Validate leverage value
    const leverageNum = parseFloat(leverage)
    if (isNaN(leverageNum) || leverageNum <= 0) {
      console.log('❌ Update leverage failed: Invalid leverage value:', leverage)
      return res.status(400).json({ error: 'Invalid leverage value. Must be a positive number' })
    }
    
    console.log('✅ Calling SDK updateLeverage with validated parameters')
    const result = await exchangeClient.updateLeverage({
      asset: getAssetId(coin),
      leverage: leverageNum,
      isCross: leverageMode === 'cross'
    })
    
    console.log('✅ Leverage update successful:', {
      coin,
      leverageMode,
      leverage,
      result: result?.status || 'success',
      timestamp: new Date().toISOString()
    })
    
    res.json(result)
  } catch (error) {
    console.error('❌ Update leverage failed:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    })
    
    // Provide user-friendly error messages
    let userMessage = error.message
    if (error.message.includes('Cannot switch leverage type with open position')) {
      userMessage = '无法在有未平仓头寸时切换杠杆模式。请先平仓所有头寸，或保持当前杠杆模式只更新杠杆倍数。'
    } else if (error.message.includes('Failed to deserialize')) {
      userMessage = '参数格式错误，请检查币种名称和杠杆设置。'
    } else if (error.message.includes('Invalid leverage')) {
      userMessage = '杠杆倍数无效，请设置合理的杠杆值。'
    }
    
    res.status(500).json({ 
      error: userMessage,
      originalError: error.message,
      suggestion: error.message.includes('Cannot switch leverage type') 
        ? '建议：保持当前杠杆模式，只更新杠杆倍数' 
        : '建议：检查参数格式和账户状态'
    })
  }
})

// Update isolated margin endpoint
app.post('/api/update-margin', async (req, res) => {
  try {
    if (!exchangeClient) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const { coin, isBuy, ntli } = req.body
    const result = await exchangeClient.updateIsolatedMargin({
      asset: coin,
      isBuy: isBuy,
      ntli: ntli
    })
    res.json(result)
  } catch (error) {
    console.error('❌ Update margin failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// Cancel orders endpoint
app.post('/api/cancel-orders', async (req, res) => {
  try {
    if (!exchangeClient) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const { coin, orderIds } = req.body
    console.log(`🗑️ Canceling orders for ${coin}:`, orderIds)
    
    const cancels = orderIds.map(oid => ({
      a: getAssetId(coin),
      o: oid
    }))
    
    const result = await exchangeClient.cancel({
      cancels
    })
    
    console.log('✅ Cancel result:', JSON.stringify(result, null, 2))
    res.json(result)
  } catch (error) {
    console.error('❌ Cancel failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get order history endpoint
app.get('/api/orders', async (req, res) => {
  try {
    if (!infoClient) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const address = req.query.address || exchangeClient?.wallet?.address
    if (!address) {
      return res.status(400).json({ error: 'Address required' })
    }
    
    console.log('📋 Getting order history for:', address)
    
    // Get order history
    let orders
    try {
      orders = await infoClient.openOrders({ user: address })
    } catch (e) {
      try {
        // Try alternative method
        const userState = await infoClient.clearinghouseState({ user: address })
        orders = {
          openOrders: userState.openOrders || [],
          assetPositions: userState.assetPositions || [],
          message: 'Retrieved from clearinghouse state'
        }
      } catch (e2) {
        orders = { error: 'Could not retrieve order information' }
      }
    }
    res.json(orders)
  } catch (error) {
    console.error('❌ Failed to get order history:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get block information endpoint
app.get('/api/block/:blockNumber', async (req, res) => {
  try {
    if (!infoClient) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const blockNumber = req.params.blockNumber
    console.log('📦 Getting block info for:', blockNumber)
    
    const blockInfo = await infoClient.blockDetails({ height: parseInt(blockNumber) })
    res.json(blockInfo)
  } catch (error) {
    console.error('❌ Failed to get block info:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get recent blocks endpoint
app.get('/api/blocks', async (req, res) => {
  try {
    if (!infoClient) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const limit = req.query.limit || 10
    console.log('📦 Getting recent blocks, limit:', limit)
    
    // Note: This might not be available in the new SDK
    res.json({ 
      message: 'Recent blocks endpoint not available in current SDK version',
      limit: parseInt(limit),
      network: getNetworkName()
    })
  } catch (error) {
    console.error('❌ Failed to get recent blocks:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get current block info endpoint
app.get('/api/current-block', async (req, res) => {
  try {
    if (!infoClient) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    console.log('📦 Getting current block info')
    
    const meta = await infoClient.meta()
    const blockInfo = {
      currentBlock: 'N/A', // Hyperliquid doesn't expose current block directly
      network: getNetworkName(),
      meta: meta,
      timestamp: new Date().toISOString()
    }
    
    res.json(blockInfo)
  } catch (error) {
    console.error('❌ Failed to get current block info:', error)
    res.status(500).json({ error: error.message })
  }
})

// Switch network endpoint
app.post('/api/switch-network', async (req, res) => {
  try {
    const { network } = req.body
    console.log('Switching network to:', network)
    if (network !== 'testnet' && network !== 'mainnet') {
      return res.status(400).json({ error: 'Invalid network. Use "testnet" or "mainnet"' })
    }
    
    // Update config
    CONFIG.USE_TESTNET = network === 'testnet'

    // Reinitialize SDK with new network
    if (pricePollInterval) {
      clearInterval(pricePollInterval)
      pricePollInterval = null
    }

    latestPrices = {}

    // Reinitialize clients
    const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY)
    
    infoClient = new hl.InfoClient({
      transport: new hl.HttpTransport({
        isTestnet: CONFIG.USE_TESTNET
      })
    })
    
    exchangeClient = new hl.ExchangeClient({
      wallet: wallet,
      transport: new hl.HttpTransport({
        isTestnet: CONFIG.USE_TESTNET
      }),
      isTestnet: CONFIG.USE_TESTNET
    })

    // Restart price polling
    pricePollInterval = setInterval(fetchPrices, 2000)
    await fetchPrices()

    console.log(`🔄 Switched to ${network}`)
    res.json({ 
      success: true, 
      network: network,
      message: `Successfully switched to ${network}`
    })
  } catch (error) {
    console.error('Failed to switch network:', error)
    res.status(500).json({ error: error.message })
  }
})

// Helper function to get current market price for IOC orders
const getMarketPriceForIOC = async (coinName, isBuy) => {
  try {
    // For now, use reasonable fallback prices for IOC orders
    // In production, you would fetch real-time market data
    const coin = coinName.replace('-PERP', '')
    
    // Reasonable prices for IOC orders (aggressive to guarantee execution)
    const priceMap = {
      'DOGE': { buy: '0.3', sell: '0.2' },    // DOGE around $0.25
      'BTC': { buy: '70000', sell: '60000' },  // BTC around $65k
      'ETH': { buy: '4000', sell: '3000' },    // ETH around $3.5k
      'SOL': { buy: '200', sell: '150' },      // SOL around $175
      'MATIC': { buy: '1.2', sell: '0.8' },   // MATIC around $1.0
      'AVAX': { buy: '50', sell: '35' },      // AVAX around $42
      'ATOM': { buy: '15', sell: '10' },      // ATOM around $12
      'APT': { buy: '20', sell: '15' },       // APT around $17
      'BNB': { buy: '700', sell: '500' },     // BNB around $600
    }
    
    const prices = priceMap[coin] || { buy: '100', sell: '0.01' }
    const price = isBuy ? prices.buy : prices.sell
    
    console.log(`🎯 IOC price for ${coin} ${isBuy ? 'buy' : 'sell'}: ${price}`)
    return price
  } catch (error) {
    console.error('Error getting market price for IOC:', error)
    return null
  }
}

// Helper function to get asset ID
const getAssetId = (coinName) => {
  // Asset ID mapping - this should be fetched from the API in production
  const assetMap = {
    'BTC-PERP': 3,    // Fixed: BTC is index 3, not 0
    'ETH-PERP': 1,
    'DOGE-PERP': 173,
    'SOL-PERP': 2,
    'AVAX-PERP': 7,   // Fixed: AVAX is index 7, not 3
    'MATIC-PERP': 4,
    'ARB-PERP': 5,
    'OP-PERP': 6,
    'SUI-PERP': 8,    // Fixed: SUI is index 8, not 7
    'APT-PERP': 9,    // Fixed: APT is index 9, not 8
    'NEAR-PERP': 10,  // Fixed: NEAR is index 10, not 9
    'ATOM-PERP': 11,  // Fixed: ATOM is index 11, not 10
    'DOT-PERP': 12,   // Fixed: DOT is index 12, not 11
    'LINK-PERP': 13,  // Fixed: LINK is index 13, not 12
    'UNI-PERP': 14,   // Fixed: UNI is index 14, not 13
    'AAVE-PERP': 15,  // Fixed: AAVE is index 15, not 14
    'CRV-PERP': 16,   // Fixed: CRV is index 16, not 15
    'MKR-PERP': 17,   // Fixed: MKR is index 17, not 16
    'COMP-PERP': 18,  // Fixed: COMP is index 18, not 17
    'YFI-PERP': 19,   // Fixed: YFI is index 19, not 18
    'SNX-PERP': 20,   // Fixed: SNX is index 20, not 19
    'SUSHI-PERP': 21  // Fixed: SUSHI is index 21, not 20
  }
  
  return assetMap[coinName] || 0 // Default to BTC if not found
}

// Helper function to format price for tick size
const formatPriceForTickSize = (price, coinName) => {
  const tickSizes = {
    'BTC-PERP': 0.5,
    'ETH-PERP': 0.05,
    'DOGE-PERP': 0.00001,
    'SOL-PERP': 0.01,
    'AVAX-PERP': 0.01,
    'MATIC-PERP': 0.0001,
    'ARB-PERP': 0.0001,
    'OP-PERP': 0.0001,
    'SUI-PERP': 0.0001,
    'APT-PERP': 0.0001,
    'NEAR-PERP': 0.0001,
    'ATOM-PERP': 0.0001,
    'DOT-PERP': 0.0001,
    'LINK-PERP': 0.0001,
    'UNI-PERP': 0.0001,
    'AAVE-PERP': 0.01,
    'CRV-PERP': 0.0001,
    'MKR-PERP': 0.1,
    'COMP-PERP': 0.01,
    'YFI-PERP': 1,
    'SNX-PERP': 0.001,
    'SUSHI-PERP': 0.0001
  }
  
  const tickSize = tickSizes[coinName] || 0.0001
  const roundedPrice = Math.round(price / tickSize) * tickSize
  
  // For BTC-PERP (tick size 0.5), ensure we don't have decimal places beyond what's allowed
  if (coinName === 'BTC-PERP') {
    // For BTC, ensure the price is divisible by 0.5
    // Round to nearest 0.5 increment and ensure proper formatting
    const rounded = Math.round(roundedPrice * 2) / 2
    
    // Ensure we don't have floating point precision issues
    if (rounded % 1 === 0) {
      return rounded.toString() + '.0'
    } else {
      // For .5 values, ensure clean formatting
      return rounded.toString()
    }
  }
  
  // For other coins, use appropriate decimal places
  const decimalPlaces = tickSize >= 1 ? 0 : 
                       tickSize >= 0.1 ? 1 : 
                       tickSize >= 0.01 ? 2 : 
                       tickSize >= 0.001 ? 3 : 
                       tickSize >= 0.0001 ? 4 : 8
  
  return roundedPrice.toFixed(decimalPlaces)
}

// TWAP helper functions
const getSizeIncrement = (coin) => {
  const increments = {
    'BTC-PERP': 0.00001,
    'ETH-PERP': 0.0001,
    'DOGE-PERP': 1,
    'SOL-PERP': 0.01,
    'AVAX-PERP': 0.01,
    'MATIC-PERP': 0.001,
    'ARB-PERP': 0.001,
    'OP-PERP': 0.001,
    'SUI-PERP': 0.001,
    'APT-PERP': 0.001,
    'NEAR-PERP': 0.001,
    'ATOM-PERP': 0.001,
    'DOT-PERP': 0.001,
    'LINK-PERP': 0.001,
    'UNI-PERP': 0.001,
    'AAVE-PERP': 0.01,
    'CRV-PERP': 0.001,
    'MKR-PERP': 0.1,
    'COMP-PERP': 0.01,
    'YFI-PERP': 1,
    'SNX-PERP': 0.001,
    'SUSHI-PERP': 0.001
  }

  return increments[coin] || 0.000001
}

const getSizePrecision = (increment) => {
  if (!Number.isFinite(increment)) return 6
  const incrementStr = increment.toString()
  if (!incrementStr.includes('.')) return 0
  return incrementStr.split('.')[1].length
}

const getMinOrderSize = (coin) => {
  const minSizes = {
    'DOGE-PERP': 1,
    'BTC-PERP': 0.00001, // Updated from 0.0001
    'ETH-PERP': 0.001,
    'SOL-PERP': 0.1,
    'AVAX-PERP': 0.1
  }

  return minSizes[coin] || 0.001
}

const getFormattedSubOrderSizes = (task) => {
  const sizeIncrement = task.sizeIncrement || getSizeIncrement(task.coin)
  const sizePrecision = Number.isInteger(task.sizePrecision)
    ? task.sizePrecision
    : getSizePrecision(sizeIncrement)

  const rawSizes = Array.isArray(task.subOrderSizes) && task.subOrderSizes.length > 0
    ? task.subOrderSizes
    : Array(parseInt(task.intervals, 10) || 0).fill(task.totalSize / task.intervals)

  const formattedSizes = rawSizes.map(size => Number(size).toFixed(sizePrecision))

  return {
    sizePrecision,
    rawSizes,
    subOrderSizes: formattedSizes,
    firstSubOrderSize: formattedSizes[0] || '0'
  }
}

const distributeSubOrderSizes = (totalSize, intervals, coin) => {
  const increment = getSizeIncrement(coin)
  const precision = getSizePrecision(increment)
  const minSize = getMinOrderSize(coin)
  const intervalCount = parseInt(intervals, 10)

  if (!Number.isFinite(intervalCount) || intervalCount <= 0) {
    throw new Error('Invalid number of intervals for TWAP order')
  }

  const sanitizedTotalSize = parseFloat(totalSize)
  if (!Number.isFinite(sanitizedTotalSize) || sanitizedTotalSize <= 0) {
    throw new Error('Invalid total size for TWAP order')
  }

  const rawUnits = sanitizedTotalSize / increment
  let totalUnits = Math.round(rawUnits)
  if (Math.abs(totalUnits - rawUnits) > 1e-6) {
    totalUnits = Math.floor(rawUnits)
  }
  if (totalUnits <= 0) {
    throw new Error('Total size is too small for the selected coin increment')
  }

  if (totalUnits < intervalCount) {
    throw new Error('Total size is too small for the requested number of intervals')
  }

  const baseUnits = Math.floor(totalUnits / intervalCount)
  const remainder = totalUnits - (baseUnits * intervalCount)

  if (baseUnits === 0) {
    throw new Error('Total size is too small for the requested number of intervals')
  }

  const unitsPerOrder = Array(intervalCount).fill(baseUnits)
  for (let i = 0; i < remainder; i++) {
    unitsPerOrder[i] += 1
  }

  const subOrderSizes = unitsPerOrder.map(units => Number((units * increment).toFixed(precision)))

  const smallestOrder = Math.min(...subOrderSizes)
  if (smallestOrder < minSize) {
    throw new Error(`Each sub-order must be at least ${minSize} ${coin.replace('-PERP', '')}`)
  }

  return {
    subOrderSizes,
    increment,
    precision,
    minSize
  }
}

const generateTwapTaskId = () => {
  return `twap_${++twapTaskCounter}_${Date.now()}`
}

const createTwapTask = (params) => {
  const { subOrderSizes, increment, precision, minSize } = distributeSubOrderSizes(
    params.totalSize,
    params.intervals,
    params.coin
  )

  const taskId = generateTwapTaskId()
  const task = {
    id: taskId,
    coin: params.coin,
    is_buy: params.is_buy,
    totalSize: parseFloat(params.totalSize),
    intervals: parseInt(params.intervals),
    durationMinutes: parseInt(params.durationMinutes),
    orderType: params.orderType || 'market',
    priceOffset: parseFloat(params.priceOffset) || 0,
    reduceOnly: params.reduceOnly || false,
    status: 'active',
    createdAt: Date.now(),
    completedOrders: 0,
    failedOrders: 0,
    results: [],
    subOrderSizes,
    sizeIncrement: increment,
    sizePrecision: precision,
    minOrderSize: minSize
  }
  
  twapTasks.set(taskId, task)
  return task
}

const executeTwapOrder = async (task, orderIndex) => {
  let sizeString = 'undefined' // Initialize with default value
  
  try {
    console.log(`🔍 Debug TWAP execution for task ${task.id}, orderIndex: ${orderIndex}`)
    console.log(`🔍 Task details:`, {
      intervals: task.intervals,
      totalSize: task.totalSize,
      subOrderSizes: task.subOrderSizes,
      subOrderSizesLength: task.subOrderSizes?.length
    })
    
    const { sizePrecision, rawSizes, subOrderSizes } = getFormattedSubOrderSizes(task)
    
    console.log(`🔍 Formatted sizes:`, {
      sizePrecision,
      rawSizesLength: rawSizes.length,
      subOrderSizesLength: subOrderSizes.length,
      rawSizes,
      subOrderSizes
    })
    
    // Validate array bounds
    if (orderIndex >= rawSizes.length || orderIndex >= subOrderSizes.length) {
      throw new Error(`Order index ${orderIndex} is out of bounds. Available orders: ${rawSizes.length}`)
    }
    
    const sizeNumber = rawSizes[orderIndex]
    sizeString = subOrderSizes[orderIndex] // Assign to the outer scope variable

    console.log(`🔍 Order details:`, {
      orderIndex,
      sizeNumber,
      sizeString,
      isFinite: Number.isFinite(sizeNumber),
      hasString: !!sizeString
    })

    if (!Number.isFinite(sizeNumber) || !sizeString) {
      throw new Error(`Unable to determine TWAP sub-order size for execution. sizeNumber: ${sizeNumber}, sizeString: ${sizeString}`)
    }
    const orderParams = {
      coin: task.coin,
      is_buy: task.is_buy,
      sz: sizeString,
      reduce_only: task.reduceOnly,
      order_type: { limit: { tif: 'Ioc' } } // IOC limit order for market-like execution
    }

    // Add validation for minimum order size and USD value
    const coinName = task.coin.replace('-PERP', '')
    const minOrderSizes = {
      'DOGE': 1,      // Minimum 1 DOGE
      'BTC': 0.00001, // Minimum 0.00001 BTC
      'ETH': 0.0001,  // Minimum 0.0001 ETH
      'SOL': 0.1,     // Minimum 0.1 SOL
      'AVAX': 0.1,    // Minimum 0.1 AVAX
    }
    
    const minSize = minOrderSizes[coinName] || 0.001
    if (sizeNumber < minSize) {
      throw new Error(`Sub-order size ${sizeString || 'undefined'} ${coinName} is too small. Minimum: ${minSize} ${coinName}`)
    }
    
    // Additional USD value validation (minimum $10 USD)
    const coinKey = task.coin.toUpperCase()
    const currentPrice = latestPrices[coinKey]?.price
    if (currentPrice) {
      const orderValueUsd = sizeNumber * parseFloat(currentPrice)
      if (orderValueUsd < 10) {
        throw new Error(`Sub-order value $${orderValueUsd.toFixed(2)} is too low. Minimum: $10.00 USD`)
      }
      console.log(`💰 Order value check: ${sizeNumber} ${coinName} × $${currentPrice} = $${orderValueUsd.toFixed(2)}`)
    } else {
      console.log(`⚠️ Cannot validate USD value - no current price available for ${task.coin}`)
    }

    // Set aggressive price for IOC orders to guarantee immediate execution
    // coinKey and currentPrice already declared above
    
    if (currentPrice) {
      // More aggressive pricing for guaranteed execution
      let aggressivePrice
      if (task.is_buy) {
        // For buys: add 20% above current price to ensure execution
        aggressivePrice = parseFloat(currentPrice) * 1.1
        
      } else {
        // For sells: subtract 20% below current price to ensure execution
        aggressivePrice = parseFloat(currentPrice) * 0.9
      }
      
      // For BTC-PERP, use integer prices to avoid tick size issues
      if (task.coin === 'BTC-PERP') {
        aggressivePrice = Math.ceil(aggressivePrice)
      }
      
      // Apply tick size formatting
      orderParams.limit_px = formatPriceForTickSize(aggressivePrice, task.coin)
      console.log(`🎯 IOC order price: ${currentPrice} -> ${aggressivePrice} -> ${orderParams.limit_px}`)
    } else {
      // Fallback prices with simple rounding
      const coinName = task.coin.replace('-PERP', '')
      let fallbackPrice
      if (coinName === 'DOGE') {
        fallbackPrice = task.is_buy ? 1 : 0
      } else if (coinName === 'BTC') {
        fallbackPrice = task.is_buy ? 100000 : 50000
      } else if (coinName === 'ETH') {
        fallbackPrice = task.is_buy ? 5000 : 2000
      } else {
        fallbackPrice = task.is_buy ? 100 : 1
      }
      orderParams.limit_px = formatPriceForTickSize(fallbackPrice, task.coin)
      console.log(`📉 Using fallback price: ${fallbackPrice} -> ${orderParams.limit_px}`)
    }

    console.log(`🎯 Executing TWAP order ${orderIndex + 1}/${task.intervals} for task ${task.id}`)
    console.log(`📊 Order details:`, {
      coin: task.coin,
      subOrderSize: sizeString || 'undefined',
      minRequired: minSize,
      isBuy: task.is_buy,
      price: orderParams.limit_px,
      orderType: 'IOC',
      assetId: getAssetId(task.coin)
    })
    
    const result = await exchangeClient.order({
      orders: [{
        a: getAssetId(task.coin),
        b: task.is_buy,
        p: orderParams.limit_px || '0',
        s: sizeString || '0',
        r: task.reduceOnly,
        t: { limit: { tif: 'Ioc' } } // IOC limit order for market-like execution
      }],
      grouping: 'na'
    })

    task.completedOrders++
    task.results.push({
      orderIndex: orderIndex + 1,
      result,
      executedAt: Date.now(),
      size: sizeString || 'undefined'
    })

    console.log(`✅ TWAP order ${orderIndex + 1} executed successfully`)
    return result

  } catch (error) {
    task.failedOrders++
    task.results.push({
      orderIndex: orderIndex + 1,
      error: error.message,
      executedAt: Date.now(),
      size: sizeString || 'undefined'
    })
    
    console.error(`❌ TWAP order ${orderIndex + 1} failed:`, error.message)
    throw error
  }
}

const scheduleTwapOrders = (task) => {
  const intervalDurationMs = (task.durationMinutes * 60 * 1000) / task.intervals
  
  // Schedule remaining orders (skip first one as it's executed immediately)
  for (let i = 1; i < task.intervals; i++) {
    const delay = i * intervalDurationMs
    
    setTimeout(async () => {
      try {
        await executeTwapOrder(task, i)
        
        // Check if this was the last order
        if (i === task.intervals - 1) {
          task.status = 'completed'
          task.completedAt = Date.now()
          console.log(`🎉 TWAP task ${task.id} completed: ${task.completedOrders}/${task.intervals} orders executed`)
        }
      } catch (error) {
        console.error(`❌ TWAP order ${i + 1} failed for task ${task.id}:`, error.message)
      }
    }, delay)
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('💥 Unhandled error:', error)
  res.status(500).json({ error: 'Internal server error' })
})

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Hyperliquid Server running on port ${PORT}`)
  console.log(`🌐 Network: ${getNetworkName()}`)
  console.log(`🔗 API base: http://localhost:${PORT}/api`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...')
  if (pricePollInterval) {
    clearInterval(pricePollInterval)
  }
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...')
  if (pricePollInterval) {
    clearInterval(pricePollInterval)
  }
  process.exit(0)
})
