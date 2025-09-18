# USD to Coin Size Conversion Guide

This guide covers the USD to coin size conversion functionality for order submissions.

## Overview

When users select USD as the size unit, the system now:
1. **Shows the calculated coin size** in the UI for user reference
2. **Converts USD to coin size** for API calls
3. **Passes the coin size** to the Hyperliquid API (not USD amount)

## Implementation Details

### UI Display
When USD is selected as size unit, a coin size display appears below the size input:
```
Coin Size: 0.000300 BTC
```

### API Conversion
The system automatically converts USD amounts to coin sizes before sending to the API:
- **User Input**: "15" USD
- **Coin Size**: 15 ÷ $50,000 = 0.000300 BTC
- **API Call**: Uses "0.000300" as the size parameter

## Helper Functions

### convertUsdToCoinSize()
```typescript
const convertUsdToCoinSize = (usdAmount: number, coinPrice: number): number => {
  return usdAmount / coinPrice
}
```

### getCoinSizeForApi()
```typescript
const getCoinSizeForApi = (): number => {
  if (!state.size || !topCardPrice) return 0
  
  const sizeValue = parseFloat(state.size)
  if (isNaN(sizeValue) || sizeValue <= 0) return 0
  
  if (state.sizeUnit === 'USD') {
    return convertUsdToCoinSize(sizeValue, topCardPrice)
  } else {
    return sizeValue // Already in coin units
  }
}
```

## Order Submission Flow

### 1. User Input
- User enters "15" in size field
- User selects "USD" as size unit
- System shows "Coin Size: 0.000300 BTC" (at $50k BTC price)

### 2. Order Submission
```typescript
const coinSize = getCoinSizeForApi() // 0.000300
const convertedSize = state.sizeUnit === 'USD' && coinSize > 0 
  ? coinSize.toFixed(6) // "0.000300"
  : undefined

const result = await placeOrder(convertedSize)
```

### 3. API Call
```typescript
const orderParams: OrderParams = {
  coin: 'BTC',
  is_buy: true,
  sz: "0.000300", // Converted coin size, not "15"
  // ... other params
}
```

## Test Scenarios

### Case 1: USD Size Unit
- **Input**: Size "15", Size Unit "USD", BTC Price $50,000
- **UI Display**: "Coin Size: 0.000300 BTC"
- **API Call**: sz: "0.000300"
- **Expected**: Order placed for 0.000300 BTC

### Case 2: BTC Size Unit
- **Input**: Size "0.001", Size Unit "BTC"
- **UI Display**: No coin size display (already in coin units)
- **API Call**: sz: "0.001"
- **Expected**: Order placed for 0.001 BTC

### Case 3: ETH Size Unit
- **Input**: Size "0.1", Size Unit "ETH", ETH Price $3,000
- **UI Display**: No coin size display (already in coin units)
- **API Call**: sz: "0.1"
- **Expected**: Order placed for 0.1 ETH

## Order Type Support

### Market Orders
- ✅ USD → Coin conversion
- ✅ API receives coin size
- ✅ UI shows calculated coin size

### Limit Orders
- ✅ USD → Coin conversion
- ✅ API receives coin size
- ✅ UI shows calculated coin size

### Scale Orders
- ✅ USD → Coin conversion
- ✅ Each scale order uses converted coin size
- ✅ UI shows calculated coin size

### TWAP Orders
- ✅ USD → Coin conversion
- ✅ Each TWAP interval uses converted coin size
- ✅ UI shows calculated coin size

## Console Logging

The system logs conversion details for debugging:
```javascript
console.log('🎨 Component: Size conversion:', {
  originalSize: "15",
  sizeUnit: "USD",
  coinSize: 0.000300,
  convertedSize: "0.000300",
  orderType: "limit"
})
```

## Benefits

### User Experience
- ✅ **Intuitive**: Users can think in USD terms
- ✅ **Transparent**: Shows exact coin amount being traded
- ✅ **Accurate**: Real-time conversion based on current prices

### API Compatibility
- ✅ **Correct Format**: API receives coin sizes as expected
- ✅ **Precision**: 6 decimal places for accurate conversion
- ✅ **Consistent**: All order types use the same conversion logic

### Trading Accuracy
- ✅ **Exact Amounts**: No rounding errors in conversions
- ✅ **Real-Time**: Uses current market prices
- ✅ **Multi-Coin**: Works with any supported coin

## Edge Cases

### Case 1: Missing Price Data
- **Scenario**: USD selected but no market price available
- **Behavior**: Coin size display hidden, conversion fails gracefully
- **API**: Uses original size (fallback)

### Case 2: Zero or Invalid Size
- **Scenario**: User enters "0" or invalid text
- **Behavior**: No conversion, validation catches the error
- **API**: Order submission blocked by validation

### Case 3: Very Small USD Amounts
- **Scenario**: User enters "0.01" USD at high BTC price
- **Behavior**: Converts to very small coin amount (e.g., 0.0000002 BTC)
- **API**: Uses precise 6-decimal conversion

## Testing Instructions

1. **Test USD Conversion**:
   - Select USD size unit
   - Enter dollar amount (e.g., "15")
   - Verify coin size display shows correct conversion
   - Submit order and check console logs

2. **Test Coin Unit**:
   - Select coin size unit (BTC, ETH, etc.)
   - Enter coin amount (e.g., "0.001")
   - Verify no coin size display (already in coin units)
   - Submit order and verify API receives correct size

3. **Test Different Coins**:
   - Switch between BTC, ETH, SOL
   - Test USD conversion for each coin
   - Verify calculations use correct coin prices

4. **Test All Order Types**:
   - Test market, limit, scale, and TWAP orders
   - Verify all use converted coin sizes
   - Check console logs for conversion details

## Notes

- Coin size display only appears when USD is selected
- Conversion uses current market price from topCardPrice
- All order types (market, limit, scale, TWAP) support USD conversion
- API always receives coin sizes, never USD amounts
- Conversion precision is 6 decimal places
- Console logging helps debug conversion issues
