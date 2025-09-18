# Market Order Price Fix

## Issue Fixed
Market orders were failing with "Order price cannot be more than 80% away from the reference price" because they weren't setting a proper price parameter.

## Problem
Market orders were being sent as limit orders with IOC (Immediate Or Cancel) but without a `limit_px` parameter, causing the exchange to reject them.

## Root Cause
```typescript
// BEFORE - Market orders had no price
if (state.orderType === 'limit' && state.limitPrice) {
  orderParams.limit_px = state.limitPrice
}
// Market orders had no price set at all
```

## Solution
```typescript
// AFTER - Market orders get current price with buffer
if (state.orderType === 'limit' && state.limitPrice) {
  orderParams.limit_px = state.limitPrice
} else if (state.orderType === 'market' && currentPrice) {
  // Add 1% buffer to ensure execution
  const buffer = state.side === 'buy' ? 1.01 : 0.99
  const marketPrice = (currentPrice * buffer).toFixed(2)
  orderParams.limit_px = marketPrice
}
```

## Implementation Details

### 1. Enhanced placeOrder Function
```typescript
const placeOrder = useCallback(async (convertedSize?: string, currentPrice?: number) => {
  // ... existing logic
  
  if (state.orderType === 'market' && currentPrice) {
    const buffer = state.side === 'buy' ? 1.01 : 0.99
    const marketPrice = (currentPrice * buffer).toFixed(2)
    orderParams.limit_px = marketPrice
  }
})
```

### 2. Price Buffer Logic
- **Buy Orders**: Price = Current Price × 1.01 (1% above market)
- **Sell Orders**: Price = Current Price × 0.99 (1% below market)
- **Purpose**: Ensures immediate execution while staying within 80% limit

### 3. Current Price Integration
```typescript
// TradingInterface passes current price
const result = await placeOrder(convertedSize, topCardPrice || undefined)
```

## Test Scenarios

### Case 1: Buy Market Order
- **Current Price**: $50,000
- **Side**: Buy
- **Buffer**: 1.01
- **Market Price**: $50,000 × 1.01 = $50,500
- **API Call**: `limit_px: "50500.00"`
- **Expected**: Order executes immediately at market price

### Case 2: Sell Market Order
- **Current Price**: $50,000
- **Side**: Sell
- **Buffer**: 0.99
- **Market Price**: $50,000 × 0.99 = $49,500
- **API Call**: `limit_px: "49500.00"`
- **Expected**: Order executes immediately at market price

### Case 3: High Volatility
- **Current Price**: $50,000
- **Side**: Buy
- **Buffer**: 1.01
- **Market Price**: $50,500
- **Within 80% Limit**: Yes (1% vs 80% limit)
- **Expected**: Order executes successfully

## Console Logging

The system logs market order price calculations:
```javascript
console.log('🎣 Hook: Market order price calculation:', {
  currentPrice: 50000,
  side: 'buy',
  buffer: 1.01,
  marketPrice: '50500.00',
  orderParams: {
    coin: 'BTC-PERP',
    is_buy: true,
    sz: '0.00031',
    limit_px: '50500.00',
    order_type: { limit: { tif: 'Ioc' } }
  }
})
```

## Benefits

### Immediate Execution
- ✅ **1% Buffer**: Small enough to execute immediately
- ✅ **Within 80% Limit**: Well within exchange requirements
- ✅ **Market Behavior**: Acts like a true market order

### Risk Management
- ✅ **Buy Orders**: Slightly above market (ensures execution)
- ✅ **Sell Orders**: Slightly below market (ensures execution)
- ✅ **Minimal Slippage**: Only 1% difference from market price

### Exchange Compatibility
- ✅ **Proper Format**: Sends limit_px parameter
- ✅ **IOC Orders**: Immediate or cancel behavior
- ✅ **Price Validation**: Within acceptable range

## Edge Cases

### Case 1: Missing Current Price
- **Scenario**: No market price available
- **Behavior**: Market order fails gracefully
- **Error**: "Current price not available for market order"

### Case 2: Very High Volatility
- **Scenario**: Price moves >1% during order submission
- **Behavior**: Order may not execute (IOC behavior)
- **Result**: Order canceled, user can retry

### Case 3: Low Liquidity
- **Scenario**: Market has wide spreads
- **Behavior**: 1% buffer may not be enough
- **Solution**: Could increase buffer to 2-3% if needed

## Testing Instructions

1. **Test Buy Market Order**:
   - Select "Market" order type
   - Select "Buy" side
   - Enter size and submit
   - Check console logs for price calculation
   - Verify order executes successfully

2. **Test Sell Market Order**:
   - Select "Market" order type
   - Select "Sell" side
   - Enter size and submit
   - Check console logs for price calculation
   - Verify order executes successfully

3. **Test Price Calculation**:
   - Note current market price
   - Submit market order
   - Verify calculated price is 1% above/below market
   - Check that price is well within 80% limit

4. **Test Error Handling**:
   - Try market order without current price
   - Verify appropriate error message
   - Ensure no invalid API calls

## Notes

- Market orders now properly set limit_px parameter
- 1% buffer ensures immediate execution while staying within limits
- Console logging helps debug price calculations
- All order types (market, limit, scale, TWAP) support current price parameter
- Buffer can be adjusted if needed for different market conditions
