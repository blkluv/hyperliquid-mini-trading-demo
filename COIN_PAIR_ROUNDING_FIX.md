# Coin Pair Rounding Fix

## Issue Fixed
The rounding logic was not working for coin pairs like "BTC-PERP" because it was only checking for exact matches like "BTC".

## Problem
```typescript
// BEFORE - Only matched exact coin names
switch (coin.toUpperCase()) {
  case 'BTC':  // This didn't match "BTC-PERP"
    return Math.ceil(rawSize * 100000) / 100000
}
```

## Solution
```typescript
// AFTER - Extract base coin from coin pair
const baseCoin = coin.toUpperCase().split('-')[0]  // "BTC-PERP" -> "BTC"

switch (baseCoin) {
  case 'BTC':  // Now matches "BTC-PERP"
    return Math.ceil(rawSize * 100000) / 100000
}
```

## Updated Logic

### 1. Rounding Function
```typescript
const convertUsdToCoinSize = (usdAmount: number, coinPrice: number, coin: string): number => {
  const rawSize = usdAmount / coinPrice
  
  // Extract base coin from coin pair (e.g., "BTC-PERP" -> "BTC")
  const baseCoin = coin.toUpperCase().split('-')[0]
  
  switch (baseCoin) {
    case 'DOGE': return Math.ceil(rawSize)
    case 'BTC': return Math.ceil(rawSize * 100000) / 100000
    case 'ETH': return Math.ceil(rawSize * 10000) / 10000
    case 'SOL': return Math.ceil(rawSize * 100) / 100
    default: return Math.ceil(rawSize * 1000000) / 1000000
  }
}
```

### 2. Display Formatting
```typescript
// Extract base coin from coin pair
const baseCoin = state.selectedCoin.toUpperCase().split('-')[0]

switch (baseCoin) {
  case 'BTC': return `${coinSize.toFixed(5)} ${state.selectedCoin}`  // "0.00009 BTC-PERP"
  case 'ETH': return `${coinSize.toFixed(4)} ${state.selectedCoin}`  // "0.0334 ETH-PERP"
  // etc.
}
```

### 3. Order Submission
```typescript
// Extract base coin from coin pair
const baseCoin = state.selectedCoin.toUpperCase().split('-')[0]

switch (baseCoin) {
  case 'BTC': return coinSize.toFixed(5)  // "0.00009"
  case 'ETH': return coinSize.toFixed(4)  // "0.0334"
  // etc.
}
```

## Test Cases

### Case 1: BTC-PERP
- **Input**: $15 USD, BTC-PERP price $50,000
- **Raw**: 15 ÷ 50,000 = 0.0003 BTC
- **Base Coin**: "BTC" (extracted from "BTC-PERP")
- **Rounded**: 0.0003 BTC (no change needed)
- **Display**: "0.00030 BTC-PERP"

### Case 2: ETH-PERP
- **Input**: $100 USD, ETH-PERP price $3,000
- **Raw**: 100 ÷ 3,000 = 0.033333... ETH
- **Base Coin**: "ETH" (extracted from "ETH-PERP")
- **Rounded**: 0.0334 ETH (rounded up to 0.0001)
- **Display**: "0.0334 ETH-PERP"

### Case 3: SOL-PERP
- **Input**: $50 USD, SOL-PERP price $150
- **Raw**: 50 ÷ 150 = 0.333333... SOL
- **Base Coin**: "SOL" (extracted from "SOL-PERP")
- **Rounded**: 0.34 SOL (rounded up to 0.01)
- **Display**: "0.34 SOL-PERP"

## Supported Coin Pairs

The fix now works for any coin pair format:
- ✅ **BTC-PERP** → Uses BTC rounding (5 decimals)
- ✅ **ETH-PERP** → Uses ETH rounding (4 decimals)
- ✅ **SOL-PERP** → Uses SOL rounding (2 decimals)
- ✅ **DOGE-PERP** → Uses DOGE rounding (0 decimals)
- ✅ **BTC-USDT** → Uses BTC rounding (5 decimals)
- ✅ **ETH-USDC** → Uses ETH rounding (4 decimals)

## Verification

**Before Fix:**
- "BTC-PERP" → Default rounding (6 decimals) → "0.000085 BTC-PERP"

**After Fix:**
- "BTC-PERP" → BTC rounding (5 decimals) → "0.00009 BTC-PERP"

The system now correctly identifies the base coin from any coin pair and applies the appropriate rounding rules!

