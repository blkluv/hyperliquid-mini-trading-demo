#!/bin/bash

# Test /api/asset-metadata/{coin} API endpoint
# Make sure the server is running on localhost:3001

echo "🧪 测试 /api/asset-metadata/{coin} API端点"
echo "================================================"

# Coins to test
COINS=("BTC-PERP" "ETH-PERP" "SOL-PERP" "DOGE-PERP" "AVAX-PERP")

# Server base URL
BASE_URL="http://localhost:3001"

echo "📡 服务器地址: $BASE_URL"
echo ""

# Test each coin
for coin in "${COINS[@]}"; do
    echo "🔍 测试币种: $coin"
    echo "----------------------------------------"
    
    # Use curl to test the API
    curl -s -w "\nHTTP状态码: %{http_code}\n响应时间: %{time_total}s\n" \
         -H "Content-Type: application/json" \
         -H "Accept: application/json" \
         "$BASE_URL/api/asset-metadata/$coin" | jq '.' 2>/dev/null || echo "响应不是有效的JSON"
    
    echo ""
    echo "========================================"
    echo ""
done

echo "✅ 测试完成!"
echo ""
echo "💡 如果看到连接错误，请确保："
echo "   1. 服务器正在运行 (npm start 或 node server-new.js)"
echo "   2. 服务器运行在端口 3001"
echo "   3. SDK已正确初始化"
