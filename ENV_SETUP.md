# Environment Variables Setup Guide

This guide explains how to set up environment variables for the Hyperliquid Trading Interface to keep your private keys secure.

## 🔐 Security First

**⚠️ IMPORTANT SECURITY NOTES:**
- Never commit your real private keys to version control
- Always use testnet for development
- Keep your `.env` file secure and never share it
- Use environment variables in production

## 📁 Files Overview

- `.env.example` - Template file with example values
- `.env` - Your actual environment variables (DO NOT COMMIT)
- `.gitignore` - Ensures `.env` is not committed to version control

## 🚀 Quick Setup

### 1. Copy the Example File

```bash
# Copy the example file to create your .env file
cp .env.example .env
```

### 2. Edit Your .env File

Open `.env` and replace the placeholder values with your actual values:

```bash
# Edit the .env file
nano .env
# or
code .env
# or
vim .env
```

### 3. Fill in Your Values

```env
# Replace with your actual private key (64 hex characters with 0x prefix)
PRIVATE_KEY=0xYOUR_ACTUAL_PRIVATE_KEY_HERE

# Network Configuration
USE_TESTNET=true

# Default Trading Coin
DEFAULT_COIN=BTC-PERP

# Server Configuration
PORT=3001

# API Configuration
API_URL=https://api.hyperliquid-testnet.xyz
```

## 🔧 Environment Variables Reference

### Required Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `PRIVATE_KEY` | Your wallet private key (64 hex chars with 0x) | `0x1234...abcd` | ✅ Yes |

### Optional Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `USE_TESTNET` | Use testnet (true) or mainnet (false) | `true` | `true` |
| `DEFAULT_COIN` | Default trading coin | `BTC-PERP` | `ETH-PERP` |
| `PORT` | Server port | `3001` | `3000` |
| `API_URL` | Hyperliquid API URL | Auto-detected | `https://api.hyperliquid-testnet.xyz` |

## 🛠️ Development Setup

### For Development (Recommended)

```env
# Always use testnet for development
PRIVATE_KEY=0xYOUR_TESTNET_PRIVATE_KEY
USE_TESTNET=true
DEFAULT_COIN=BTC-PERP
PORT=3001
```

### For Production (Advanced Users Only)

```env
# Only use mainnet if you know what you're doing
PRIVATE_KEY=0xYOUR_MAINNET_PRIVATE_KEY
USE_TESTNET=false
DEFAULT_COIN=BTC-PERP
PORT=3001
API_URL=https://api.hyperliquid.xyz
```

## 🔍 Verification

### Check Your Setup

1. **Verify .env file exists:**
   ```bash
   ls -la .env
   ```

2. **Check .env is in .gitignore:**
   ```bash
   grep -n "\.env" .gitignore
   ```

3. **Test server startup:**
   ```bash
   npm run dev
   # or
   node server.js
   ```

### Expected Output

If everything is set up correctly, you should see:

```
🚀 Server running on http://localhost:3001
📊 API endpoints available at http://localhost:3001/api
🌐 Network: testnet
```

## 🚨 Troubleshooting

### Common Issues

1. **"PRIVATE_KEY environment variable is required"**
   - Make sure your `.env` file exists
   - Check that `PRIVATE_KEY` is set in `.env`
   - Verify the private key format (64 hex characters with 0x prefix)

2. **"Cannot find module 'dotenv'"**
   - Install dotenv: `npm install dotenv`
   - Make sure you're in the project directory

3. **Server won't start**
   - Check that PORT is not already in use
   - Verify all required environment variables are set
   - Check the console for error messages

### Debug Commands

```bash
# Check if .env file exists
ls -la .env

# Check if .env is ignored by git
git status

# Test environment variable loading
node -e "require('dotenv').config(); console.log('PRIVATE_KEY:', process.env.PRIVATE_KEY ? 'Set' : 'Not set')"
```

## 🔒 Security Best Practices

### Do's ✅

- ✅ Use testnet for development
- ✅ Keep `.env` file secure
- ✅ Use strong, unique private keys
- ✅ Regularly rotate your keys
- ✅ Use environment variables in production

### Don'ts ❌

- ❌ Never commit `.env` to version control
- ❌ Never share your private keys
- ❌ Never use mainnet for development
- ❌ Never hardcode keys in source code
- ❌ Never use weak or predictable keys

## 📚 Additional Resources

- [Hyperliquid Documentation](https://hyperliquid.gitbook.io/hyperliquid/)
- [Environment Variables Best Practices](https://12factor.net/config)
- [Node.js dotenv Documentation](https://www.npmjs.com/package/dotenv)

## 🆘 Need Help?

If you're having trouble with environment variable setup:

1. Check the troubleshooting section above
2. Verify your `.env` file format
3. Make sure all required variables are set
4. Check the console for specific error messages

Remember: **Security first!** Always use testnet for development and keep your private keys secure.
