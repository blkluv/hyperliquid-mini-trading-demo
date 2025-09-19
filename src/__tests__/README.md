# Trading Parameters Unit Tests

这些单元测试专注于验证交易参数收集和验证逻辑，不涉及UI/元素测试。

## 测试文件说明

### 1. `tradingParams.test.ts`
- 测试交易参数收集和验证的核心逻辑
- 验证不同订单类型的参数处理
- 测试USD到coin size的转换
- 验证币种特定的四舍五入规则

### 2. `orderValidation.test.ts`
- 测试订单参数验证逻辑
- 验证市场订单、限价订单、批量订单、TWAP订单的验证规则
- 测试边界情况和错误处理

### 3. `tradingFormData.test.ts`
- 测试表单数据处理逻辑
- 验证表单数据到交易参数的转换
- 测试表单验证规则

## 运行测试

```bash
# 安装测试依赖
npm install --save-dev vitest @vitest/ui jsdom

# 运行所有测试
npm run test

# 运行特定测试文件
npm run test tradingParams.test.ts

# 运行测试并生成覆盖率报告
npm run test:coverage

# 在UI模式下运行测试
npm run test:ui
```

## 测试覆盖的功能

### 参数收集
- ✅ 市场订单参数收集
- ✅ 限价订单参数收集
- ✅ 批量订单参数收集
- ✅ TWAP订单参数收集

### 参数验证
- ✅ 基本参数验证（币种、方向、大小、杠杆）
- ✅ 订单类型特定验证
- ✅ 边界值验证
- ✅ 错误消息验证

### 大小转换
- ✅ USD到coin size转换
- ✅ 币种特定四舍五入
- ✅ 边界情况处理

### 表单数据处理
- ✅ 表单数据到交易参数转换
- ✅ 表单验证规则
- ✅ 错误处理

## 测试用例示例

### 市场订单验证
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

### 批量订单验证
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

### 大小转换测试
```typescript
it('should convert USD to coin units correctly', () => {
  const result = TradingFormProcessor.convertSizeToCoinUnits('100', 'USD', 50000)
  expect(result).toBe(0.002)
})
```

## 注意事项

1. 这些测试不涉及UI组件，专注于业务逻辑
2. 测试覆盖了所有订单类型的参数处理
3. 包含了边界情况和错误处理测试
4. 验证了USD到coin size的转换逻辑
5. 测试了币种特定的四舍五入规则
