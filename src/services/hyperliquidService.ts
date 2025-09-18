// Use API approach for better security and compatibility
import { hyperliquidAPI } from '../api/hyperliquidApi'

export interface OrderParams {
  coin: string
  is_buy: boolean
  sz: string | number
  limit_px?: string | number
  order_type: OrderType
  reduce_only: boolean
  cloid?: string
}

export interface LeverageParams {
  coin: string
  leverageMode: 'cross' | 'isolated'
  leverage: number
}

export interface MarginParams {
  coin: string
  isBuy: boolean
  ntli: number
}

class HyperliquidService {
  private isInitialized = false

  async initialize(privateKey: string, testnet = false) {
    try {
      // Check if server is running
      const response = await fetch('http://localhost:3001/api/health')
      if (!response.ok) {
        throw new Error('Server not running. Please start the server with: npm run dev:server')
      }
      
      this.isInitialized = true
      console.log('Hyperliquid API service initialized successfully')
    } catch (error) {
      console.error('Failed to initialize Hyperliquid API service:', error)
      throw error
    }
  }

  async placeOrder(orderParams: OrderParams) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized')
    }

    try {
      const result = await hyperliquidAPI.placeOrder(orderParams)
      return result
    } catch (error) {
      console.error('Failed to place order:', error)
      throw error
    }
  }

  async updateLeverage(params: LeverageParams) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized')
    }

    try {
      const result = await hyperliquidAPI.updateLeverage(params)
      return result
    } catch (error) {
      console.error('Failed to update leverage:', error)
      throw error
    }
  }

  async updateIsolatedMargin(params: MarginParams) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized')
    }

    try {
      const result = await hyperliquidAPI.updateIsolatedMargin(params)
      return result
    } catch (error) {
      console.error('Failed to update isolated margin:', error)
      throw error
    }
  }

  async getClearinghouseState(userAddress?: string) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized')
    }

    try {
      const result = await hyperliquidAPI.getClearinghouseState(userAddress)
      return result
    } catch (error) {
      console.error('Failed to get clearinghouse state:', error)
      throw error
    }
  }

  async getWalletBalance(userAddress?: string) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized')
    }

    try {
      const result = await hyperliquidAPI.getWalletBalance(userAddress)
      return result
    } catch (error) {
      console.error('Failed to get wallet balance:', error)
      throw error
    }
  }

  async getMeta() {
    if (!this.isInitialized) {
      throw new Error('Service not initialized')
    }

    try {
      const result = await hyperliquidAPI.getMeta()
      return result
    } catch (error) {
      console.error('Failed to get meta:', error)
      throw error
    }
  }

  async cancelAllOrders(coin?: string) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized')
    }

    try {
      const result = await hyperliquidAPI.cancelAllOrders(coin)
      return result
    } catch (error) {
      console.error('Failed to cancel all orders:', error)
      throw error
    }
  }

  async switchNetwork(network: 'testnet' | 'mainnet') {
    console.log('🔧 Service: Switching network to:', network)
    console.log('🔧 Service: Initialized?', this.isInitialized)
    
    if (!this.isInitialized) {
      throw new Error('Service not initialized')
    }

    try {
      const result = await hyperliquidAPI.switchNetwork(network)
      console.log('🔧 Service: Network switch successful:', result)
      return result
    } catch (error) {
      console.error('🔧 Service: Failed to switch network:', error)
      throw error
    }
  }

  async getHealth() {
    try {
      const result = await hyperliquidAPI.getHealth()
      return result
    } catch (error) {
      console.error('Failed to get health status:', error)
      throw error
    }
  }

  isReady(): boolean {
    return this.isInitialized
  }
}

export const hyperliquidService = new HyperliquidService()
