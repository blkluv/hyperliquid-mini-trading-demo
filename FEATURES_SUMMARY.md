# 🚀 Hyperliquid Mini Demo - 功能总结

## 📋 概述

在对照hyperliquid官方interface后，完成了部分功能改进。这些改进提升了交易界面的用户体验和功能完整性。

## 🎯 核心功能模块

### 1. 📊 数字精度重构

**功能描述**: 完全重构了数字精度处理系统，创建了集中化的精度配置管理

**主要变更**:
- 创建了 `hyperliquidPrecisionConfig.js` 配置文件，包含所有币种的精度设置
- 支持PERP合约和SPOT现货的不同精度要求
- 实现了API优先、配置回退的精度获取机制

**测试示例**:
```javascript
// BTC-PERP: szDecimals=5, pxDecimals=0
"0.12345" ✅ 有效 (5位小数)
"0.123456" ❌ 无效 (超过5位小数)

// DOGE-PERP: szDecimals=0, pxDecimals=5  
"300" ✅ 有效 (整数)
"300.5" ❌ 无效 (不允许小数)
```

### 2. 🔢 12位数字输入限制

**功能描述**: 为所有数字输入字段添加了12位数字限制，防止用户输入过长的数字

**实现细节**:
- 创建了 `applyMaxDigitLimit()` 函数
- 支持整数和小数的智能截断
- 实时键盘输入限制

**测试示例**:
```javascript
"123123123123" ✅ 有效 (12位数字)
"123123123123123" ❌ 无效 (超过12位，会被截断为"123123123123")
"1234567890.12" ✅ 有效 (12位数字包含小数点)
"1234567890123.45" ❌ 无效 (超过12位)
```

### 3. ⚡ 动态杠杆

**功能描述**: 实现了从API获取实时杠杆信息的动态杠杆管理

**主要功能**:
- 创建了 `LeverageService` 类
- 支持5分钟缓存机制
- 提供回退杠杆数据
- 支持不同币种的不同杠杆等级

**测试示例**:
```javascript
// BTC杠杆等级
"$0-$10,000: 40x杠杆" ✅
"$10,000-$100,000: 20x杠杆" ✅  
"$100,000+: 10x杠杆" ✅

// ETH杠杆等级
"$0-$5,000: 25x杠杆" ✅
"$5,000-$50,000: 15x杠杆" ✅
"$50,000+: 8x杠杆" ✅
```

### 4. 🔄 智能单位转换

**功能描述**: 实现了USD和币种单位之间的智能转换，支持实时价格计算

**主要功能**:
- USD ↔ 币种单位自动转换
- 根据币种精度自动格式化
- 实时价格更新支持

**测试示例**:
```javascript
// USD转BTC (BTC价格$50,000)
"$100 USD" → "0.002 BTC" ✅
"$50,000 USD" → "1 BTC" ✅

// BTC转USD (BTC价格$50,000)  
"0.001 BTC" → "$50 USD" ✅
"1 BTC" → "$50,000 USD" ✅
```

### 5. 🎨 增强的UI组件

**功能描述**: 改进了交易界面的用户体验和视觉效果

**主要改进**:
- 自定义下拉选择器替换原生select
- 改进的输入验证和错误提示
- 更好的视觉反馈和状态管理

### 6. ✅ 输入验证

**功能描述**: 实现了全面的输入验证，包括实时验证和错误提示

**验证规则**:
- 价格输入: 必须为正数，符合币种精度要求
- 数量输入: 必须为正数，符合币种小数位数限制
- 杠杆输入: 1-10倍范围验证
- 订单数量: 2-20个订单验证

**测试示例**:
```javascript
// 价格验证
"50000" ✅ 有效 (BTC价格)
"50000.12" ❌ 无效 (BTC只允许1位小数)
"0" ❌ 无效 (必须大于0)
"-100" ❌ 无效 (必须为正数)

// 数量验证  
"1.23" ✅ 有效 (ETH支持2位小数)
"1.234" ❌ 无效 (ETH只允许2位小数)
"300" ✅ 有效 (DOGE整数)
"300.5" ❌ 无效 (DOGE不允许小数)
```

### 7. 🔧 服务器端错误处理

**功能描述**: 改进了服务器端错误消息的显示和处理

**主要改进**:
- 更好的错误消息格式化
- 用户友好的错误提示
- 改进的API错误处理

### 8. 💰 更新清算价格计算

**功能描述**: 全面对齐 Hyperliquid 的强平价计算逻辑：分级维持保证金、分级扣减、全仓/逐仓权益来源、迭代选层、以及入场参考价的优先级。

**主要更新**:
- 分级维持保证金与扣减（tiering）
  - 按 metaAndAssetCtxs 返回的 `marginTables` 解析每一层的最大维持杠杆 M，计算维持率 `l = 1 / (2*M)`
  - 叠加分级扣减 D，保证跨层连续：在每个阈值 `lowerBound` 处累加 `ΔD = lowerBound × (l_next − l_prev)`
  - 以名义 `|q|×P` 为自变量迭代选层（先选层→算 P，再检查是否换层→直到收敛）
- 权益来源（E）与 IM 回退对齐官方
  - 交叉（Cross）：优先用账户权益 `accountValue`；若不足以预估，回退到“初始保证金 IM”
  - 逐仓（Isolated）：用逐仓保证金；若未给出，以 `IM = |q|×P0 / leverage` 计算
  - IM 回退修正：使用“入场名义所在分级的允许最大杠杆”约束 `leverageForIM = min(用户选择杠杆, 分级允许杠杆)`，使 IM 与官方开仓约束一致（例如 ETH 名义≥50K 时，IM 按 5x 而非 10x 计算）
- 入场参考价优先级（用于强平计算）
  - 优先使用 `midPx` → 其次 `oraclePx` → 最后使用流中的 `markPx`（服务端已发布三者）
- 价格源与推流
  - 服务器从 `metaAndAssetCtxs` 提供 `markPx / midPx / oraclePx`，并以 `markPx` 为主价发布到 `/api/prices` 和 SSE `/api/price-stream`
- UI 行为
  - 强平价仅显示结果，去除“Equity used / Maint tier / Deduction”明细行（应请求）
  - 杠杆滑块的“用户偏好”与“持仓杠杆”解耦：若有持仓，UI 显示持仓实际杠杆，但不覆盖本地偏好（刷新不再回退）
- 调试/核对能力
  - 支持 `window.__LIQ_EQUITY_OVERRIDE = <number>`（仅 Cross）用于对齐官方 UI 的演示值

**公式与实现要点**:
- 多头强平（含扣减）：`P = (q·P0 − (E + D)) / (q·(1 − l))`
- 空头强平：`P = (q·P0 + (E + D)) / (q·(1 + l))`
- 逐层扣减：`D = Σ(lowerBound_i × (l_i − l_{i−1}))`
- 迭代：以 `|q|·P` 判断层级，更新 `l、D`，直到价格与层级一致

**对齐示例**:
- ETH-PERP，22 ETH 多，Cross，10x，入场 4199.0：
  - 分级：名义≥50K → `l=0.10`，`D=3100`
  - IM 回退使用层级允许杠杆 5x：`IM ≈ 18,475.6` → 强平价 ≈ `3,575.9`（与官方一致）
- BTC-PERP，10 BTC 多，Cross，10x，入场 113,258：
  - 分级：名义≥50K → `l=0.05`，`D=1575`
  - IM 回退按 10x：`IM=11,325.8` → 强平价 ≈ `107,132`；若官方 UI 用不同入场参考（mid/oracle），会产生 ±0.1% 的微小差异

**注意**:
- 强平价是“参考值”，实际撮合与标记、预防机制等可能导致官方 UI 与本地预估存在数十美金以内的漂移；已通过“优先 midPx/次要 oraclePx/最终 markPx”的顺序尽量对齐。

### 9. 💵 Available to Trade 余额显示

**功能描述**: 实现了可用交易余额的实时显示和计算

**主要功能**:
- 实时显示可用交易余额
- 考虑当前持仓和保证金要求
- 支持USD和币种单位显示
- 余额不足时的警告提示

**测试示例**:
```javascript
// 可用余额显示
"Available to Trade: $1,000" ✅
"Available to Trade: $0" ⚠️ (余额不足)
"Available to Trade: $50,000" ✅ (充足余额)
```

### 10. 🔄 保证金模式切换

**功能描述**: 实现了交叉保证金和逐仓保证金模式之间的切换

**主要功能**:
- 支持isolated和cross模式切换
- 自动保存用户偏好设置
- 切换时的数据验证和错误处理
- 持仓状态检查

**测试示例**:
```javascript
// 保证金模式切换
"Cross Margin" ↔ "Isolated Margin" ✅
"切换成功: Margin mode updated to isolated" ✅
"无法切换: 请先平仓所有持仓" ⚠️
```

### 11. 💎 订单价值计算和验证

**功能描述**: 实现了订单价值的实时计算和最小订单价值验证

**主要功能**:
- 实时计算订单USD价值
- 最小订单价值验证 ($10 USD)
- 子订单价值验证 (Scale/TWAP订单)
- 订单价值显示和警告

**测试示例**:
```javascript
// 订单价值验证
"Order Value: $100" ✅ (超过$10最小值)
"Order Value: $5" ❌ (低于$10最小值)
"Sub-order Value: $15" ✅ (子订单超过$10)
"Sub-order Value: $8" ❌ (子订单低于$10)
```

### 12. 🔒 Reduce Only 订单验证

**功能描述**: 实现了Reduce Only订单的智能验证，防止增加持仓

**主要功能**:
- 检查Reduce Only订单是否会增加持仓
- 验证可平仓数量
- 智能错误提示
- 支持多头和空头持仓

**测试示例**:
```javascript
// Reduce Only 验证
"当前持仓: +0.5 BTC, 卖出: 0.3 BTC (Reduce Only)" ✅
"当前持仓: +0.5 BTC, 卖出: 0.8 BTC (Reduce Only)" ❌ (超过持仓)
"当前持仓: -0.5 BTC, 买入: 0.3 BTC (Reduce Only)" ✅
"当前持仓: -0.5 BTC, 买入: 0.8 BTC (Reduce Only)" ❌ (超过持仓)
```

### 13. 📈 持仓大小计算和显示

**功能描述**: 实现了持仓大小的精确计算和格式化显示

**主要功能**:
- 支持多币种持仓大小计算
- 使用Hyperliquid精度配置
- 持仓方向显示 (多头/空头)
- 实时持仓更新

**测试示例**:
```javascript
// 持仓大小显示
"Current Position: 0.12345 BTC (Long)" ✅
"Current Position: 1.23 ETH (Short)" ✅
"Current Position: 300 DOGE (Long)" ✅
```

### 14. 🏦 保证金要求计算

**功能描述**: 实现了基于杠杆的保证金要求计算

**主要功能**:
- 动态计算所需保证金
- 支持不同杠杆等级
- 保证金不足警告
- 实时保证金更新

**测试示例**:
```javascript
// 保证金要求计算
"订单价值: $1,000, 杠杆: 10x" → "所需保证金: $100" ✅
"订单价值: $1,000, 杠杆: 5x" → "所需保证金: $200" ✅
"可用余额: $50, 所需保证金: $100" → "保证金不足" ⚠️
```

### 15. 🧮 Liquidation Math & Price Precision (Summary)

Liquidation price (our implementation)
- Long: p = (q·p0 − (E + d)) / (q·(1 − l))
- Short: p = (q·p0 + (E + d)) / (q·(1 + l))
- Terms:
  - q: absolute position size (in coin)
  - p0: entry price used by the ticket (limit if set, else current)
  - l: maintenance margin fraction from the active tier
  - d: tier deduction to keep piecewise maintenance continuous
  - E: equity used
- Equity used (E):
  - Cross: E = max(accountValue, IM)
    - IM (initial margin) = q·p0 / leverage
    - Optional dev override: window.__LIQ_EQUITY_OVERRIDE or localStorage 'LIQ_EQUITY_OVERRIDE' (still floored to IM)
  - Isolated: E = isolatedMargin (if not provided, we compute IM)
- Tier selection (l, d):
  - We build a maintenance schedule from margin tiers. For a tier with maxLeverage Lmax, l = 1 / (2·Lmax)
  - Deduction is cumulative to ensure continuity across tiers: d_i = d_{i−1} + lowerBound_i · (l_i − l_{i−1}), with d_0 = 0
  - Because l and d depend on notional at the liquidation price (|p|·q), we iteratively solve (up to 8 iterations) until the tier and price stabilize
- Data sources we use:
  - accountValue, totalMarginUsed from /api/wallet-balance (server proxies SDK marginSummary)
  - availableToTrade = accountValue − totalMarginUsed (used as walletBalance in inputs)
  - Margin tiers from /api/leverage/:coin, with a conservative fallback if unavailable
- What the UI shows:
  - Alongside the liquidation price, we display: "Equity used: $… · Maint tier: …x (l=…) · Deduction: $…"

Price decimals and tick alignment
- MAX_DECIMALS: perp=6, spot=8
- pxDecimals = MAX_DECIMALS − szDecimals (per asset). szDecimals comes from precision config/API
- Validation rules (client utils):
  - At most 5 significant digits for prices (integer prices are exempt)
  - Decimal places must not exceed pxDecimals
- Formatting/alignment:
  - We format to the tick grid implied by pxDecimals and round up (ceil) to meet exchange rules
  - ETH display UX: keep at least one decimal (e.g., "1234.0")
  - If tick-size derivation is not available, we fall back to the rule-based pxDecimals above
- Examples:
  - ETH-PERP (szDecimals=4 ⇒ pxDecimals=2): 4183.711 → 4183.72
  - BTC-PERP (szDecimals=5 ⇒ pxDecimals=1): 30000.04 → 30000.1

### 16. 🧪 Take Profit / Stop Loss 优化

🔧 核心功能
双单位支持: 百分比(%) 和 美元($)单位 (TODO)，可通过下拉菜单切换
智能计算: 输入gain/loss自动计算对应TP/SL价格
杠杆感知: 自动考虑当前杠杆倍数和交易方向

🛡️ 验证控制
数字限制: 所有值不超过12位数字
精度遵循: TP/SL价格严格遵循币种小数精度
输入验证: Gain/loss限2位小数，USD值限$1M以内

📊 计算逻辑
百分比模式: 价格 = 参考价格 × (1 ± 百分比/杠杆)
参考价格: 优先使用限价单价格，否则使用市价



### 16. 🧪 全面的测试覆盖

**功能描述**: 为所有新功能添加了完整的测试用例

**测试覆盖**:
- 输入验证测试
- 精度处理测试  
- 杠杆服务测试
- 清算价格计算测试

### 17. 📚 文档和配置管理

**功能描述**: 创建了详细的文档和配置文件

**文档包括**:
- `PRECISION_REFACTOR_SUMMARY.md` - 精度重构总结
- `hyperliquidPrecisionConfig.js` - 精度配置文件
- 测试脚本和API测试工具


### 18. 📡 Price Feed Update (Server)

- server-new.js: fetchPrices now uses `infoClient.metaAndAssetCtxs()` instead of `allMids()`.
- For each asset, we set `price = markPx ?? midPx ?? oraclePx` and also include all three in the payload.
- Previously, the stream used only mid prices from `allMids`; this change aligns displayed prices closer to the official app (which uses mark), reducing downstream discrepancies in UI displays and calculations.



## 🚀 下一步计划

1. 添加更多币种支持
2. 添加更多order type 支持
2. 优化移动端体验
3. 增加更多订单类型
4. 提升性能优化
5. 增加更多风险控制功能
6. Rich api response via using official python SDK
7. ADD USD as unit impl for Take Profit / Stop Loss
