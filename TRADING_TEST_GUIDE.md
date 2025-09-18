# Trading Interface Test Guide

## Overview
This guide helps you test the 4 different order types and understand what parameters are valid/invalid.

## Test Scenarios

### 1. Market Orders ✅
**Purpose**: Execute immediately at current market price

**Valid Test Cases**:
- Size: 100 USD
- Size: 0.001 BTC
- Side: Buy or Sell
- Leverage: 1x, 3x, 5x, 9x

**Invalid Test Cases**:
- Size: 0 (should show "Order size must be greater than 0")
- Size: 0.0001 (should show "Minimum order size is 0.001")
- Size: -100 (should be rejected)
- Size: empty (should be rejected)

### 2. Limit Orders ✅
**Purpose**: Execute at specified price or better

**Valid Test Cases**:
- Size: 100 USD, Limit Price: 50000
- Size: 0.01 BTC, Limit Price: 45000
- Buy order with limit price below market (good for buying)
- Sell order with limit price above market (good for selling)

**Invalid Test Cases**:
- Limit Price: 0 (should show "Limit price must be greater than 0")
- Limit Price: -1000 (should be rejected)
- Limit Price: empty (should be rejected)
- Size: 0 (should show "Order size must be greater than 0")

### 3. Scale Orders ✅
**Purpose**: Place multiple orders at different price levels

**Valid Test Cases**:
- Start Price: 52000, End Price: 48000, Order Count: 5
- Start Price: 100000, End Price: 90000, Order Count: 10
- Size: 1000 USD (distributed across orders)

**Invalid Test Cases**:
- Start Price: 48000, End Price: 52000 (should show "Start price must be higher than end price")
- Start Price: 0 (should show "Scale start price must be greater than 0")
- End Price: 0 (should show "Scale end price must be greater than 0")
- Order Count: 0 (should show "Scale order count must be greater than 0")
- Order Count: 25 (should show "Maximum 20 scale orders allowed")
- Order Count: -5 (should be rejected)

### 4. TWAP Orders ✅
**Purpose**: Execute orders over time to reduce market impact

**Valid Test Cases**:
- Running Time: 0 hours 30 minutes, Intervals: 10
- Running Time: 2 hours 0 minutes, Intervals: 20
- Running Time: 0 hours 5 minutes, Intervals: 5 (minimum)

**Invalid Test Cases**:
- Running Time: 0 hours 2 minutes (should show "Minimum TWAP running time is 5 minutes")
- Running Time: 25 hours 0 minutes (should show "Maximum TWAP running time is 24 hours")
- Intervals: 0 (should show "Number of intervals must be greater than 0")
- Intervals: 150 (should show "Maximum 100 intervals allowed")
- Hours: -1 (should be rejected)
- Minutes: -5 (should be rejected)

### 5. Take Profit / Stop Loss ✅
**Purpose**: Set automatic profit taking and loss limiting

**Valid Test Cases**:
- Take Profit: 10% gain, Stop Loss: 5% loss
- Take Profit: 5% gain, Stop Loss: 10% loss
- Custom prices: TP Price: 55000, SL Price: 45000

**Invalid Test Cases**:
- Take Profit: 0% (should show "Take profit gain must be between 0.01% and 1000%")
- Take Profit: 2000% (should show "Take profit gain must be between 0.01% and 1000%")
- Stop Loss: 0% (should show "Stop loss must be between 0.01% and 100%")
- Stop Loss: 150% (should show "Stop loss must be between 0.01% and 100%")
- TP Price: 0 (should show "Take profit price must be greater than 0")
- SL Price: -1000 (should be rejected)

## Testing Steps

### Step 1: Basic Validation
1. Try to place an order without entering size
2. Try to place an order with size = 0
3. Try to place an order with size = 0.0001
4. Verify error messages appear

### Step 2: Order Type Specific Testing
1. **Market Orders**: Test with valid sizes, verify no price input needed
2. **Limit Orders**: Test with valid/invalid prices
3. **Scale Orders**: Test price ranges and order counts
4. **TWAP Orders**: Test time ranges and interval counts

### Step 3: Edge Cases
1. Very large numbers (999999999)
2. Very small numbers (0.0000001)
3. Negative numbers
4. Empty fields
5. Special characters

### Step 4: Real-time Validation
1. Enter invalid data and watch validation errors appear
2. Fix the data and watch errors disappear
3. Try to submit with validation errors (button should be disabled)

## Expected Behavior

### ✅ Good Behavior
- Clear error messages
- Real-time validation feedback
- Submit button disabled when invalid
- Order previews show correct calculations
- Auto-calculation works (TP/SL percentages)

### ❌ Bad Behavior to Watch For
- Orders submitted with invalid data
- No error messages for invalid inputs
- Submit button enabled when it shouldn't be
- Crashes or freezes
- Incorrect calculations in previews

## Common Trading Mistakes to Test

1. **Wrong Price Direction**: 
   - Buy order with limit price above market (bad)
   - Sell order with limit price below market (bad)

2. **Extreme Leverage**: 
   - High leverage with large size (risky)

3. **Invalid TP/SL**: 
   - Take profit below entry price for buy orders
   - Stop loss above entry price for sell orders

4. **Scale Order Issues**:
   - Start price lower than end price
   - Too many orders (over 20)

5. **TWAP Issues**:
   - Too short time (under 5 minutes)
   - Too long time (over 24 hours)
   - Too many intervals (over 100)

## Success Criteria

✅ All invalid inputs show appropriate error messages
✅ Submit button is disabled when validation fails
✅ Real-time validation works correctly
✅ Order previews show accurate calculations
✅ No crashes or freezes with invalid data
✅ All 4 order types work with valid data

## Notes for Beginners

- **Market Orders**: Simplest, execute immediately
- **Limit Orders**: More control, set your price
- **Scale Orders**: For large orders, spread across price levels
- **TWAP Orders**: For large orders, spread across time
- **Take Profit**: Automatically sell when price goes up
- **Stop Loss**: Automatically sell when price goes down

Remember: Always test with small amounts first!
