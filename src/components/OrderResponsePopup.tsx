import React from 'react'
import { X, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'

export interface OrderResponse {
  success: boolean
  orderId?: string
  status?: string
  message?: string
  error?: string
  data?: any
}

interface OrderResponsePopupProps {
  isOpen: boolean
  onClose: () => void
  response: OrderResponse | null
}

const OrderResponsePopup: React.FC<OrderResponsePopupProps> = ({
  isOpen,
  onClose,
  response
}) => {
  if (!isOpen || !response) return null

  const getStatusIcon = () => {
    if (response.success) {
      return <CheckCircle className="w-8 h-8 text-green-500" />
    } else {
      return <XCircle className="w-8 h-8 text-red-500" />
    }
  }

  const getStatusColor = () => {
    if (response.success) {
      return 'border-green-500 bg-green-900/20'
    } else {
      return 'border-red-500 bg-red-900/20'
    }
  }

  const getStatusText = () => {
    if (response.success) {
      return 'Order Placed Successfully'
    } else {
      return 'Order Failed'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-dark-surface border-2 ${getStatusColor()} rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <h3 className="text-lg font-semibold text-white">
              {getStatusText()}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Order ID */}
          {response.orderId && response.orderId !== 'N/A' ? (
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-blue-400" />
                <span className="text-sm font-medium text-gray-300">Order ID</span>
              </div>
              <p className="text-white font-mono text-sm break-all">
                {response.orderId}
              </p>
            </div>
          ) : response.success && (
            <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-blue-400" />
                <span className="text-sm font-medium text-blue-300">Market Order</span>
              </div>
              <p className="text-blue-200 text-sm">
                Market order executed immediately - no order ID generated
              </p>
            </div>
          )}

          {/* Status */}
          {response.status && (
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={16} className="text-yellow-400" />
                <span className="text-sm font-medium text-gray-300">Status</span>
              </div>
              <p className="text-white text-sm">
                {response.status}
              </p>
            </div>
          )}

          {/* Message */}
          {response.message && (
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={16} className="text-blue-400" />
                <span className="text-sm font-medium text-gray-300">Message</span>
              </div>
              <p className="text-white text-sm">
                {response.message}
              </p>
            </div>
          )}

          {/* Error */}
          {response.error && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <XCircle size={16} className="text-red-400" />
                <span className="text-sm font-medium text-red-300">Error</span>
              </div>
              <p className="text-red-200 text-sm">
                {response.error}
              </p>
            </div>
          )}

          {/* Raw Data (for debugging) */}
          {response.data && (
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={16} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-300">Response Data</span>
              </div>
              <pre className="text-gray-300 text-xs overflow-x-auto">
                {JSON.stringify(response.data, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              response.success
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default OrderResponsePopup
