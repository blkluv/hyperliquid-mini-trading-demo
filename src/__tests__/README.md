# Trading Parameters Unit Tests

These unit tests focus on validating trading parameter collection and validation logic, without involving UI/element testing.

## Test File Description

### 1. `tradingParams.test.ts`
- Tests core logic for trading parameter collection and validation
- Validates parameter handling for different order types
- Tests USD to coin size conversion
- Validates coin-specific rounding rules

### 2. `orderValidation.test.ts`
- Tests order parameter validation logic
- Validates market orders, limit orders, scale orders, TWAP orders validation rules
- Tests boundary conditions and error handling

### 3. `tradingFormData.test.ts`
- Tests form data processing logic
- Validates form data to trading parameter conversion
- Tests form validation rules

## Running Tests

```bash
# Install test dependencies
npm install --save-dev vitest @vitest/ui jsdom

# Run all tests
npm run test

# Run specific test file
npm run test tradingParams.test.ts

# Run tests and generate coverage report
npm run test:coverage

# Run tests in UI mode
npm run test:ui
```

## Test Coverage

### Parameter Collection
- ✅ Market order parameter collection
- ✅ Limit order parameter collection
- ✅ Scale order parameter collection
- ✅ TWAP order parameter collection

### Parameter Validation
- ✅ Basic parameter validation (coin, side, size, leverage)
- ✅ Order type specific validation
- ✅ Boundary value validation
- ✅ Error message validation

### Size Conversion
- ✅ USD to coin size conversion
- ✅ Coin-specific rounding
- ✅ Boundary condition handling

### Form Data Processing
- ✅ Form data to trading parameter conversion
- ✅ Form validation rules
- ✅ Error handling

## Test Case Examples

### Market Order Validation
```typescript
it('should validate valid market order', () => {
  const params = {
    coin: 'BTC-PERP',
    side: 'buy' as const,
    size: 0.001,
    leverage: 10,
    currentPrice: 50000
  }

  const result = OrderValidator.validateMarketOrder(params)
  expect(result.isValid).toBe(true)
  expect(result.errors).toHaveLength(0)
})
```

### Scale Order Validation
```typescript
it('should validate scale order parameters', () => {
  const params = {
    coin: 'BTC-PERP',
    side: 'buy' as const,
    size: 0.02,
    leverage: 10,
    startPrice: 48000,
    endPrice: 52000,
    orderCount: 5,
    sizeSkew: 2
  }

  const result = OrderValidator.validateScaleOrder(params)
  expect(result.isValid).toBe(true)
  expect(result.errors).toHaveLength(0)
})
```

### Size Conversion Test
```typescript
it('should convert USD to coin units correctly', () => {
  const result = TradingFormProcessor.convertSizeToCoinUnits('100', 'USD', 50000)
  expect(result).toBe(0.002)
})
```

## Notes

1. These tests do not involve UI components, focusing on business logic
2. Tests cover parameter handling for all order types
3. Includes boundary conditions and error handling tests
4. Validates USD to coin size conversion logic
5. Tests coin-specific rounding rules