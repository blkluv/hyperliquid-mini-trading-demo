# 🧪 Hyperliquid API Test Script

This guide explains how to use the `test.js` script to directly test the Hyperliquid place order API without the frontend.

## 📋 Prerequisites

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start the Server:**
   ```bash
   npm run dev:server
   ```
   The server should be running on `http://localhost:3001`

## 🚀 Usage

### Run All Tests
```bash
npm run test:api
# or
node test.js
```

### Test Specific Order Type
```bash
node test.js limitOrder
node test.js takeProfitOrder
node test.js stopLossOrder
node test.js marketOrder
node test.js scaleOrder
```

### Show Help
```bash
node test.js --help
```

## 📊 Test Order Types

### 1. **Limit Order** (`limitOrder`)
- Basic limit order with GTC time-in-force
- Tests standard order placement

### 2. **Market Order** (`marketOrder`)
- Market order with IOC time-in-force
- Tests immediate execution

### 3. **Take Profit Order** (`takeProfitOrder`)
- Combined limit + trigger structure
- Tests TP order placement with new format

### 4. **Stop Loss Order** (`stopLossOrder`)
- Combined limit + trigger structure
- Tests SL order placement with new format

### 5. **Scale Order** (`scaleOrder`)
- ALO (Add Liquidity Only) order
- Tests scale order functionality

## 🔍 Expected Output

### Successful Test:
```
🧪 Testing takeProfitOrder:
📝 Order payload: {
  "coin": "BTC-PERP",
  "is_buy": false,
  "sz": "0.00001",
  "limit_px": "129327",
  "reduce_only": true,
  "order_type": {
    "limit": { "tif": "Gtc" },
    "trigger": {
      "triggerPx": "129327",
      "isMarket": false,
      "tpsl": "tp"
    }
  }
}
✅ Success: {
  "status": "ok",
  "response": {
    "type": "order",
    "data": {
      "statuses": [{"resting": {"oid": 12345}}]
    }
  }
}
```

### Failed Test:
```
❌ Error: {
  "error": "Order validation failed: Invalid trigger structure"
}
```

## 🛠️ Customizing Tests

You can modify the `testOrders` object in `test.js` to test different scenarios:

```javascript
const customOrder = {
  coin: 'ETH-PERP',
  is_buy: true,
  sz: '0.1',
  limit_px: '3000',
  order_type: { limit: { tif: 'Gtc' } },
  reduce_only: false
}

// Add to testOrders object
testOrders.customOrder = customOrder
```

## 🐛 Troubleshooting

### Server Not Running
```
💥 Network Error: connect ECONNREFUSED 127.0.0.1:3001
```
**Solution:** Start the server with `npm run dev:server`

### SDK Not Initialized
```
❌ Error: { "error": "SDK not initialized" }
```
**Solution:** Check server logs for SDK initialization errors

### Invalid Order Structure
```
❌ Error: { "error": "Order validation failed" }
```
**Solution:** Check the order payload structure matches Hyperliquid SDK requirements

## 📈 Monitoring

The test script provides detailed logging:
- **📝 Order payload:** Shows the exact data sent to the API
- **✅ Success:** Shows the API response for successful orders
- **❌ Error:** Shows error details for failed orders
- **📊 Test Summary:** Shows overall test results

## 🔧 Advanced Usage

### Testing with Different Parameters
```javascript
// Modify test.js to test edge cases
const edgeCaseOrder = {
  coin: 'BTC-PERP',
  is_buy: true,
  sz: '0.000000001', // Very small size
  limit_px: '999999999', // Very high price
  order_type: { limit: { tif: 'Gtc' } },
  reduce_only: true
}
```

### Batch Testing
```javascript
// Test multiple orders in sequence
const batchOrders = [
  testOrders.limitOrder,
  testOrders.takeProfitOrder,
  testOrders.stopLossOrder
]

for (const order of batchOrders) {
  await testPlaceOrder('batch', order)
  await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2s
}
```

This test script is perfect for debugging order placement issues and validating the new TP/SL order structure! 🚀
