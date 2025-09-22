// Use API approach for better security and compatibility
import { hyperliquidAPI, OrderRequest, LeverageStatus, TwapOrderRequest, TwapTask } from '../api/hyperliquidApi'

export interface OrderParams {
  coin: string
  is_buy: boolean
  sz: string | number
  limit_px?: string | number
  order_type: {
    limit?: { 
      tif: 'Gtc' | 'Ioc' | 'Alo'
      tpsl?: {
        tp?: {
          triggerPx: string | number
          isMarket: boolean
        }
        sl?: {
          triggerPx: string | number
          isMarket: boolean
        }
      }
    }
    trigger?: {
      triggerPx: string | number
      isMarket: boolean
      tpsl: 'tp' | 'sl'
    }
  }
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

  async initialize(_privateKey: string, _testnet = false) {
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

  async placeOrder(orderParams: OrderParams | OrderParams[]) {
    if (!this.isInitialized) {
      throw new Error('Service not initialized')
    }

    try {
      // Handle both single order and order array
      if (Array.isArray(orderParams)) {
        // Convert array of OrderParams to array of OrderRequest
        const orderRequests: OrderRequest[] = orderParams.map(params => ({
          coin: params.coin,
          is_buy: params.is_buy,
          sz: params.sz,
          limit_px: params.limit_px,
          order_type: params.order_type,
          reduce_only: params.reduce_only,
          cloid: params.cloid
        }))
        
        const result = await hyperliquidAPI.placeOrder(orderRequests)
        return result
      } else {
        // Convert single OrderParams to OrderRequest format
        const orderRequest: OrderRequest = {
          coin: orderParams.coin,
          is_buy: orderParams.is_buy,
          sz: orderParams.sz,
          limit_px: orderParams.limit_px,
          order_type: orderParams.order_type,
          reduce_only: orderParams.reduce_only,
          cloid: orderParams.cloid
        }
        
        const result = await hyperliquidAPI.placeOrder(orderRequest)
        return result
      }
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

  async getLeverageStatus(address: string): Promise<LeverageStatus> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized')
    }
    
    try {
      const result = await hyperliquidAPI.getLeverageStatus(address)
      return result
    } catch (error) {
      console.error('Failed to get leverage status:', error)
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

  // TWAP order methods
  async placeTwapOrder(params: TwapOrderRequest): Promise<{ success: boolean; taskId: string; message: string; task: TwapTask }> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized')
    }

    try {
      const result = await hyperliquidAPI.placeTwapOrder(params)
      return result
    } catch (error) {
      console.error('Failed to place TWAP order:', error)
      throw error
    }
  }

  async getTwapTask(taskId: string): Promise<{ task: TwapTask }> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized')
    }

    try {
      const result = await hyperliquidAPI.getTwapTask(taskId)
      return result
    } catch (error) {
      console.error('Failed to get TWAP task:', error)
      throw error
    }
  }

  async getTwapTasks(): Promise<{ tasks: TwapTask[]; totalTasks: number; activeTasks: number; completedTasks: number; failedTasks: number }> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized')
    }

    try {
      const result = await hyperliquidAPI.getTwapTasks()
      return result
    } catch (error) {
      console.error('Failed to get TWAP tasks:', error)
      throw error
    }
  }

  async cancelTwapTask(taskId: string): Promise<{ success: boolean; message: string; taskId: string }> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized')
    }

    try {
      const result = await hyperliquidAPI.cancelTwapTask(taskId)
      return result
    } catch (error) {
      console.error('Failed to cancel TWAP task:', error)
      throw error
    }
  }

  async getLeverageInfo(coin: string) {
    try {
      const response = await fetch(`http://localhost:3001/api/leverage/${coin}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch leverage info: ${response.statusText}`)
      }
      return await response.json()
    } catch (error) {
      console.error('Error fetching leverage info:', error)
      // Return fallback data
      return {
        coin,
        maxLeverage: 20,
        marginTableId: 0,
        szDecimals: 5,
        pxDecimals: null,
        marginTable: {
          description: 'Fallback',
          marginTiers: [{ lowerBound: '0.0', maxLeverage: 20 }]
        },
        timestamp: new Date().toISOString()
      }
    }
  }

  isReady(): boolean {
    return this.isInitialized
  }
}

export const hyperliquidService = new HyperliquidService()
