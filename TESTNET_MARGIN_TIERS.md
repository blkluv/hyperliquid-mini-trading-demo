# Hyperliquid 测试网保证金层级配置

基于 [Hyperliquid 官方文档](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/margin-tiers#testnet-margin-tiers) 的测试网保证金层级配置。

## 支持的币种和层级

### 1. BTC (测试网专用)
**名义头寸价值 (USDC)** | **最大杠杆**
---|---
0-10k | 40x
10k-50k | 25x
50k-100k | 10x
100k-300k | 5x
>300k | 3x

### 2. ETH (测试网专用)
**名义头寸价值 (USDC)** | **最大杠杆**
---|---
0-20k | 25x
20k-50k | 10x
50k-200k | 5x
>200k | 3x

### 3. DOGE, TIA, SUI, kSHIB, AAVE, TON (测试网专用)
**名义头寸价值 (USDC)** | **最大杠杆**
---|---
0-20k | 10x
20k-100k | 5x
>100k | 3x

### 4. LDO, ARB, MKR, ATOM, PAXG, TAO, ICP, AVAX, FARTCOIN (测试网专用)
**名义头寸价值 (USDC)** | **最大杠杆**
---|---
0-10k | 10x
>10k | 5x

## 维护杠杆计算

维护杠杆 = `2 × 最大杠杆`

### 示例计算

#### BTC 维护杠杆
- 0-10k USDC: 维护杠杆 = 2 × 40 = **80x**
- 10k-50k USDC: 维护杠杆 = 2 × 25 = **50x**
- 50k-100k USDC: 维护杠杆 = 2 × 10 = **20x**
- 100k-300k USDC: 维护杠杆 = 2 × 5 = **10x**
- >300k USDC: 维护杠杆 = 2 × 3 = **6x**

#### ETH 维护杠杆
- 0-20k USDC: 维护杠杆 = 2 × 25 = **50x**
- 20k-50k USDC: 维护杠杆 = 2 × 10 = **20x**
- 50k-200k USDC: 维护杠杆 = 2 × 5 = **10x**
- >200k USDC: 维护杠杆 = 2 × 3 = **6x**

## 代码使用示例

```typescript
import { getTestnetMarginTiers, getMaintenanceLeverageForCoin } from './utils/liquidationPrice'

// 获取 BTC 的测试网层级
const btcTiers = getTestnetMarginTiers('BTC')

// 计算 5k USDC 头寸的维护杠杆
const maintenanceLeverage = getMaintenanceLeverageForCoin('BTC', 5000, btcTiers)
// 结果: 80x (2 × 40)

// 计算 30k USDC 头寸的维护杠杆
const maintenanceLeverage2 = getMaintenanceLeverageForCoin('BTC', 30000, btcTiers)
// 结果: 50x (2 × 25)
```

## 注意事项

1. **测试网专用**: 这些层级仅适用于 Hyperliquid 测试网
2. **层级选择**: 根据头寸的名义价值自动选择对应的层级
3. **维护保证金比例**: `1 / (2 × 最大杠杆)`
4. **连续性**: 维护保证金扣除确保在不同层级间平滑过渡

## 支持的币种列表

### 高杠杆币种
- **BTC**: 最高 40x 杠杆
- **ETH**: 最高 25x 杠杆

### 中等杠杆币种
- **DOGE, TIA, SUI, kSHIB, AAVE, TON**: 最高 10x 杠杆

### 标准杠杆币种
- **LDO, ARB, MKR, ATOM, PAXG, TAO, ICP, AVAX, FARTCOIN**: 最高 10x 杠杆

所有配置都基于 [Hyperliquid 官方测试网文档](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/margin-tiers#testnet-margin-tiers)。
