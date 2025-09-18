# Confirmation Popup Size Fix

## Issue Fixed
The confirmation popup was showing incorrect size format when USD was selected as the size unit.

## Problem
When USD was selected as the size unit, the confirmation popup was showing:
```
Size: 10 USD
```

But it should show the actual coin size that will be traded:
```
Size: 0.00020 BTC
```

## Root Cause
The size display logic in the confirmation popup was incorrectly showing the USD amount instead of the converted coin size.

## Solution
Fixed the size display logic to show the converted coin size when USD is selected:

```typescript
// BEFORE (Incorrect)
size: state.sizeUnit === 'USD' 
  ? `${state.size} USD` 
  : `${convertedSize || state.size} ${state.selectedCoin}`

// AFTER (Correct)
size: state.sizeUnit === 'USD' 
  ? `${convertedSize || state.size} ${state.selectedCoin}` 
  : `${state.size} ${state.selectedCoin}`
```

## Test Scenarios

### Case 1: USD Size Unit
- **Input**: Size "10", Size Unit "USD", BTC Price $50,000
- **Before**: Size: 10 USD
- **After**: Size: 0.00020 BTC
- **Expected**: Shows actual coin amount being traded

### Case 2: BTC Size Unit
- **Input**: Size "0.001", Size Unit "BTC"
- **Before**: Size: 0.001 BTC
- **After**: Size: 0.001 BTC
- **Expected**: Shows direct coin amount (no change)

### Case 3: ETH Size Unit
- **Input**: Size "0.1", Size Unit "ETH"
- **Before**: Size: 0.1 ETH
- **After**: Size: 0.1 ETH
- **Expected**: Shows direct coin amount (no change)

## Benefits

### User Clarity
- ✅ **Shows Actual Trade**: Users see exactly what coin amount will be traded
- ✅ **Consistent Format**: All sizes shown in coin units
- ✅ **No Confusion**: Clear what the order will execute

### Trading Accuracy
- ✅ **Matches API**: Confirmation shows same size sent to API
- ✅ **Precise Display**: Shows converted coin size with proper rounding
- ✅ **Coin-Specific**: Displays appropriate decimal places per coin

## Example Flows

### USD Order Flow
1. **User Input**: "10" USD
2. **Conversion**: 10 ÷ $50,000 = 0.00020 BTC
3. **Confirmation**: "Size: 0.00020 BTC"
4. **API Call**: `sz: "0.00020"`

### BTC Order Flow
1. **User Input**: "0.001" BTC
2. **No Conversion**: Direct BTC amount
3. **Confirmation**: "Size: 0.001 BTC"
4. **API Call**: `sz: "0.001"`

## Testing Instructions

1. **Test USD Size Unit**:
   - Select USD as size unit
   - Enter dollar amount (e.g., "10")
   - Click "Enable Trading"
   - Verify confirmation shows coin size (e.g., "0.00020 BTC")

2. **Test Coin Size Unit**:
   - Select coin as size unit (e.g., BTC)
   - Enter coin amount (e.g., "0.001")
   - Click "Enable Trading"
   - Verify confirmation shows same coin size

3. **Test Different Coins**:
   - Try BTC, ETH, SOL, DOGE
   - Test both USD and coin size units
   - Verify proper decimal formatting

## Notes

- Confirmation popup now shows actual coin size being traded
- USD amounts are converted to coin sizes for display
- Coin amounts are shown directly without conversion
- All sizes use proper decimal formatting based on coin type
- Matches the size sent to the API for execution
