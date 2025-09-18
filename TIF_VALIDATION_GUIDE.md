# Time In Force (TIF) Validation Test Guide

This guide covers the Time In Force (TIF) options for limit orders in the trading interface.

## Overview

The system now supports three Time In Force options for limit orders:
1. **GTC (Good Till Canceled)**: Order remains active until filled or manually canceled
2. **IOC (Immediate Or Cancel)**: Order must be filled immediately or canceled
3. **ALO (Add Liquidity Only)**: Order only executes if it adds liquidity to the market

## TIF Options

### 1. GTC - Good Till Canceled
- **Description**: Order remains active until it's filled or manually canceled
- **Use Case**: Standard limit orders that you want to keep active
- **Behavior**: Order stays in the order book until filled
- **Default**: Yes (default selection)

### 2. IOC - Immediate Or Cancel
- **Description**: Order must be filled immediately or it's canceled
- **Use Case**: When you want immediate execution or no execution at all
- **Behavior**: Order is either filled immediately or canceled
- **Risk**: Partial fills are possible

### 3. ALO - Add Liquidity Only
- **Description**: Order only executes if it adds liquidity to the market
- **Use Case**: When you want to provide liquidity and get maker fees
- **Behavior**: Order only fills if it improves the market (doesn't take liquidity)
- **Benefit**: Potential maker fee rebates

## UI Implementation

### TIF Selection Dropdown
- **Location**: Below the limit price input field
- **Visibility**: Only shown when "Limit" order type is selected
- **Options**: 
  - GTC - Good Till Canceled
  - IOC - Immediate Or Cancel  
  - ALO - Add Liquidity Only
- **Default**: GTC selected by default

### Integration with Order Types
- **Market Orders**: Always use IOC (hardcoded)
- **Limit Orders**: Use selected TIF option
- **Scale Orders**: Always use GTC (hardcoded)
- **TWAP Orders**: Always use GTC (hardcoded)

## Test Scenarios

### 1. TIF Selection UI Tests

#### Case 1.1: TIF Dropdown Visibility
- **Setup**: Select "Limit" order type
- **Expected**: TIF dropdown appears below limit price input
- **Reason**: TIF is only relevant for limit orders

#### Case 1.2: TIF Dropdown Hidden for Market Orders
- **Setup**: Select "Market" order type
- **Expected**: TIF dropdown is not visible
- **Reason**: Market orders use IOC automatically

#### Case 1.3: TIF Dropdown Hidden for Scale Orders
- **Setup**: Select "Scale" order type
- **Expected**: TIF dropdown is not visible
- **Reason**: Scale orders use GTC automatically

#### Case 1.4: TIF Dropdown Hidden for TWAP Orders
- **Setup**: Select "TWAP" order type
- **Expected**: TIF dropdown is not visible
- **Reason**: TWAP orders use GTC automatically

### 2. TIF Selection Functionality Tests

#### Case 2.1: Default TIF Selection
- **Setup**: Select "Limit" order type
- **Expected**: GTC is pre-selected
- **Reason**: GTC is the default TIF option

#### Case 2.2: Change TIF to IOC
- **Setup**: Select "Limit" order type, change TIF to "IOC"
- **Expected**: IOC is selected
- **Reason**: User can change TIF selection

#### Case 2.3: Change TIF to ALO
- **Setup**: Select "Limit" order type, change TIF to "ALO"
- **Expected**: ALO is selected
- **Reason**: User can change TIF selection

#### Case 2.4: TIF Persistence
- **Setup**: Change TIF to IOC, then switch to Market, then back to Limit
- **Expected**: IOC is still selected
- **Reason**: TIF selection persists when switching order types

### 3. Order Submission Tests

#### Case 3.1: Limit Order with GTC
- **Setup**: Limit order, GTC selected, valid parameters
- **Expected**: Order submitted with GTC TIF
- **API Call**: `{ limit: { tif: 'Gtc' } }`

#### Case 3.2: Limit Order with IOC
- **Setup**: Limit order, IOC selected, valid parameters
- **Expected**: Order submitted with IOC TIF
- **API Call**: `{ limit: { tif: 'Ioc' } }`

#### Case 3.3: Limit Order with ALO
- **Setup**: Limit order, ALO selected, valid parameters
- **Expected**: Order submitted with ALO TIF
- **API Call**: `{ limit: { tif: 'Alo' } }`

### 4. Order Type Integration Tests

#### Case 4.1: Market Order TIF
- **Setup**: Market order, any TIF selection
- **Expected**: Order submitted with IOC TIF (ignores selection)
- **API Call**: `{ limit: { tif: 'Ioc' } }`
- **Reason**: Market orders always use IOC

#### Case 4.2: Scale Order TIF
- **Setup**: Scale order, any TIF selection
- **Expected**: All scale orders submitted with GTC TIF
- **API Call**: `{ limit: { tif: 'Gtc' } }`
- **Reason**: Scale orders always use GTC

#### Case 4.3: TWAP Order TIF
- **Setup**: TWAP order, any TIF selection
- **Expected**: All TWAP orders submitted with GTC TIF
- **API Call**: `{ limit: { tif: 'Gtc' } }`
- **Reason**: TWAP orders always use GTC

### 5. Edge Cases

#### Case 5.1: Invalid TIF Value
- **Setup**: Manually set invalid TIF value
- **Expected**: System defaults to GTC
- **Reason**: Fallback to safe default

#### Case 5.2: TIF Field Touch Tracking
- **Setup**: Change TIF selection
- **Expected**: 'timeInForce' field marked as touched
- **Reason**: Enables validation if needed

## API Integration

### TIF Mapping
```typescript
const tifMap = {
  'GTC': 'Gtc',  // Good Till Canceled
  'IOC': 'Ioc',  // Immediate Or Cancel
  'ALO': 'Alo'   // Add Liquidity Only
}
```

### Order Type Logic
```typescript
switch (orderType) {
  case 'market':
    return { limit: { tif: 'Ioc' } }  // Always IOC
  case 'limit':
    return { limit: { tif: tifMap[selectedTIF] } }  // User selected
  case 'scale':
    return { limit: { tif: 'Gtc' } }  // Always GTC
  case 'twap':
    return { limit: { tif: 'Gtc' } }  // Always GTC
}
```

## Validation Considerations

### Current Implementation
- ✅ TIF selection only shown for limit orders
- ✅ Default TIF is GTC
- ✅ TIF selection persists when switching order types
- ✅ Proper API mapping for all TIF options

### Future Enhancements
- 🔄 Add TIF-specific validation rules
- 🔄 Add TIF-specific fee information
- 🔄 Add TIF-specific order behavior warnings

## Testing Instructions

1. **Test UI Visibility**:
   - Select different order types
   - Verify TIF dropdown only appears for limit orders

2. **Test TIF Selection**:
   - Change TIF options
   - Verify selection persists
   - Verify default is GTC

3. **Test Order Submission**:
   - Submit orders with different TIF options
   - Verify correct TIF is sent to API
   - Check order behavior matches TIF selection

4. **Test Integration**:
   - Verify other order types ignore TIF selection
   - Verify proper TIF is used for each order type

## Notes

- TIF is only relevant for limit orders
- Market orders always use IOC for immediate execution
- Scale and TWAP orders always use GTC for order persistence
- TIF selection is stored in component state and persists across order type changes
- The TIF field is marked as touched when changed for potential validation
