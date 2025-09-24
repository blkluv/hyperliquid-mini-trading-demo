# Hyperliquid 主网保证金层级配置

基于 [Hyperliquid 官方文档](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/margin-tiers#mainnet-margin-tiers) 的主网保证金层级配置。

## 支持的币种和层级

### 1. BTC
**名义头寸价值 (USDC)** | **最大杠杆** | **维护杠杆**
---|---|---
0-150M | 40x | 80x
>150M | 20x | 40x

### 2. ETH
**名义头寸价值 (USDC)** | **最大杠杆** | **维护杠杆**
---|---|---
0-100M | 25x | 50x
>100M | 15x | 30x

### 3. SOL
**名义头寸价值 (USDC)** | **最大杠杆** | **维护杠杆**
---|---|---
0-70M | 20x | 40x
>70M | 10x | 20x

### 4. XRP
**名义头寸价值 (USDC)** | **最大杠杆** | **维护杠杆**
---|---|---
0-40M | 20x | 40x
>40M | 10x | 20x

### 5. DOGE, kPEPE, SUI, WLD, TRUMP, LTC, ENA, POPCAT, WIF, AAVE, kBONK, LINK, CRV, AVAX, ADA, UNI, NEAR, TIA, APT, BCH, HYPE, FARTCOIN
**名义头寸价值 (USDC)** | **最大杠杆** | **维护杠杆**
---|---|---
0-20M | 10x | 20x
>20M | 5x | 10x

### 6. OP, ARB, LDO, TON, MKR, ONDO, JUP, INJ, kSHIB, SEI, TRX, BNB, DOT
**名义头寸价值 (USDC)** | **最大杠杆** | **维护杠杆**
---|---|---
0-3M | 10x | 20x
>3M | 5x | 10x

## 维护杠杆计算

维护杠杆 = `2 × 最大杠杆`

### 示例计算

#### BTC 维护杠杆
- 0-150M USDC: 维护杠杆 = 2 × 40 = **80x**
- >150M USDC: 维护杠杆 = 2 × 20 = **40x**

#### ETH 维护杠杆
- 0-100M USDC: 维护杠杆 = 2 × 25 = **50x**
- >100M USDC: 维护杠杆 = 2 × 15 = **30x**

#### SOL 维护杠杆
- 0-70M USDC: 维护杠杆 = 2 × 20 = **40x**
- >70M USDC: 维护杠杆 = 2 × 10 = **20x**

## 代码使用示例

```typescript
import { getMainnetMarginTiers, getMaintenanceLeverageForCoin } from './utils/liquidationPrice'

// 获取 BTC 的主网层级
const btcTiers = getMainnetMarginTiers('BTC')

// 计算 50M USDC 头寸的维护杠杆
const maintenanceLeverage = getMaintenanceLeverageForCoin('BTC', 50_000_000, btcTiers)
// 结果: 80x (2 × 40)

// 计算 200M USDC 头寸的维护杠杆
const maintenanceLeverage2 = getMaintenanceLeverageForCoin('BTC', 200_000_000, btcTiers)
// 结果: 40x (2 × 20)
```

## 支持的币种列表

### 高杠杆币种
- **BTC**: 最高 40x 杠杆 (0-150M USDC)
- **ETH**: 最高 25x 杠杆 (0-100M USDC)

### 中等杠杆币种
- **SOL**: 最高 20x 杠杆 (0-70M USDC)
- **XRP**: 最高 20x 杠杆 (0-40M USDC)

### 标准杠杆币种 (20M USDC 阈值)
- **DOGE, kPEPE, SUI, WLD, TRUMP, LTC, ENA, POPCAT, WIF, AAVE, kBONK, LINK, CRV, AVAX, ADA, UNI, NEAR, TIA, APT, BCH, HYPE, FARTCOIN**: 最高 10x 杠杆

### 低杠杆币种 (3M USDC 阈值)
- **OP, ARB, LDO, TON, MKR, ONDO, JUP, INJ, kSHIB, SEI, TRX, BNB, DOT**: 最高 10x 杠杆

## 注意事项

1. **主网专用**: 这些层级仅适用于 Hyperliquid 主网
2. **层级选择**: 根据头寸的名义价值自动选择对应的层级
3. **维护保证金比例**: `1 / (2 × 最大杠杆)`
4. **连续性**: 维护保证金扣除确保在不同层级间平滑过渡
5. **大额头寸**: 主网支持更大的头寸规模，层级阈值比测试网高得多

## 与测试网的区别

| 币种 | 主网最大杠杆 | 测试网最大杠杆 | 主网阈值 | 测试网阈值 |
|------|-------------|---------------|----------|-----------|
| BTC | 40x | 40x | 150M USDC | 10k USDC |
| ETH | 25x | 25x | 100M USDC | 20k USDC |
| SOL | 20x | N/A | 70M USDC | N/A |

所有配置都基于 [Hyperliquid 官方主网文档](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/margin-tiers#mainnet-margin-tiers)。
