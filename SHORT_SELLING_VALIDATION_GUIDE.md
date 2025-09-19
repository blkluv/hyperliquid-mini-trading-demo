# Short Selling Validation Test Guide

This guide covers all the validation scenarios for short selling in the trading interface.

## Overview

The system now validates short selling scenarios comprehensively, checking:
1. **Position Availability**: Whether user has sufficient position to sell
2. **Margin Requirements**: Whether user has enough margin for short selling
3. **Leverage Limits**: Maximum leverage allowed for short selling
4. **Minimum Margin**: Minimum margin requirements for short positions

## Test Scenarios

### 1. Regular Sell (User Has Position)

**Setup:**
- User has 1.0 BTC position
- Current BTC price: $50,000
- Available balance: $10,000

**Test Cases:**

#### Case 1.1: Sell Less Than Position
- **Input**: Sell 0.5 BTC
- **Expected**: ✅ No validation errors
- **Reason**: User has sufficient position

#### Case 1.2: Sell Exact Position
- **Input**: Sell 1.0 BTC
- **Expected**: ✅ No validation errors
- **Reason**: User has exact position needed

### 2. Short Sell (User Doesn't Have Position)

**Setup:**
- User has 0.0 BTC position
- Current BTC price: $50,000
- Available balance: $10,000
- Leverage: 10x

**Test Cases:**

#### Case 2.1: Short Sell with Sufficient Margin
- **Input**: Sell 0.1 BTC (value: $5,000)
- **Required Margin**: $5,000 / 10 = $500
- **Expected**: ✅ No validation errors
- **Reason**: User has sufficient margin ($10,000 > $500)

#### Case 2.2: Short Sell with Insufficient Margin
- **Input**: Sell 0.5 BTC (value: $25,000)
- **Required Margin**: $25,000 / 10 = $2,500
- **Expected**: ❌ "Insufficient margin for short sell. Required margin: $2,500.00, Available: $10,000.00"
- **Reason**: User has sufficient margin, but let's test with lower balance

#### Case 2.3: Short Sell with Very Low Balance
- **Setup**: Available balance: $100
- **Input**: Sell 0.1 BTC (value: $5,000)
- **Required Margin**: $5,000 / 10 = $500
- **Expected**: ❌ "Insufficient margin for short sell. Required margin: $500.00, Available: $100.00"

### 3. Partial Short Sell (User Has Some Position)

**Setup:**
- User has 0.3 BTC position
- Current BTC price: $50,000
- Available balance: $5,000
- Leverage: 10x

**Test Cases:**

#### Case 3.1: Sell More Than Position
- **Input**: Sell 0.5 BTC
- **Short Amount**: 0.5 - 0.3 = 0.2 BTC
- **Short Value**: 0.2 × $50,000 = $10,000
- **Required Margin**: $10,000 / 10 = $1,000
- **Expected**: ✅ No validation errors
- **Reason**: User has sufficient margin ($5,000 > $1,000)

#### Case 3.2: Sell Much More Than Position
- **Input**: Sell 1.0 BTC
- **Short Amount**: 1.0 - 0.3 = 0.7 BTC
- **Short Value**: 0.7 × $50,000 = $35,000
- **Required Margin**: $35,000 / 10 = $3,500
- **Expected**: ✅ No validation errors
- **Reason**: User has sufficient margin ($5,000 > $3,500)

### 4. Leverage Limits for Short Selling

**Setup:**
- User has 0.0 BTC position
- Current BTC price: $50,000
- Available balance: $10,000

**Test Cases:**

#### Case 4.1: High Leverage Short Sell
- **Input**: Leverage 25x, Sell 0.1 BTC
- **Expected**: ❌ "Maximum leverage for short selling is 20x"
- **Reason**: Leverage exceeds 20x limit for short selling

#### Case 4.2: Valid Leverage Short Sell
- **Input**: Leverage 15x, Sell 0.1 BTC
- **Expected**: ✅ No validation errors
- **Reason**: Leverage is within 20x limit

### 5. Minimum Margin Requirements

**Setup:**
- User has 0.0 BTC position
- Current BTC price: $50,000
- Available balance: $10,000
- Leverage: 10x

**Test Cases:**

#### Case 5.1: Very Small Short Sell
- **Input**: Sell 0.001 BTC (value: $50)
- **Required Margin**: $50 / 10 = $5
- **Expected**: ❌ "Minimum margin required for short selling is $50"
- **Reason**: Required margin is below $50 minimum

#### Case 5.2: Valid Small Short Sell
- **Input**: Sell 0.01 BTC (value: $500)
- **Required Margin**: $500 / 10 = $50
- **Expected**: ✅ No validation errors
- **Reason**: Required margin meets $50 minimum

### 6. Edge Cases

#### Case 6.1: Position Parsing Error
- **Setup**: currentPosition = "Invalid format"
- **Input**: Sell 0.1 BTC
- **Expected**: System assumes short sell and validates margin
- **Reason**: Fallback to margin validation when position can't be parsed

#### Case 6.2: Zero Position
- **Setup**: currentPosition = "0.00000 BTC"
- **Input**: Sell 0.1 BTC
- **Expected**: System treats as short sell and validates margin
- **Reason**: Zero position means short sell

## Validation Logic Summary

### For Buy Orders:
- ✅ Check available USD balance
- ✅ Ensure order value ≤ available balance

### For Sell Orders:
- ✅ **If size ≤ available position**: Regular sell (no additional validation)
- ✅ **If size > available position**: Short sell
  - Check margin requirements for short amount
  - Validate leverage limits (max 20x)
  - Validate minimum margin ($50)
- ✅ **If position can't be parsed**: Assume short sell and validate margin

## Error Messages

1. **Insufficient Margin**: "Insufficient margin for short sell. Required margin: $X, Available: $Y"
2. **Leverage Limit**: "Maximum leverage for short selling is 20x"
3. **Minimum Margin**: "Minimum margin required for short selling is $50"

## Testing Instructions

1. **Set up test scenarios** with different position sizes and balances
2. **Try each test case** by entering the specified inputs
3. **Verify error messages** appear for invalid scenarios
4. **Confirm no errors** for valid scenarios
5. **Test edge cases** like position parsing errors

## Notes

- Position data format: "X.XXXXX COIN" (e.g., "1.50000 BTC")
- Margin calculation: `(Short Value) / Leverage`
- Short value calculation: `(Sell Size - Available Position) × Current Price`
- All validations only show when the size field has been touched

