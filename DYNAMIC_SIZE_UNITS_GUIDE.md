# Dynamic Size Units Test Guide

This guide covers the dynamic size unit functionality that adapts based on the selected coin.

## Overview

The size unit dropdown now dynamically shows:
1. **USD**: For dollar-based order sizing
2. **Selected Coin**: Shows the currently selected coin (BTC, ETH, SOL, etc.)

## Dynamic Behavior

### Size Unit Options
- **USD**: Always available for dollar-based orders
- **Coin Unit**: Dynamically changes based on `state.selectedCoin`
  - When BTC is selected → shows "BTC"
  - When ETH is selected → shows "ETH"  
  - When SOL is selected → shows "SOL"
  - etc.

### Auto-Update Logic
- When coin selection changes, if the current size unit is not USD, it automatically updates to the new coin
- If size unit is USD, it remains USD (user's choice is preserved)

## Order Value Calculations

### USD Size Unit
- **Input**: User enters dollar amount (e.g., "100")
- **Calculation**: Order Value = Size (direct USD amount)
- **Example**: Size "100" USD → Order Value "$100.00"

### Coin Size Unit  
- **Input**: User enters coin amount (e.g., "0.001")
- **Calculation**: Order Value = Size × Current Market Price
- **Example**: Size "0.001" BTC at $50,000 → Order Value "$50.00"

## UI Implementation

### Size Unit Dropdown
```typescript
<select value={state.sizeUnit} onChange={...}>
  <option value="USD">USD</option>
  <option value={state.selectedCoin}>{state.selectedCoin}</option>
</select>
```

### Order Value Calculation
```typescript
if (state.size && state.sizeUnit === 'USD' && isValidSize) {
  return `$${sizeValue.toFixed(2)}`
} else if (state.size && state.sizeUnit === state.selectedCoin && typeof topCardPrice === 'number' && isValidSize) {
  const value = sizeValue * topCardPrice
  return `$${value.toFixed(2)}`
}
```

## Test Scenarios

### 1. Dynamic Size Unit Display

#### Case 1.1: BTC Selected
- **Setup**: Select BTC from coin dropdown
- **Expected**: Size unit dropdown shows "USD" and "BTC"
- **Reason**: BTC is the selected coin

#### Case 1.2: ETH Selected  
- **Setup**: Select ETH from coin dropdown
- **Expected**: Size unit dropdown shows "USD" and "ETH"
- **Reason**: ETH is the selected coin

#### Case 1.3: SOL Selected
- **Setup**: Select SOL from coin dropdown
- **Expected**: Size unit dropdown shows "USD" and "SOL"
- **Reason**: SOL is the selected coin

### 2. Size Unit Auto-Update

#### Case 2.1: Coin Unit to Different Coin
- **Setup**: 
  1. Select BTC, choose "BTC" size unit
  2. Change coin to ETH
- **Expected**: Size unit automatically changes to "ETH"
- **Reason**: Non-USD size units auto-update to match selected coin

#### Case 2.2: USD Unit Preservation
- **Setup**:
  1. Select BTC, choose "USD" size unit  
  2. Change coin to ETH
- **Expected**: Size unit remains "USD"
- **Reason**: USD selection is preserved (user choice)

### 3. Order Value Calculations

#### Case 3.1: USD Size Unit
- **Setup**: 
  - Coin: BTC
  - Size Unit: USD
  - Size: "100"
- **Expected**: Order Value = "$100.00"
- **Calculation**: Direct USD amount

#### Case 3.2: BTC Size Unit
- **Setup**:
  - Coin: BTC  
  - Size Unit: BTC
  - Size: "0.001"
  - BTC Price: $50,000
- **Expected**: Order Value = "$50.00"
- **Calculation**: 0.001 × $50,000 = $50.00

#### Case 3.3: ETH Size Unit
- **Setup**:
  - Coin: ETH
  - Size Unit: ETH
  - Size: "0.1"
  - ETH Price: $3,000
- **Expected**: Order Value = "$300.00"
- **Calculation**: 0.1 × $3,000 = $300.00

### 4. Margin Required Calculations

#### Case 4.1: USD Size Unit
- **Setup**:
  - Size Unit: USD
  - Size: "100"
  - Leverage: 10x
- **Expected**: Margin Required = "$10.00"
- **Calculation**: $100 ÷ 10 = $10.00

#### Case 4.2: Coin Size Unit
- **Setup**:
  - Size Unit: BTC
  - Size: "0.001"
  - BTC Price: $50,000
  - Leverage: 10x
- **Expected**: Margin Required = "$5.00"
- **Calculation**: ($50.00 ÷ 10) = $5.00

### 5. Fee Calculations

#### Case 5.1: USD Size Unit
- **Setup**:
  - Size Unit: USD
  - Size: "100"
- **Expected**: Fees = "0.0100% / 0.0200%"
- **Calculation**: Based on $100 order value

#### Case 5.2: Coin Size Unit
- **Setup**:
  - Size Unit: BTC
  - Size: "0.001"
  - BTC Price: $50,000
- **Expected**: Fees = "0.0100% / 0.0200%"
- **Calculation**: Based on $50.00 order value

## Edge Cases

### Case 1: Invalid Size Input
- **Setup**: Enter non-numeric value
- **Expected**: Order Value shows "N/A"
- **Reason**: Invalid size cannot be calculated

### Case 2: Missing Market Price
- **Setup**: Coin size unit but no market price available
- **Expected**: Order Value shows "N/A"
- **Reason**: Cannot calculate without market price

### Case 3: Zero Size
- **Setup**: Enter "0" as size
- **Expected**: Order Value shows "N/A"
- **Reason**: Zero size is not valid

## State Management

### TradingState Interface
```typescript
interface TradingState {
  selectedCoin: string
  sizeUnit: 'USD' | string  // Dynamic coin support
  // ... other fields
}
```

### Auto-Update Effect
```typescript
useEffect(() => {
  if (state.sizeUnit !== 'USD') {
    setState(prev => ({ ...prev, sizeUnit: state.selectedCoin }))
  }
}, [state.selectedCoin])
```

## Benefits

### User Experience
- ✅ **Intuitive**: Size unit matches selected coin
- ✅ **Flexible**: Can choose USD or coin-based sizing
- ✅ **Consistent**: All calculations work with both units
- ✅ **Automatic**: No manual unit switching needed

### Trading Flexibility
- ✅ **USD Orders**: Direct dollar amount control
- ✅ **Coin Orders**: Precise coin quantity control
- ✅ **Dynamic**: Adapts to any supported coin
- ✅ **Accurate**: Real-time price calculations

## Testing Instructions

1. **Test Dynamic Display**:
   - Change coin selection
   - Verify size unit dropdown updates
   - Check that both USD and coin options are available

2. **Test Auto-Update**:
   - Select coin size unit
   - Change coin selection
   - Verify size unit auto-updates

3. **Test Calculations**:
   - Enter size with USD unit
   - Enter size with coin unit
   - Verify Order Value, Margin Required, and Fees calculate correctly

4. **Test Edge Cases**:
   - Invalid inputs
   - Zero values
   - Missing market data

## Notes

- Size unit dropdown dynamically shows the selected coin
- USD option is always available for dollar-based orders
- Non-USD size units automatically update when coin changes
- All calculations (Order Value, Margin, Fees) work with both units
- Input validation ensures only valid numeric values are accepted

