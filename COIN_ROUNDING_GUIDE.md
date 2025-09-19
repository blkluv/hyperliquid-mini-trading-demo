# Coin-Specific Rounding Guide

This guide covers the coin-specific rounding rules for USD to coin size conversions.

## Overview

The system now applies different rounding rules based on the selected coin to ensure proper precision and trading compatibility.

## Rounding Rules

### DOGE (Dogecoin)
- **Rounding**: Round up to integer (whole numbers)
- **Display**: 0 decimal places
- **Example**: 123.7 DOGE → 124 DOGE

### BTC (Bitcoin)
- **Rounding**: Round up to 0.00001 (5 decimal places)
- **Display**: 5 decimal places
- **Example**: 0.000300123 BTC → 0.00031 BTC

### ETH (Ethereum)
- **Rounding**: Round up to 0.0001 (4 decimal places)
- **Display**: 4 decimal places
- **Example**: 0.0045678 ETH → 0.0046 ETH

### SOL (Solana)
- **Rounding**: Round up to 0.01 (2 decimal places)
- **Display**: 2 decimal places
- **Example**: 0.123456 SOL → 0.13 SOL

### Default (Other Coins)
- **Rounding**: Round up to 0.000001 (6 decimal places)
- **Display**: 6 decimal places
- **Example**: 0.0000001234567 → 0.000001

## Implementation Details

### Rounding Function
```typescript
const convertUsdToCoinSize = (usdAmount: number, coinPrice: number, coin: string): number => {
  const rawSize = usdAmount / coinPrice
  
  switch (coin.toUpperCase()) {
    case 'DOGE':
      return Math.ceil(rawSize)  // Round up to integer
    case 'BTC':
      return Math.ceil(rawSize * 100000) / 100000  // Round up to 0.00001
    case 'ETH':
      return Math.ceil(rawSize * 10000) / 10000    // Round up to 0.0001
    case 'SOL':
      return Math.ceil(rawSize * 100) / 100        // Round up to 0.01
    default:
      return Math.ceil(rawSize * 1000000) / 1000000 // Round up to 0.000001
  }
}
```

### Display Formatting
```typescript
switch (state.selectedCoin.toUpperCase()) {
  case 'DOGE':
    return `${coinSize.toFixed(0)} ${state.selectedCoin}`  // 0 decimals
  case 'BTC':
    return `${coinSize.toFixed(5)} ${state.selectedCoin}`  // 5 decimals
  case 'ETH':
    return `${coinSize.toFixed(4)} ${state.selectedCoin}`  // 4 decimals
  case 'SOL':
    return `${coinSize.toFixed(2)} ${state.selectedCoin}`  // 2 decimals
  default:
    return `${coinSize.toFixed(6)} ${state.selectedCoin}`  // 6 decimals
}
```

## Test Scenarios

### Case 1: DOGE Rounding
- **Input**: $10 USD, DOGE price $0.08
- **Raw Calculation**: 10 ÷ 0.08 = 125 DOGE
- **Rounded**: 125 DOGE (no change needed)
- **Display**: "125 DOGE"

- **Input**: $10 USD, DOGE price $0.09
- **Raw Calculation**: 10 ÷ 0.09 = 111.111... DOGE
- **Rounded**: 112 DOGE (rounded up)
- **Display**: "112 DOGE"

### Case 2: BTC Rounding
- **Input**: $15 USD, BTC price $50,000
- **Raw Calculation**: 15 ÷ 50,000 = 0.0003 BTC
- **Rounded**: 0.0003 BTC (no change needed)
- **Display**: "0.00030 BTC"

- **Input**: $15 USD, BTC price $49,000
- **Raw Calculation**: 15 ÷ 49,000 = 0.000306122... BTC
- **Rounded**: 0.00031 BTC (rounded up to 0.00001)
- **Display**: "0.00031 BTC"

### Case 3: ETH Rounding
- **Input**: $100 USD, ETH price $3,000
- **Raw Calculation**: 100 ÷ 3,000 = 0.033333... ETH
- **Rounded**: 0.0334 ETH (rounded up to 0.0001)
- **Display**: "0.0334 ETH"

### Case 4: SOL Rounding
- **Input**: $50 USD, SOL price $150
- **Raw Calculation**: 50 ÷ 150 = 0.333333... SOL
- **Rounded**: 0.34 SOL (rounded up to 0.01)
- **Display**: "0.34 SOL"

## API Integration

### Order Submission
The rounded coin size is passed to the API with appropriate precision:

```typescript
// DOGE order
sz: "124"  // Integer

// BTC order  
sz: "0.00031"  // 5 decimal places

// ETH order
sz: "0.0334"   // 4 decimal places

// SOL order
sz: "0.34"     // 2 decimal places
```

### Console Logging
```javascript
console.log('🎨 Component: Size conversion:', {
  originalSize: "15",
  sizeUnit: "USD",
  coinSize: 0.00031,        // Rounded value
  convertedSize: "0.00031", // Formatted for API
  orderType: "limit"
})
```

## Benefits

### Trading Compatibility
- ✅ **DOGE**: Integer amounts (no fractional DOGE)
- ✅ **BTC**: Precise to 0.00001 (standard BTC precision)
- ✅ **ETH**: Precise to 0.0001 (standard ETH precision)
- ✅ **SOL**: Precise to 0.01 (standard SOL precision)

### User Experience
- ✅ **Appropriate Precision**: Each coin shows relevant decimal places
- ✅ **Always Round Up**: Ensures minimum order size requirements
- ✅ **Clean Display**: No unnecessary trailing zeros

### Exchange Compatibility
- ✅ **Standard Precision**: Matches exchange requirements
- ✅ **No Rejection**: Orders won't be rejected for precision issues
- ✅ **Consistent**: Same rounding rules across all order types

## Edge Cases

### Case 1: Very Small USD Amounts
- **Input**: $0.50 USD, BTC price $50,000
- **Raw**: 0.50 ÷ 50,000 = 0.00001 BTC
- **Rounded**: 0.00001 BTC (already at minimum precision)
- **Result**: Valid order

### Case 2: High-Precision Coins
- **Input**: $1 USD, BTC price $100,000
- **Raw**: 1 ÷ 100,000 = 0.00001 BTC
- **Rounded**: 0.00001 BTC (minimum BTC precision)
- **Result**: Valid order

### Case 3: Low-Value Coins
- **Input**: $1 USD, DOGE price $0.001
- **Raw**: 1 ÷ 0.001 = 1000 DOGE
- **Rounded**: 1000 DOGE (integer)
- **Result**: Valid order

## Testing Instructions

1. **Test DOGE Rounding**:
   - Select DOGE, USD size unit
   - Enter amounts that result in fractional DOGE
   - Verify rounding up to integers

2. **Test BTC Rounding**:
   - Select BTC, USD size unit
   - Enter amounts that result in >5 decimal places
   - Verify rounding up to 0.00001 precision

3. **Test ETH Rounding**:
   - Select ETH, USD size unit
   - Enter amounts that result in >4 decimal places
   - Verify rounding up to 0.0001 precision

4. **Test SOL Rounding**:
   - Select SOL, USD size unit
   - Enter amounts that result in >2 decimal places
   - Verify rounding up to 0.01 precision

5. **Test Display Formatting**:
   - Verify each coin shows appropriate decimal places
   - Check that trailing zeros are handled correctly

## Notes

- All rounding uses `Math.ceil()` to always round up
- Rounding ensures minimum order size requirements are met
- Display formatting matches the rounding precision
- API calls use the same precision as the display
- Rounding rules can be easily extended for new coins

