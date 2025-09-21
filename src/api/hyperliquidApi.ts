// Server-side API for Hyperliquid SDK
// This approach is more secure as private keys stay on the server

export interface OrderRequest {
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

// Support for order arrays (TP/SL grouping)
export type OrderRequestArray = OrderRequest[]

export interface LeverageStatus {
  address: string
  positions: Array<{
    coin: string
    coinKey: string
    leverage: number
    leverageType: 'cross' | 'isolated'
    positionSize: string
    canSwitchMode: boolean
    message: string
  }>
  summary: {
    totalPositions: number
    crossPositions: number
    isolatedPositions: number
    canSwitchMode: boolean
    message: string
  }
}

export interface TwapOrderRequest {
  coin: string
  is_buy: boolean
  totalSize: number
  intervals: number
  durationMinutes: number
  orderType?: 'market' | 'limit'
  priceOffset?: number
  reduceOnly?: boolean
}

export interface TwapTask {
  id: string
  coin: string
  is_buy: boolean
  totalSize: number
  intervals: number
  durationMinutes: number
  orderType: string
  priceOffset: number
  reduceOnly: boolean
  status: 'active' | 'completed' | 'failed' | 'cancelled'
  createdAt: number
  completedAt?: number
  completedOrders: number
  failedOrders: number
  results: Array<{
    orderIndex: number
    result?: any
    error?: string
    executedAt: number
    size: string
  }>
  subOrderSize: string
  subOrderSizes?: string[]
  sizePrecision?: number
  minOrderSize?: number
}

export interface LeverageRequest {
  coin: string
  leverageMode: 'cross' | 'isolated'
  leverage: number
}

export interface MarginRequest {
  coin: string
  isBuy: boolean
  ntli: number
}

class HyperliquidAPI {
  private baseUrl: string

  constructor(baseUrl = 'http://localhost:3001/api') {
    this.baseUrl = baseUrl
  }

  async placeOrder(order: OrderRequest | OrderRequestArray) {
    const response = await fetch(`${this.baseUrl}/place-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order)
    })
    
    if (!response.ok) {
      try {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      } catch (parseError) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    }
    
    return response.json()
  }

  async updateLeverage(params: LeverageRequest) {
    const response = await fetch(`${this.baseUrl}/update-leverage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }
    
    return response.json()
  }

  async getLeverageStatus(address: string): Promise<LeverageStatus> {
    const response = await fetch(`${this.baseUrl}/leverage-status/${address}`)
    
    if (!response.ok) {
      try {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      } catch (parseError) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    }
    
    return response.json()
  }

  async placeTwapOrder(params: TwapOrderRequest): Promise<{ success: boolean; taskId: string; message: string; task: TwapTask }> {
    const response = await fetch(`${this.baseUrl}/place-twap-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    })
    
    if (!response.ok) {
      try {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      } catch (parseError) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    }
    
    return response.json()
  }

  async getTwapTask(taskId: string): Promise<{ task: TwapTask }> {
    const response = await fetch(`${this.baseUrl}/twap-task/${taskId}`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  async getTwapTasks(): Promise<{ tasks: TwapTask[]; totalTasks: number; activeTasks: number; completedTasks: number; failedTasks: number }> {
    const response = await fetch(`${this.baseUrl}/twap-tasks`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  async cancelTwapTask(taskId: string): Promise<{ success: boolean; message: string; taskId: string }> {
    const response = await fetch(`${this.baseUrl}/cancel-twap-task/${taskId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  async updateIsolatedMargin(params: MarginRequest) {
    const response = await fetch(`${this.baseUrl}/update-margin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return response.json()
  }

  async getClearinghouseState(userAddress?: string) {
    const url = userAddress 
      ? `${this.baseUrl}/clearinghouse-state?address=${userAddress}`
      : `${this.baseUrl}/clearinghouse-state`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return response.json()
  }

  async getWalletBalance(userAddress?: string) {
    const url = userAddress 
      ? `${this.baseUrl}/wallet-balance?address=${userAddress}`
      : `${this.baseUrl}/wallet-balance`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return response.json()
  }

  async getMeta() {
    const response = await fetch(`${this.baseUrl}/meta`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return response.json()
  }

  async cancelAllOrders(coin?: string) {
    const url = coin 
      ? `${this.baseUrl}/cancel-orders?coin=${coin}`
      : `${this.baseUrl}/cancel-orders`
    
    const response = await fetch(url, { method: 'POST' })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return response.json()
  }

  async switchNetwork(network: 'testnet' | 'mainnet') {
    console.log('🔄 Switching network to:', network)
    console.log('📡 API URL:', `${this.baseUrl}/switch-network`)
    
    const response = await fetch(`${this.baseUrl}/switch-network`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ network })
    })
    
    console.log('📡 Response status:', response.status)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const result = await response.json()
    console.log('✅ Network switch result:', result)
    return result
  }

  async getHealth() {
    const response = await fetch(`${this.baseUrl}/health`)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return response.json()
  }
}

export const hyperliquidAPI = new HyperliquidAPI()
