#!/usr/bin/env node

/**
 * Direct API Test for Hyperliquid Place Order
 * 
 * This script tests the place order API directly without the frontend
 * Usage: node test.js
 */

import fetch from 'node-fetch'

const API_BASE_URL = 'http://localhost:3001/api'

// Test order configurations
const testOrders = {
  // DOGE Coin Test - Simple Buy Order
  dogeTest: {
    coin: 'DOGE-PERP',
    is_buy: true,
    sz: '50',
    limit_px: '0.25',
    order_type: { 
      limit: { 
        tif: 'Gtc'
      }
    },
    reduce_only: false
  },

  // DOGE Take Profit Trigger Order
  dogeTakeProfitTrigger: {
    coin: 'DOGE-PERP',
    is_buy: false, // TP is opposite of main order
    sz: '50',
    limit_px: '0.275', // Execution price
    reduce_only: true,
    order_type: {
      trigger: {
        triggerPx: '0.275', // Trigger price
        isMarket: false, // Execute as limit order
        tpsl: 'tp'
      }
    }
  },

  // DOGE Stop Loss Trigger Order
  dogeStopLossTrigger: {
    coin: 'DOGE-PERP',
    is_buy: false, // SL is opposite of main order
    sz: '50',
    limit_px: '0.225', // Execution price
    reduce_only: true,
    order_type: {
      trigger: {
        triggerPx: '0.225', // Trigger price
        isMarket: true, // Execute as market order
        tpsl: 'sl'
      }
    }
  },

  // DOGE Coin Test - Grouped TP/SL (Correct Structure)
  dogeGroupedTPSL: {
    action: {
      grouping: "normalTpsl",
      orders: [
        {
          a: 173, // DOGE-PERP asset ID
          b: true, // is_buy
          p: "0.25", // limit_px
          r: false, // reduce_only
          s: "50", // sz
          t: {
            limit: {
              tif: "Gtc"
            }
          }
        },
        {
          a: 173, // DOGE-PERP asset ID
          b: false, // is_buy (sell for SL)
          p: "0.225", // limit_px (execution price)
          r: true, // reduce_only
          s: "50", // sz
          t: {
            trigger: {
              isMarket: true,
              tpsl: "sl",
              triggerPx: "0.225" // trigger price
            }
          }
        },
        {
          a: 173, // DOGE-PERP asset ID
          b: false, // is_buy (sell for TP)
          p: "0.275", // limit_px (execution price)
          r: true, // reduce_only
          s: "50", // sz
          t: {
            trigger: {
              isMarket: false,
              tpsl: "tp",
              triggerPx: "0.275" // trigger price
            }
          }
        }
      ],
      type: "order"
    },
    expiresAfter: Date.now() + 60000, // 1 minute from now
    isFrontend: true,
    nonce: Date.now(),
    vaultAddress: null
  },

  // Basic limit order
  limitOrder: {
    coin: 'BTC-PERP',
    is_buy: true,
    sz: '0.00001',
    limit_px: '117391',
    order_type: { limit: { tif: 'Gtc' } },
    reduce_only: false
  },

  // Market order
  marketOrder: {
    coin: 'BTC-PERP',
    is_buy: false,
    sz: '0.00001',
    order_type: { limit: { tif: 'Ioc' } },
    reduce_only: false
  },

  // Take Profit order (combined structure)
  takeProfitOrder: {
    coin: 'BTC-PERP',
    is_buy: false, // TP is opposite of main order
    sz: '0.00001',
    limit_px: '129327',
    reduce_only: true,
    order_type: {
      limit: { tif: 'Gtc' },
      trigger: {
        triggerPx: '129327',
        isMarket: false,
        tpsl: 'tp'
      }
    }
  },

  // Stop Loss order (combined structure)
  stopLossOrder: {
    coin: 'BTC-PERP',
    is_buy: false, // SL is opposite of main order
    sz: '0.00001',
    limit_px: '105813',
    reduce_only: true,
    order_type: {
      limit: { tif: 'Gtc' },
      trigger: {
        triggerPx: '105813',
        isMarket: true,
        tpsl: 'sl'
      }
    }
  },

  // Scale order
  scaleOrder: {
    coin: 'BTC-PERP',
    is_buy: true,
    sz: '0.00001',
    limit_px: '117391',
    order_type: { limit: { tif: 'Alo' } },
    reduce_only: false
  }
}

async function testPlaceOrder(orderName, orderData) {
  console.log(`\n🧪 Testing ${orderName}:`)
  console.log('📝 Order payload:', JSON.stringify(orderData, null, 2))
  
  try {
    const response = await fetch(`${API_BASE_URL}/place-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData)
    })

    const result = await response.json()
    
    if (response.ok) {
      console.log('✅ Success:', JSON.stringify(result, null, 2))
      return { success: true, result }
    } else {
      console.log('❌ Error:', JSON.stringify(result, null, 2))
      return { success: false, error: result }
    }
  } catch (error) {
    console.log('💥 Network Error:', error.message)
    return { success: false, error: error.message }
  }
}

async function testAllOrders() {
  console.log('🚀 Starting Hyperliquid API Tests')
  console.log('=' .repeat(50))
  
  const results = {}
  
  // Test each order type
  for (const [orderName, orderData] of Object.entries(testOrders)) {
    results[orderName] = await testPlaceOrder(orderName, orderData)
    
    // Wait a bit between orders to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  // Summary
  console.log('\n📊 Test Summary:')
  console.log('=' .repeat(50))
  
  let successCount = 0
  let totalCount = 0
  
  for (const [orderName, result] of Object.entries(results)) {
    totalCount++
    const status = result.success ? '✅ PASS' : '❌ FAIL'
    console.log(`${status} ${orderName}`)
    if (result.success) successCount++
  }
  
  console.log(`\n🎯 Results: ${successCount}/${totalCount} tests passed`)
  
  if (successCount === totalCount) {
    console.log('🎉 All tests passed!')
  } else {
    console.log('⚠️ Some tests failed. Check the logs above.')
  }
}

async function testSpecificOrder(orderName) {
  if (!testOrders[orderName]) {
    console.log(`❌ Unknown order type: ${orderName}`)
    console.log('Available orders:', Object.keys(testOrders).join(', '))
    return
  }
  
  console.log(`🎯 Testing specific order: ${orderName}`)
  const result = await testPlaceOrder(orderName, testOrders[orderName])
  return result
}

async function testDogeSequence() {
  console.log('🐕 Testing DOGE Coin Trading Sequence')
  console.log('=' .repeat(50))
  
  const results = {}
  
  // 1. Place main DOGE buy order
  console.log('\n📈 Step 1: Placing DOGE Buy Order')
  results.mainOrder = await testPlaceOrder('dogeTest', testOrders.dogeTest)
  
  if (results.mainOrder.success) {
    console.log('✅ Main order placed successfully!')
    
    // Wait a moment between orders
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // 2. Place Take Profit trigger order
    console.log('\n🎯 Step 2: Placing Take Profit Trigger Order')
    results.takeProfitTrigger = await testPlaceOrder('dogeTakeProfitTrigger', testOrders.dogeTakeProfitTrigger)
    
    // Wait a moment between orders
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // 3. Place Stop Loss trigger order
    console.log('\n🛡️ Step 3: Placing Stop Loss Trigger Order')
    results.stopLossTrigger = await testPlaceOrder('dogeStopLossTrigger', testOrders.dogeStopLossTrigger)
    
    // Summary
    console.log('\n📊 DOGE Trading Sequence Results:')
    console.log('=' .repeat(50))
    console.log(`Main Order: ${results.mainOrder.success ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Take Profit Trigger: ${results.takeProfitTrigger.success ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`Stop Loss Trigger: ${results.stopLossTrigger.success ? '✅ PASS' : '❌ FAIL'}`)
    
    const successCount = Object.values(results).filter(r => r.success).length
    console.log(`\n🎯 Overall: ${successCount}/3 orders placed successfully`)
    
    if (successCount === 3) {
      console.log('🎉 Complete DOGE trading setup successful!')
      console.log('💡 Using separate trigger orders for TP/SL as per Hyperliquid SDK documentation!')
    } else {
      console.log('⚠️ Some orders failed. Check the logs above.')
    }
  } else {
    console.log('❌ Main order failed. Skipping TP/SL orders.')
  }
  
  return results
}

// Command line interface
async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    // Run all tests
    await testAllOrders()
  } else if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
🧪 Hyperliquid API Test Script

Usage:
  node test.js                    # Run all tests
  node test.js <orderName>         # Test specific order
  node test.js doge                # Test DOGE trading sequence
  node test.js --help              # Show this help

Available order types:
  ${Object.keys(testOrders).join('\n  ')}

Special commands:
  doge                            # Test complete DOGE trading sequence (buy + TP + SL)

Examples:
  node test.js limitOrder
  node test.js takeProfitOrder
  node test.js stopLossOrder
  node test.js doge               # Test DOGE: buy 50 @ $0.25, TP @ $0.275, SL @ $0.225
  node test.js dogeTakeProfitOnly # Test DOGE with TP only
  node test.js dogeStopLossOnly  # Test DOGE with SL only
`)
  } else if (args[0] === 'doge') {
    // Test DOGE trading sequence
    await testDogeSequence()
  } else {
    // Test specific order
    const orderName = args[0]
    await testSpecificOrder(orderName)
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.log('💥 Unhandled Rejection at:', promise, 'reason:', reason)
  process.exit(1)
})

// Run the tests
main().catch(console.error)
