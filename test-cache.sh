#!/bin/bash

# Test szDecimals cache functionality
echo "🧪 测试szDecimals缓存功能"
echo "================================================"

BASE_URL="http://localhost:3001"

echo "📡 服务器地址: $BASE_URL"
echo ""

# 1) Check cache status
echo "1. 检查szDecimals缓存状态:"
echo "----------------------------------------"
curl -s "$BASE_URL/api/szdecimals-cache" | jq '.' 2>/dev/null || echo "响应不是有效的JSON"
echo ""

# 2) Test a single coin
echo "2. 测试单个币种 (BTC):"
echo "----------------------------------------"
curl -s "$BASE_URL/api/asset-metadata/BTC" | jq '.' 2>/dev/null || echo "响应不是有效的JSON"
echo ""

# 3) Test PERP format
echo "3. 测试PERP格式 (BTC-PERP):"
echo "----------------------------------------"
curl -s "$BASE_URL/api/asset-metadata/BTC-PERP" | jq '.' 2>/dev/null || echo "响应不是有效的JSON"
echo ""

# 4) Test multiple coins
echo "4. 测试多个币种:"
echo "----------------------------------------"
for coin in ETH SOL DOGE AVAX; do
  echo "测试 $coin:"
  curl -s "$BASE_URL/api/asset-metadata/$coin" | jq '.szDecimals, .pxDecimals' 2>/dev/null || echo "失败"
  echo ""
done

# 5) Test cache performance
echo "5. 测试缓存性能 (连续请求):"
echo "----------------------------------------"
echo "连续请求BTC 5次，测试缓存速度:"
for i in {1..5}; do
  echo "请求 $i:"
  time curl -s "$BASE_URL/api/asset-metadata/BTC" > /dev/null
done

echo ""
echo "✅ 测试完成!"
echo ""
echo "💡 如果看到连接错误，请确保："
echo "   1. 服务器正在运行 (npm start 或 node server-new.js)"
echo "   2. SDK已正确初始化"
echo "   3. szDecimals缓存已加载"
