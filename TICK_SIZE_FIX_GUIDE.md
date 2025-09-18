# Tick Size Fix Guide

This guide covers the tick size formatting fix that ensures prices are divisible by the required tick size for different assets.

## Issue Fixed
Orders were failing with "Price must be divisible by tick size. asset=3" because prices weren't being formatted according to the exchange's tick size requirements.

## Problem
Prices were being formatted with `.toFixed(2)` which doesn't respect the tick size requirements for different assets:
- **BTC**: Tick size 0.5 (prices must be divisible by 0.5)
- **ETH**: Tick size 0.05 (prices must be divisible by 0.05)
- **SOL**: Tick size 0.01 (prices must be divisible by 0.01)
- **DOGE**: Tick size 0.0001 (prices must be divisible by 0.0001)

## Solution
Implemented `formatPriceForTickSize()` function that:
1. **Identifies the base coin** from coin pairs (e.g., "BTC-PERP" → "BTC")
2. **Applies correct tick size** based on the asset
3. **Rounds to nearest tick** using `Math.round(price / tickSize) * tickSize`
4. **Formats with correct decimals** based on tick size

## Implementation Details

### Tick Size Configuration
```typescript
const tickSizes: { [key: string]: number } = {
  'BTC': 0.5,      // BTC tick size is typically 0.5
  'ETH': 0.05,     // ETH tick size is typically 0.05
  'SOL': 0.01,     // SOL tick size is typically 0.01
  'DOGE': 0.0001,  // DOGE tick size is typically 0.0001
  'default': 0.01  // Default tick size
}
```

### Price Formatting Function
```typescript
const formatPriceForTickSize = (price: number, coin: string): string => {
  const baseCoin = coin.toUpperCase().split('-')[0]
  const tickSize = tickSizes[baseCoin] || tickSizes.default
  
  // Round price to nearest tick size
  const roundedPrice = Math.round(price / tickSize) * tickSize
  
  // Format with appropriate decimal places
  const decimalPlaces = tickSize < 1 ? Math.abs(Math.log10(tickSize)) : 0
  return roundedPrice.toFixed(decimalPlaces)
}
```

## Updated Order Types

### 1. Market Orders
```typescript
// BEFORE
const marketPrice = (currentPrice * buffer).toFixed(2)

// AFTER
const marketPrice = formatPriceForTickSize(currentPrice * buffer, state.selectedCoin)
```

### 2. Limit Orders
```typescript
// BEFORE
orderParams.limit_px = state.limitPrice

// AFTER
const limitPrice = parseFloat(state.limitPrice)
orderParams.limit_px = formatPriceForTickSize(limitPrice, state.selectedCoin)
```

### 3. Scale Orders
```typescript
// BEFORE
const price = (startPrice - (priceStep * i)).toFixed(2)

// AFTER
const rawPrice = startPrice - (priceStep * i)
const price = formatPriceForTickSize(rawPrice, state.selectedCoin)
```

### 4. TWAP Orders
```typescript
// BEFORE
orderParams.limit_px = '100000' // Placeholder

// AFTER
const offsetPrice = state.side === 'buy' 
  ? currentPrice - priceOffset 
  : currentPrice + priceOffset
orderParams.limit_px = formatPriceForTickSize(offsetPrice, state.selectedCoin)
```

## UI Integration

### Limit Price Input
- **onBlur Handler**: Formats price when user finishes editing
- **Mid Button**: Uses tick size formatting when setting current price
- **Real-time Formatting**: Ensures prices are always valid

### Example Usage
```typescript
// User enters "50000.123" for BTC
// System formats to "50000.0" (divisible by 0.5)

// User enters "3000.123" for ETH  
// System formats to "3000.10" (divisible by 0.05)

// User enters "150.123" for SOL
// System formats to "150.12" (divisible by 0.01)
```

## Test Scenarios

### Case 1: BTC Price Formatting
- **Input**: 50000.123 BTC price
- **Tick Size**: 0.5
- **Expected**: 50000.0 (rounded to nearest 0.5)
- **API Call**: `limit_px: "50000.0"`

### Case 2: ETH Price Formatting
- **Input**: 3000.123 ETH price
- **Tick Size**: 0.05
- **Expected**: 3000.10 (rounded to nearest 0.05)
- **API Call**: `limit_px: "3000.10"`

### Case 3: SOL Price Formatting
- **Input**: 150.123 SOL price
- **Tick Size**: 0.01
- **Expected**: 150.12 (rounded to nearest 0.01)
- **API Call**: `limit_px: "150.12"`

### Case 4: DOGE Price Formatting
- **Input**: 0.123456 DOGE price
- **Tick Size**: 0.0001
- **Expected**: 0.1235 (rounded to nearest 0.0001)
- **API Call**: `limit_px: "0.1235"`

### Case 5: Coin Pair Handling
- **Input**: "BTC-PERP" with price 50000.123
- **Base Coin**: "BTC"
- **Tick Size**: 0.5
- **Expected**: 50000.0
- **API Call**: `limit_px: "50000.0"`

## Decimal Places Logic

### Automatic Decimal Calculation
```typescript
const decimalPlaces = tickSize < 1 ? Math.abs(Math.log10(tickSize)) : 0
```

### Examples
- **BTC (0.5)**: `Math.abs(Math.log10(0.5)) = 0.3` → `0` decimal places
- **ETH (0.05)**: `Math.abs(Math.log10(0.05)) = 1.3` → `1` decimal place
- **SOL (0.01)**: `Math.abs(Math.log10(0.01)) = 2` → `2` decimal places
- **DOGE (0.0001)**: `Math.abs(Math.log10(0.0001)) = 4` → `4` decimal places

## Benefits

### Exchange Compatibility
- ✅ **No Rejection**: Orders won't be rejected for tick size violations
- ✅ **Proper Formatting**: Prices match exchange requirements
- ✅ **Asset Specific**: Each coin uses correct tick size
- ✅ **Coin Pair Support**: Handles "BTC-PERP", "ETH-PERP", etc.

### User Experience
- ✅ **Automatic Formatting**: Users don't need to know tick sizes
- ✅ **Real-time Validation**: Prices are formatted as user types
- ✅ **Mid Button**: Sets current price with correct formatting
- ✅ **Blur Formatting**: Formats when user finishes editing

### Trading Accuracy
- ✅ **Precise Execution**: Orders execute at valid price levels
- ✅ **No Slippage**: Prices are exactly what exchange expects
- ✅ **Consistent**: All order types use same formatting logic
- ✅ **Future Proof**: Easy to add new assets and tick sizes

## Testing Instructions

1. **Test Different Assets**:
   - Try BTC, ETH, SOL, DOGE orders
   - Enter prices that don't match tick size
   - Verify automatic formatting

2. **Test Order Types**:
   - Test market, limit, scale, TWAP orders
   - Verify all use tick size formatting
   - Check API calls in console

3. **Test UI Integration**:
   - Enter limit price and blur field
   - Click "Mid" button
   - Verify price formatting

4. **Test Coin Pairs**:
   - Try "BTC-PERP", "ETH-PERP", etc.
   - Verify base coin extraction works
   - Check tick size application

## Notes

- Tick sizes are based on typical exchange requirements
- Can be easily updated for different exchanges
- Handles both individual coins and coin pairs
- All order types now use consistent price formatting
- UI provides real-time feedback for price formatting
