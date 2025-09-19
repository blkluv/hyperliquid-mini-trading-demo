# Leverage Validation Test Guide

This guide covers comprehensive leverage validation for all 4 order types (Market, Limit, Scale, TWAP) in the trading interface.

## Overview

The system now validates leverage rates comprehensively across all order types, considering:
1. **Order Type Specific Limits**: Different leverage limits for different order types
2. **Asset-Specific Limits**: Different leverage limits for different cryptocurrencies
3. **Side-Specific Limits**: Different limits for long vs short positions
4. **Margin Requirements**: Minimum margin requirements based on leverage
5. **Risk Management**: Progressive leverage restrictions for complex orders

## Leverage Limits by Order Type

### 1. Market Orders
- **Maximum Leverage**: 50x
- **Minimum Leverage**: 1x
- **Risk Level**: Standard

### 2. Limit Orders
- **Maximum Leverage**: 50x
- **Minimum Leverage**: 1x
- **Risk Level**: Standard

### 3. Scale Orders
- **Maximum Leverage**: 20x (risk management)
- **Minimum Leverage**: 1x
- **Additional Restrictions**:
  - >10 orders: Max 10x leverage
  - >15 orders: Max 5x leverage
- **Risk Level**: Conservative (multiple orders increase risk)

### 4. TWAP Orders
- **Maximum Leverage**: 15x (time exposure risk)
- **Minimum Leverage**: 1x
- **Additional Restrictions**:
  - >12 hours: Max 10x leverage
  - >24 hours: Max 5x leverage
- **Risk Level**: Conservative (time exposure increases risk)

## Asset-Specific Leverage Limits

- **BTC**: 50x maximum
- **ETH**: 40x maximum
- **SOL**: 30x maximum (more volatile)
- **Other Assets**: 50x maximum (default)

## Side-Specific Leverage Limits

- **Long Positions (Buy)**: Standard limits apply
- **Short Positions (Sell)**: Maximum 20x leverage

## Minimum Margin Requirements

- **20x+ Leverage**: Minimum $100 margin
- **30x+ Leverage**: Minimum $200 margin
- **40x+ Leverage**: Minimum $500 margin

## Test Scenarios

### 1. Market Order Leverage Tests

**Setup:**
- Order Type: Market
- Asset: BTC
- Order Value: $10,000
- Available Balance: $1,000

#### Case 1.1: Valid Market Order Leverage
- **Input**: 10x leverage
- **Required Margin**: $10,000 / 10 = $1,000
- **Expected**: ✅ No errors
- **Reason**: Within limits and sufficient margin

#### Case 1.2: Excessive Market Order Leverage
- **Input**: 60x leverage
- **Expected**: ❌ "Maximum leverage for market orders is 50x"
- **Reason**: Exceeds 50x limit

#### Case 1.3: Insufficient Margin for Market Order
- **Input**: 5x leverage
- **Required Margin**: $10,000 / 5 = $2,000
- **Available Balance**: $1,000
- **Expected**: ❌ "Insufficient margin for 5x leverage. Required: $2,000.00, Available: $1,000.00"

### 2. Limit Order Leverage Tests

**Setup:**
- Order Type: Limit
- Asset: BTC
- Order Value: $10,000
- Available Balance: $1,000

#### Case 2.1: Valid Limit Order Leverage
- **Input**: 10x leverage
- **Expected**: ✅ No errors
- **Reason**: Within 50x limit and sufficient margin

#### Case 2.2: Excessive Limit Order Leverage
- **Input**: 55x leverage
- **Expected**: ❌ "Maximum leverage for limit orders is 50x"

### 3. Scale Order Leverage Tests

**Setup:**
- Order Type: Scale
- Asset: BTC
- Order Value: $10,000
- Available Balance: $1,000

#### Case 3.1: Valid Scale Order Leverage
- **Input**: 10x leverage, 5 orders
- **Expected**: ✅ No errors
- **Reason**: Within 20x limit and sufficient margin

#### Case 3.2: Excessive Scale Order Leverage
- **Input**: 25x leverage, 5 orders
- **Expected**: ❌ "Maximum leverage for scale orders is 20x (risk management)"

#### Case 3.3: High Leverage with Many Orders
- **Input**: 15x leverage, 12 orders
- **Expected**: ❌ "Maximum 10x leverage allowed for scale orders with more than 10 orders"

#### Case 3.4: Very High Leverage with Many Orders
- **Input**: 8x leverage, 16 orders
- **Expected**: ❌ "Maximum 5x leverage allowed for scale orders with more than 15 orders"

### 4. TWAP Order Leverage Tests

**Setup:**
- Order Type: TWAP
- Asset: BTC
- Order Value: $10,000
- Available Balance: $1,000

#### Case 4.1: Valid TWAP Order Leverage
- **Input**: 10x leverage, 2 hours duration
- **Expected**: ✅ No errors
- **Reason**: Within 15x limit and sufficient margin

#### Case 4.2: Excessive TWAP Order Leverage
- **Input**: 20x leverage, 2 hours duration
- **Expected**: ❌ "Maximum leverage for TWAP orders is 15x (time exposure risk)"

#### Case 4.3: High Leverage with Long Duration
- **Input**: 15x leverage, 15 hours duration
- **Expected**: ❌ "Maximum 10x leverage for TWAP orders longer than 12 hours"

#### Case 4.4: Very High Leverage with Very Long Duration
- **Input**: 8x leverage, 25 hours duration
- **Expected**: ❌ "Maximum 5x leverage for TWAP orders longer than 24 hours"

### 5. Asset-Specific Leverage Tests

#### Case 5.1: BTC Leverage Limit
- **Asset**: BTC
- **Input**: 55x leverage
- **Expected**: ❌ "Maximum leverage for BTC is 50x"

#### Case 5.2: ETH Leverage Limit
- **Asset**: ETH
- **Input**: 45x leverage
- **Expected**: ❌ "Maximum leverage for ETH is 40x"

#### Case 5.3: SOL Leverage Limit
- **Asset**: SOL
- **Input**: 35x leverage
- **Expected**: ❌ "Maximum leverage for SOL is 30x"

### 6. Short Selling Leverage Tests

**Setup:**
- Side: Sell (Short)
- Asset: BTC
- Order Value: $10,000
- Available Balance: $1,000

#### Case 6.1: Valid Short Sell Leverage
- **Input**: 15x leverage
- **Expected**: ✅ No errors
- **Reason**: Within 20x short selling limit

#### Case 6.2: Excessive Short Sell Leverage
- **Input**: 25x leverage
- **Expected**: ❌ "Maximum leverage for short selling is 20x"

### 7. Minimum Margin Requirements Tests

**Setup:**
- Order Value: $10,000
- Available Balance: $50

#### Case 7.1: High Leverage with Low Margin
- **Input**: 25x leverage
- **Required Margin**: $10,000 / 25 = $400
- **Expected**: ❌ "Minimum margin required for 20x+ leverage is $100"

#### Case 7.2: Very High Leverage with Low Margin
- **Input**: 35x leverage
- **Required Margin**: $10,000 / 35 = $285.71
- **Expected**: ❌ "Minimum margin required for 30x+ leverage is $200"

#### Case 7.3: Extremely High Leverage with Low Margin
- **Input**: 45x leverage
- **Required Margin**: $10,000 / 45 = $222.22
- **Expected**: ❌ "Minimum margin required for 40x+ leverage is $500"

### 8. Edge Cases

#### Case 8.1: Zero Leverage
- **Input**: 0x leverage
- **Expected**: ❌ "Minimum leverage is 1x"

#### Case 8.2: Negative Leverage
- **Input**: -5x leverage
- **Expected**: ❌ "Minimum leverage is 1x"

#### Case 8.3: Very Small Order with High Leverage
- **Setup**: Order Value: $100, Available Balance: $5
- **Input**: 30x leverage
- **Required Margin**: $100 / 30 = $3.33
- **Expected**: ❌ "Minimum margin required for 30x+ leverage is $200"

## Validation Logic Summary

### Margin Calculation:
```
Required Margin = Order Value / Leverage
```

### Order Type Priority:
1. **Asset-specific limits** (BTC: 50x, ETH: 40x, SOL: 30x)
2. **Side-specific limits** (Short: 20x max)
3. **Order type limits** (Market/Limit: 50x, Scale: 20x, TWAP: 15x)
4. **Complex order restrictions** (Scale orders with many orders, TWAP with long duration)
5. **Minimum margin requirements** (based on leverage level)

### Error Message Priority:
1. Insufficient margin (most critical)
2. Asset-specific limits
3. Side-specific limits (short selling)
4. Order type limits
5. Complex order restrictions
6. Minimum margin requirements

## Testing Instructions

1. **Set up test scenarios** with different order types, assets, and balances
2. **Try each test case** by entering the specified leverage values
3. **Verify error messages** appear for invalid scenarios
4. **Confirm no errors** for valid scenarios
5. **Test edge cases** like zero leverage and very high leverage
6. **Test combinations** of order type + asset + side + leverage

## Notes

- All leverage validations only show when the size field has been touched
- Margin calculations use current market price for real-time validation
- Leverage limits are progressive (more restrictive for complex orders)
- Asset-specific limits override order type limits when more restrictive
- Short selling always has additional leverage restrictions

