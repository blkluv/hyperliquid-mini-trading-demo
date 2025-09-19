# USD Validation Fix

## Issue Fixed
The validation logic was incorrectly calculating order value for USD size units, causing false "Minimum order value is $10 USD" errors.

## Problem
When size unit was USD, the validation was still multiplying by current price:
```typescript
// WRONG - Always multiplied by price
const orderValue = sizeValue * (currentPrice || 0)
```

## Solution
Fixed validation logic to handle USD vs coin units correctly:
```typescript
// CORRECT - USD uses size directly, coins multiply by price
const orderValue = state.sizeUnit === 'USD' 
  ? sizeValue  // For USD, order value is the size itself
  : sizeValue * (currentPrice || 0)  // For coin units, multiply by price
```

## Test Cases

### Case 1: USD Size Unit (Fixed)
- **Input**: Size "15", Size Unit "USD"
- **Before**: Order Value = 15 × $50,000 = $750,000 (wrong!)
- **After**: Order Value = $15.00 (correct!)
- **Validation**: Should pass (15 > 10)

### Case 2: BTC Size Unit (Still Works)
- **Input**: Size "0.001", Size Unit "BTC", Price $50,000
- **Order Value**: 0.001 × $50,000 = $50.00
- **Validation**: Should pass (50 > 10)

### Case 3: Small USD Amount (Should Fail)
- **Input**: Size "5", Size Unit "USD"
- **Order Value**: $5.00
- **Validation**: Should fail (5 < 10) - "Minimum order value is $10 USD"

## Fixed Validation Sections
1. **Minimum Order Value Check** (line ~174)
2. **Balance Validation** (line ~196)
3. **Leverage Validation** (line ~360)

## Verification
Test with:
- Size: "15", Size Unit: "USD" → Should pass validation
- Size: "5", Size Unit: "USD" → Should fail with minimum order value error
- Size: "0.001", Size Unit: "BTC" → Should pass (if BTC price > $10,000)

