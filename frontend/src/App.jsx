import React, { useState, useEffect, useMemo } from 'react'
import { 
  Package, 
  BarChart3, 
  History, 
  Plus, 
  Minus, 
  Search, 
  Trash2, 
  Edit2, 
  Check, 
  X,
  ArrowUpRight,
  ArrowDownRight,
  Filter
} from 'lucide-react'

const API_BASE = "http://localhost:8080"

function App() {
  const [activeTab, setActiveTab] = useState('inventory')
  const [dashboardData, setDashboardData] = useState({
    transactions: [],
    product_summary: [],
    analytics: { total_in: 0, total_out: 0, current_total_stock: 0, total_products: 0 }
  })
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  
  // Form states
  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  
  // Transaction states
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAction, setFilterAction] = useState('ALL')
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [editForm, setEditForm] = useState({ action: 'IN', quantity: '' })

  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard-data`)
      if (res.ok) {
        const data = await res.json()
        setDashboardData(data)
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err)
      showToast("Network error: Backend unavailable", "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const showToast = (text, type = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleStockAction = async (actionType) => {
    if (!productId || !quantity || parseInt(quantity) <= 0) {
      showToast("Enter a valid Product ID and Quantity", "error")
      return
    }

    const endpoint = actionType === 'IN' ? '/add-stock' : '/remove-stock'
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId.toUpperCase(), quantity: parseInt(quantity) })
      })

      if (res.ok) {
        showToast(`Stock ${actionType === 'IN' ? 'added' : 'removed'} successfully`)
        setQuantity('')
        fetchDashboardData()
      } else {
        const msg = await res.text()
        showToast(msg || "Failed to update stock", "error")
      }
    } catch (err) {
      showToast("Network error occurred", "error")
    }
  }

  const handleDeleteProduct = async (pid) => {
    if (!window.confirm(`Delete product "${pid}" and ALL its history? This cannot be undone.`)) return
    
    try {
      const res = await fetch(`${API_BASE}/delete-product`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: pid })
      })

      if (res.ok) {
        showToast("Product and history deleted")
        fetchDashboardData()
      }
    } catch (err) {
      showToast("Failed to delete product", "error")
    }
  }

  const handleDeleteTransaction = async (tx) => {
    if (!window.confirm("Delete this transaction?")) return

    try {
      const res = await fetch(`${API_BASE}/delete-transaction`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: tx.product_id, timeuuid: tx.timeuuid })
      })

      if (res.ok) {
        showToast("Transaction deleted")
        fetchDashboardData()
      }
    } catch (err) {
      showToast("Failed to delete transaction", "error")
    }
  }

  const startEdit = (tx) => {
    setEditingTransaction(tx)
    setEditForm({ action: tx.action, quantity: String(tx.quantity) })
  }

  const saveEdit = async () => {
    if (!editForm.quantity || parseInt(editForm.quantity) <= 0) return

    try {
      const res = await fetch(`${API_BASE}/update-transaction`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: editingTransaction.product_id,
          timeuuid: editingTransaction.timeuuid,
          action: editForm.action,
          quantity: parseInt(editForm.quantity)
        })
      })

      if (res.ok) {
        showToast("Transaction updated")
        setEditingTransaction(null)
        fetchDashboardData()
      }
    } catch (err) {
      showToast("Failed to update transaction", "error")
    }
  }

  const filteredTransactions = useMemo(() => {
    return dashboardData.transactions
      .filter(tx => {
        const matchesSearch = tx.product_id.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesFilter = filterAction === 'ALL' || tx.action === filterAction
        return matchesSearch && matchesFilter
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }, [dashboardData.transactions, searchTerm, filterAction])

  if (loading) {
    return <div className="modal-overlay"><p>Loading Dashboard...</p></div>
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="flex items-center justify-between">
          <div>
            <h1>Inventory Dashboard</h1>
            <p>Enterprise Stock Management System</p>
          </div>
          <div className="text-muted" style={{ fontSize: '12px' }}>
            System Status: <span className="text-success">Connected</span>
          </div>
        </div>
      </header>

      <nav className="tabs-nav">
        <button 
          className={`tab-trigger ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          <div className="flex items-center gap-2"><Package size={16}/> Inventory</div>
        </button>
        <button 
          className={`tab-trigger ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <div className="flex items-center gap-2"><BarChart3 size={16}/> Analytics</div>
        </button>
        <button 
          className={`tab-trigger ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          <div className="flex items-center gap-2"><History size={16}/> Transactions</div>
        </button>
      </nav>

      <main className="fade-in">
        {activeTab === 'inventory' && (
          <div className="flex flex-col gap-4">
            <section className="card">
              <h2 style={{ fontSize: '16px', marginBottom: '20px' }}>Quick Action</h2>
              <div className="flex items-end gap-4">
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label className="form-label">Product ID</label>
                  <input 
                    className="input" 
                    placeholder="e.g. SKU-12345"
                    value={productId}
                    onChange={e => setProductId(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="form-group" style={{ width: '120px', marginBottom: 0 }}>
                  <label className="form-label">Quantity</label>
                  <input 
                    className="input" 
                    type="number"
                    placeholder="0"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary" onClick={() => handleStockAction('IN')}>
                  <Plus size={16} style={{ marginRight: '6px' }}/> Add
                </button>
                <button className="btn btn-danger" onClick={() => handleStockAction('OUT')}>
                  <Minus size={16} style={{ marginRight: '6px' }}/> Remove
                </button>
              </div>
            </section>

            <section className="card">
              <h2 style={{ fontSize: '16px', marginBottom: '20px' }}>Stock Summary</h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Product ID</th>
                      <th>Current Stock</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.product_summary.map(item => (
                      <tr key={item.product_id}>
                        <td style={{ fontWeight: 500 }}>{item.product_id}</td>
                        <td>{item.current_stock} units</td>
                        <td>
                          <span className={`badge ${item.current_stock > 10 ? 'badge-in' : 'badge-out'}`}>
                            {item.current_stock > 10 ? 'Healthy' : 'Low Stock'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '6px', color: '#ef4444' }}
                            onClick={() => handleDeleteProduct(item.product_id)}
                          >
                            <Trash2 size={14}/>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {dashboardData.product_summary.length === 0 && (
                      <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No products in database</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="flex flex-col gap-4">
            <div className="grid-cols-4">
              <div className="card stat-card">
                <span className="stat-label">Total Stock Added</span>
                <div className="flex items-center gap-2">
                  <span className="stat-value text-success">{dashboardData.analytics.total_in}</span>
                  <ArrowUpRight size={20} className="text-success"/>
                </div>
              </div>
              <div className="card stat-card">
                <span className="stat-label">Total Stock Removed</span>
                <div className="flex items-center gap-2">
                  <span className="stat-value text-danger">{dashboardData.analytics.total_out}</span>
                  <ArrowDownRight size={20} className="text-danger"/>
                </div>
              </div>
              <div className="card stat-card">
                <span className="stat-label">Current Total Stock</span>
                <div className="flex items-center gap-2">
                  <span className="stat-value">{dashboardData.analytics.current_total_stock}</span>
                </div>
              </div>
              <div className="card stat-card">
                <span className="stat-label">Active Products</span>
                <div className="flex items-center gap-2">
                  <span className="stat-value">{dashboardData.analytics.total_products}</span>
                </div>
              </div>
            </div>
            
            <section className="card" style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p className="text-muted">Analytics Visualization module ready for integration.</p>
            </section>
          </div>
        )}

        {activeTab === 'transactions' && (
          <section className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '16px' }}>Movement History</h2>
              <div className="flex gap-2">
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}/>
                  <input 
                    className="input" 
                    placeholder="Search product..."
                    style={{ paddingLeft: '32px', width: '200px' }}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <select 
                  className="input" 
                  style={{ width: '100px' }}
                  value={filterAction}
                  onChange={e => setFilterAction(e.target.value)}
                >
                  <option value="ALL">All</option>
                  <option value="IN">Stock In</option>
                  <option value="OUT">Stock Out</option>
                </select>
              </div>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Product</th>
                    <th>Action</th>
                    <th>Quantity</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map(tx => (
                    <tr key={tx.timeuuid}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        {new Date(tx.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td style={{ fontWeight: 500 }}>{tx.product_id}</td>
                      <td>
                        <span className={`badge ${tx.action === 'IN' ? 'badge-in' : 'badge-out'}`}>
                          {tx.action}
                        </span>
                      </td>
                      <td>{tx.quantity}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex gap-2 justify-end">
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '6px' }}
                            onClick={() => startEdit(tx)}
                          >
                            <Edit2 size={14}/>
                          </button>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '6px', color: '#ef4444' }}
                            onClick={() => handleDeleteTransaction(tx)}
                          >
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* Edit Modal */}
      {editingTransaction && (
        <div className="modal-overlay">
          <div className="modal-content fade-in">
            <h3 style={{ marginBottom: '20px' }}>Edit Transaction</h3>
            <div className="form-group">
              <label className="form-label">Action</label>
              <select 
                className="input"
                value={editForm.action}
                onChange={e => setEditForm(p => ({ ...p, action: e.target.value }))}
              >
                <option value="IN">Stock In</option>
                <option value="OUT">Stock Out</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input 
                className="input" 
                type="number"
                value={editForm.quantity}
                onChange={e => setEditForm(p => ({ ...p, quantity: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn btn-outline" onClick={() => setEditingTransaction(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`toast ${toast.type === 'error' ? 'text-danger' : 'text-success'}`}>
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? <X size={16}/> : <Check size={16}/>}
            {toast.text}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
