// Simple Express server for Hyperliquid API
// This runs the SDK on the server side for better security

import express from 'express'
import cors from 'cors'
import { Hyperliquid } from 'hyperliquid'
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

// Initialize Hyperliquid SDK
let sdk = null

// Realtime price streaming state
let latestPrices = {}
const priceStreamClients = new Set()
let pricePollInterval = null
let isFetchingPrices = false

const getNetworkName = () => (CONFIG.USE_TESTNET ? 'testnet' : 'mainnet')

const broadcastPrices = (prices = latestPrices) => {
  console.log('📡 broadcastPrices called with:', prices)
  console.log('📡 Connected SSE clients:', priceStreamClients.size)
  
  if (!prices || Object.keys(prices).length === 0) {
    console.log('⚠️ No prices to broadcast')
    return
  }

  const payload = {
    type: 'priceUpdate',
    prices,
    network: getNetworkName(),
    timestamp: Date.now()
  }

  console.log('📡 Broadcasting price update to', priceStreamClients.size, 'clients')
  console.log('📡 Price update payload:', JSON.stringify(payload, null, 2))

  const data = `data: ${JSON.stringify(payload)}\n\n`

  for (const client of priceStreamClients) {
    try {
      client.write(data)
      console.log('✅ Price update sent to SSE client')
    } catch (error) {
      console.error('❌ Failed to write to SSE client:', error.message)
      priceStreamClients.delete(client)
      try {
        client.end()
      } catch (endError) {
        console.error('❌ Failed to close SSE client connection:', endError.message)
      }
    }
  }
}

const stopPriceFeed = () => {
  if (pricePollInterval) {
    clearInterval(pricePollInterval)
    pricePollInterval = null
  }
}

const fetchAndBroadcastPrices = async () => {
  console.log('🔄 fetchAndBroadcastPrices called')
  
  if (!sdk || isFetchingPrices) {
    console.log('⚠️ Skipping price fetch - SDK not available or already fetching')
    return
  }

  console.log('🔄 Starting price fetch...')
  isFetchingPrices = true

  try {
    console.log('🔄 Calling sdk.info.getAllMids()...')
    console.log('🔄 SDK object:', sdk)
    console.log('🔄 SDK.info:', sdk.info)
    console.log('🔄 SDK.info.general:', sdk.info?.general)
    
    const snapshot = await sdk.info.getAllMids()
    console.log('✅ Received price snapshot:', snapshot)
    
    if (snapshot && typeof snapshot === 'object') {
      latestPrices = snapshot
      console.log('✅ Updated latestPrices, broadcasting...')
      broadcastPrices()
    } else {
      console.log('⚠️ Invalid snapshot received:', snapshot)
    }
  } catch (error) {
    console.error('❌ Failed to fetch price snapshot:', error.message)
    console.error('❌ Error details:', error)
  } finally {
    isFetchingPrices = false
    console.log('🔄 Price fetch completed')
  }
}

const ensurePriceFeed = async () => {
  console.log('🔄 ensurePriceFeed called')
  
  if (!sdk) {
    console.error('❌ SDK not initialized in ensurePriceFeed')
    throw new Error('SDK not initialized')
  }

  console.log('✅ SDK is available, checking pricePollInterval')
  
  if (pricePollInterval) {
    console.log('✅ Price feed already running, skipping initialization')
    return
  }

  console.log('🔄 Starting price feed initialization...')
  await fetchAndBroadcastPrices()

  console.log('🔄 Setting up price polling interval (1 second)')
  pricePollInterval = setInterval(fetchAndBroadcastPrices, 1000)
  console.log('✅ Price feed initialized successfully')
}

async function initializeSDK() {
  try {
    sdk = new Hyperliquid({
      privateKey: CONFIG.PRIVATE_KEY,
      testnet: CONFIG.USE_TESTNET,
      enableWs: true
    })
    
    await sdk.connect()

    await ensurePriceFeed()
    console.log('✅ Hyperliquid SDK initialized successfully')
    console.log('🌐 Network:', CONFIG.USE_TESTNET ? 'Testnet' : 'Mainnet')
  } catch (error) {
    console.error('❌ Failed to initialize Hyperliquid SDK:', error.message)
  }
}

// Helper function to get wallet address
function getWalletAddress(privateKey) {
  try {
    const wallet = new ethers.Wallet(privateKey)
    return wallet.address
  } catch (error) {
    throw new Error('Invalid private key')
  }
}

// API Routes

// Get meta data
app.get('/api/meta', async (req, res) => {
  try {
    if (!sdk) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const meta = await sdk.info.perpetuals.getMeta()
    res.json(meta)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get current mid prices snapshot
app.get('/api/prices', async (req, res) => {
  try {
    if (!sdk) {
      return res.status(503).json({ error: 'SDK not initialized' })
    }

    await ensurePriceFeed()

    res.json({
      prices: latestPrices,
      network: getNetworkName(),
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('❌ Failed to fetch prices:', error.message)
    res.status(500).json({ error: error.message })
  }
})

// Server-Sent Events stream for realtime prices
app.get('/api/price-stream', async (req, res) => {
  console.log('🔌 New SSE client connecting to /api/price-stream')
  
  if (!sdk) {
    console.error('❌ SDK not initialized for SSE client')
    res.status(503).json({ error: 'SDK not initialized' })
    return
  }

  console.log('✅ SDK is initialized, setting up SSE headers')
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  priceStreamClients.add(res)
  console.log(`📊 Total SSE clients connected: ${priceStreamClients.size}`)

  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n')
  }, 30000)

  req.on('close', () => {
    console.log('🔌 SSE client disconnected')
    clearInterval(keepAlive)
    priceStreamClients.delete(res)
    console.log(`📊 Remaining SSE clients: ${priceStreamClients.size}`)
    try {
      res.end()
    } catch (error) {
      console.error('❌ Failed to terminate SSE connection:', error.message)
    }
  })

  // Send initial connection confirmation
  res.write(
    `data: ${JSON.stringify({
      type: 'connection',
      message: 'Connected to price stream',
      timestamp: Date.now()
    })}\n\n`
  )

  try {
    console.log('🔄 Attempting to initialize price feed for SSE client...')
    await ensurePriceFeed()
    console.log('✅ Price feed initialization completed for SSE client')
  } catch (error) {
    console.error('❌ Failed to initialize price feed for SSE client:', error.message)
    console.error('❌ Error details:', error)
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        message: 'Failed to initialize price feed',
        error: error.message,
        timestamp: Date.now()
      })}\n\n`
    )
  }

  // Send current prices if available
  console.log('📊 Checking for existing prices...')
  console.log('📊 latestPrices:', latestPrices)
  console.log('📊 latestPrices keys:', Object.keys(latestPrices || {}))
  
  if (latestPrices && Object.keys(latestPrices).length > 0) {
    console.log('✅ Sending initial price snapshot to SSE client')
    res.write(
      `data: ${JSON.stringify({
        type: 'snapshot',
        prices: latestPrices,
        network: getNetworkName(),
        timestamp: Date.now()
      })}\n\n`
    )
  } else {
    console.log('⚠️ No prices available to send to SSE client')
    res.write(
      `data: ${JSON.stringify({
        type: 'no_data',
        message: 'No price data available',
        timestamp: Date.now()
      })}\n\n`
    )
  }
})

// Get clearinghouse state
app.get('/api/clearinghouse-state', async (req, res) => {
  try {
    if (!sdk) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const address = req.query.address || getWalletAddress(CONFIG.PRIVATE_KEY)
    const state = await sdk.info.perpetuals.getClearinghouseState(address)
    res.json(state)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get wallet balance
app.get('/api/wallet-balance', async (req, res) => {
  try {
    if (!sdk) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const address = req.query.address || getWalletAddress(CONFIG.PRIVATE_KEY)
    const state = await sdk.info.perpetuals.getClearinghouseState(address)
    
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
    res.status(500).json({ error: error.message })
  }
})

// Place order
app.post('/api/place-order', async (req, res) => {
  try {
    if (!sdk) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const order = req.body
    console.log('📝 Placing order:', JSON.stringify(order, null, 2))
    
    // Get current market price for better order executionmm0
    try {
      const meta = await sdk.info.perpetuals.getMeta()
      const btcAsset = meta.universe.find(asset => asset.name === 'BTC-PERP')
      if (btcAsset && !order.limit_px) {
        console.log('📊 BTC asset info:', btcAsset)
        // Use a reasonable price around current market
        if (order.is_buy) { // Buy order without price
          order.limit_px = '100000' // High price for buy
        } else { // Sell order without price
          order.limit_px = '1000' // Low price for sell
        }
      }
    } catch (metaError) {
      console.log('⚠️ Could not fetch market data, using default prices')
      // Set default prices if no price is provided
      if (!order.limit_px) {
        if (order.is_buy) {
          order.limit_px = '100000'
        } else {
          order.limit_px = '1000'
        }
      }
    }
    
    const result = await sdk.exchange.placeOrder(order)
    console.log('✅ Order result:', JSON.stringify(result, null, 2))
    res.json(result)
  } catch (error) {
    console.error('❌ Order failed:', error)
    res.status(500).json({ error: error.message })
  }
})

// Update leverage
app.post('/api/update-leverage', async (req, res) => {
  try {
    if (!sdk) {
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
    const result = await sdk.exchange.updateLeverage(coin, leverageMode, leverage)
    
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
    res.status(500).json({ error: error.message })
  }
})

// Update isolated margin
app.post('/api/update-margin', async (req, res) => {
  try {
    if (!sdk) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const { coin, isBuy, ntli } = req.body
    const result = await sdk.exchange.updateIsolatedMargin(coin, isBuy, ntli)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Cancel all orders
app.post('/api/cancel-orders', async (req, res) => {
  try {
    if (!sdk) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const coin = req.query.coin
    const result = coin 
      ? await sdk.custom.cancelAllOrders(coin)
      : await sdk.custom.cancelAllOrders()
    
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Get block/transaction information
app.get('/api/block/:blockNumber', async (req, res) => {
  try {
    if (!sdk) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const blockNumber = req.params.blockNumber
    console.log('📦 Getting block info for:', blockNumber)
    
    // Get block information - try different method names
    let blockInfo
    try {
      blockInfo = await sdk.info.perpetuals.getBlock(blockNumber)
    } catch (e) {
      // Try alternative method names
      try {
        blockInfo = await sdk.info.getBlock(blockNumber)
      } catch (e2) {
        blockInfo = await sdk.info.perpetuals.getBlockInfo(blockNumber)
      }
    }
    res.json(blockInfo)
  } catch (error) {
    console.error('❌ Failed to get block info:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get recent blocks
app.get('/api/blocks', async (req, res) => {
  try {
    if (!sdk) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const limit = req.query.limit || 10
    console.log('📦 Getting recent blocks, limit:', limit)
    
    // Get recent blocks - try different method names
    let blocks
    try {
      blocks = await sdk.info.perpetuals.getRecentBlocks(parseInt(limit))
    } catch (e) {
      try {
        blocks = await sdk.info.getRecentBlocks(parseInt(limit))
      } catch (e2) {
        blocks = await sdk.info.perpetuals.getBlocks(parseInt(limit))
      }
    }
    res.json(blocks)
  } catch (error) {
    console.error('❌ Failed to get recent blocks:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get order history
app.get('/api/orders', async (req, res) => {
  try {
    if (!sdk) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    const address = req.query.address || getWalletAddress(CONFIG.PRIVATE_KEY)
    console.log('📋 Getting order history for:', address)
    
    // Get order history - try different method names
    let orders
    try {
      // Try to get open orders first
      orders = await sdk.info.perpetuals.getOpenOrders(address)
    } catch (e) {
      try {
        // Try alternative method names
        orders = await sdk.info.getOpenOrders(address)
      } catch (e2) {
        try {
          // Try to get user state which includes orders
          const userState = await sdk.info.perpetuals.getClearinghouseState(address)
          orders = {
            openOrders: userState.openOrders || [],
            assetPositions: userState.assetPositions || [],
            message: 'Retrieved from clearinghouse state'
          }
        } catch (e3) {
          orders = { error: 'Could not retrieve order information', availableMethods: Object.keys(sdk.info.perpetuals) }
        }
      }
    }
    res.json(orders)
  } catch (error) {
    console.error('❌ Failed to get order history:', error)
    res.status(500).json({ error: error.message })
  }
})

// Get current block info
app.get('/api/current-block', async (req, res) => {
  try {
    if (!sdk) {
      return res.status(500).json({ error: 'SDK not initialized' })
    }
    
    console.log('📦 Getting current block info')
    
    // Get current block information
    let blockInfo
    try {
      // Try to get current block from meta or other sources
      const meta = await sdk.info.perpetuals.getMeta()
      blockInfo = {
        currentBlock: 'N/A', // Hyperliquid doesn't expose current block directly
        network: CONFIG.USE_TESTNET ? 'testnet' : 'mainnet',
        meta: meta,
        timestamp: new Date().toISOString()
      }
    } catch (e) {
      blockInfo = {
        currentBlock: 'N/A',
        network: CONFIG.USE_TESTNET ? 'testnet' : 'mainnet',
        error: 'Could not fetch block info',
        timestamp: new Date().toISOString()
      }
    }
    res.json(blockInfo)
  } catch (error) {
    console.error('❌ Failed to get current block info:', error)
    res.status(500).json({ error: error.message })
  }
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    sdk_initialized: !!sdk,
    network: CONFIG.USE_TESTNET ? 'testnet' : 'mainnet'
  })
})

// Switch network
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
    if (sdk) {
      stopPriceFeed()
      try {
        // Try to disconnect if method exists
        if (typeof sdk.disconnect === 'function') {
          await sdk.disconnect()
        }
      } catch (error) {
        console.log('Disconnect not available or failed:', error.message)
      }
    }

    latestPrices = {}

    sdk = new Hyperliquid({
      privateKey: CONFIG.PRIVATE_KEY,
      testnet: CONFIG.USE_TESTNET,
      enableWs: true
    })

    await sdk.connect()
    await ensurePriceFeed()

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

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api`)
  await initializeSDK()
})

export default app
