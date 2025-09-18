// Server-side API for Hyperliquid SDK
// This approach is more secure as private keys stay on the server

export interface OrderRequest {
  coin: string
  is_buy: boolean
  sz: string | number
  limit_px?: string | number
  order_type: {
    limit?: { tif: 'Gtc' | 'Ioc' | 'Alo' }
  }
  reduce_only: boolean
  cloid?: string
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

  async placeOrder(order: OrderRequest) {
    const response = await fetch(`${this.baseUrl}/place-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
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
      throw new Error(`HTTP error! status: ${response.status}`)
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
