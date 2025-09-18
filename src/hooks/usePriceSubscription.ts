import { useState, useEffect, useRef, useMemo } from 'react'

const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined

const sanitizeBase = (base?: string) => {
  if (!base) return ''
  return base.replace(/\/+$/, '')
}

const buildApiUrl = (base: string, path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (!base) {
    return normalizedPath
  }

  const sanitizedBase = sanitizeBase(base)
  if (!sanitizedBase) {
    return normalizedPath
  }

  if (sanitizedBase.endsWith('/api')) {
    if (normalizedPath === '/api') {
      return sanitizedBase
    }

    if (normalizedPath.startsWith('/api/')) {
      return `${sanitizedBase}${normalizedPath.slice(4)}`
    }
  }

  return `${sanitizedBase}${normalizedPath}`
}

const normalizeCoin = (symbol: string) => {
  if (!symbol) return ''
  const upper = symbol.toUpperCase()
  return upper.includes('-') ? upper : `${upper}-PERP`
}

type PriceMap = Record<string, number>

export const usePriceSubscription = (coin: string, isTestnet: boolean = true) => {
  const [price, setPrice] = useState<number | null>(null)
  const [prices, setPrices] = useState<PriceMap>({})
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolvedBase, setResolvedBase] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const coinRef = useRef(coin)

  const baseCandidates = useMemo(() => {
    const candidates = new Set<string>()

    if (RAW_API_BASE_URL) {
      const sanitizedEnv = sanitizeBase(RAW_API_BASE_URL)
      candidates.add(sanitizedEnv)
      if (sanitizedEnv.endsWith('/api')) {
        candidates.add(sanitizedEnv.replace(/\/api$/, ''))
      }
    }

    if (typeof window !== 'undefined') {
      const { protocol, hostname } = window.location
      const portSuffix = window.location.port ? `:${window.location.port}` : ''
      const sameOrigin = `${protocol}//${hostname}${portSuffix}`
      candidates.add(`${protocol}//${hostname}:3001`)
      candidates.add(sameOrigin)
    }

    candidates.add('http://localhost:3001')
    candidates.add('http://localhost:3001/api')
    candidates.add('http://127.0.0.1:3001')
    candidates.add('/api')
    candidates.add('')

    return Array.from(candidates)
  }, [])

  useEffect(() => {
    coinRef.current = coin
  }, [coin])

  useEffect(() => {
    let isActive = true

    const tryFetchSnapshot = async () => {
      setError(null)
      let lastError: string | null = null

      for (const base of baseCandidates) {
        const url = buildApiUrl(base, '/api/prices')

        try {
          const response = await fetch(url)
          if (!response.ok) {
            lastError = `HTTP ${response.status}`
            console.warn('⚠️ Price snapshot request failed:', url, response.status)
            continue
          }

          const data = await response.json()
          if (!isActive) {
            return
          }

          if (data?.prices && typeof data.prices === 'object') {
            setPrices(data.prices)
            const normalizedCoin = normalizeCoin(coinRef.current)
            if (normalizedCoin && data.prices[normalizedCoin] !== undefined) {
              setPrice(data.prices[normalizedCoin])
            }
            setResolvedBase(base)
            setError(null)
            return
          }

          console.warn('⚠️ Price snapshot missing prices object:', url, data)
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Unknown error'
          console.error('❌ Failed to fetch price snapshot:', url, err)
        }
      }

      if (!isActive) {
        return
      }

      setResolvedBase(null)
      setIsConnected(false)
      setError(lastError || 'Price service unavailable')
    }

    tryFetchSnapshot()

    return () => {
      isActive = false
    }
  }, [baseCandidates, isTestnet])

  useEffect(() => {
    if (!resolvedBase) {
      return
    }

    const streamUrl = buildApiUrl(resolvedBase, '/api/price-stream')
    const source = new EventSource(streamUrl)
    eventSourceRef.current = source

    source.onopen = () => {
      setIsConnected(true)
      setError(null)
      console.log('✅ Connected to price stream:', streamUrl)
    }

    source.onerror = (event) => {
      console.error('❌ Price stream error:', streamUrl, event)
      setIsConnected(false)
      setError('Connection lost. Reconnecting...')
    }

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)

        if (payload?.type === 'error') {
          setError(payload.message || 'Price stream error')
          return
        }

        if (payload?.prices && typeof payload.prices === 'object') {
          setPrices(payload.prices)
          const normalizedCoin = normalizeCoin(coinRef.current)
          if (normalizedCoin && payload.prices[normalizedCoin] !== undefined) {
            setPrice(payload.prices[normalizedCoin])
            setError(null)
          }
        }
      } catch (err) {
        console.error('❌ Failed to parse price update:', err)
      }
    }

    return () => {
      source.close()
      eventSourceRef.current = null
      setIsConnected(false)
    }
  }, [resolvedBase, isTestnet])

  useEffect(() => {
    const normalizedCoin = normalizeCoin(coin)
    if (normalizedCoin && prices[normalizedCoin] !== undefined) {
      setPrice(prices[normalizedCoin])
    }
  }, [coin, prices])

  const unsubscribe = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      setIsConnected(false)
    }
  }

  return {
    price,
    prices,
    isConnected,
    error,
    subscribe: async () => {},
    unsubscribe
  }
}
