#!/bin/bash

# Test coin name formatting issues
echo "🧪 测试币种名称格式问题"
echo "================================================"

# Server base URL
BASE_URL="http://localhost:3001"

echo "📡 服务器地址: $BASE_URL"
echo ""

# Test different coin name formats
echo "🔍 测试不同的币种名称格式:"
echo ""

# Test 1: Full format (BTC-PERP)
echo "1. 测试完整格式: BTC-PERP"
curl -s "$BASE_URL/api/asset-metadata/BTC-PERP" | jq '.' 2>/dev/null || echo "响应不是有效的JSON"
echo ""

# Test 2: Base format (BTC)
echo "2. 测试基础格式: BTC"
curl -s "$BASE_URL/api/asset-metadata/BTC" | jq '.' 2>/dev/null || echo "响应不是有效的JSON"
echo ""

# Test 3: ETH format
echo "3. 测试ETH格式: ETH-PERP"
curl -s "$BASE_URL/api/asset-metadata/ETH-PERP" | jq '.' 2>/dev/null || echo "响应不是有效的JSON"
echo ""

# Test 4: SOL format
echo "4. 测试SOL格式: SOL"
curl -s "$BASE_URL/api/asset-metadata/SOL" | jq '.' 2>/dev/null || echo "响应不是有效的JSON"
echo ""

# Test 5: List available coins
echo "5. 检查可用的币种列表:"
curl -s "$BASE_URL/api/meta" | jq '.universe[0:5] | .[] | {name: .name, szDecimals: .szDecimals, pxDecimals: .pxDecimals}' 2>/dev/null || echo "无法获取币种列表"
echo ""

echo "✅ 测试完成!"
echo ""
echo "💡 如果看到连接错误，请确保："
echo "   1. 服务器正在运行"
echo "   2. SDK已正确初始化"
echo "   3. 网络连接正常"
