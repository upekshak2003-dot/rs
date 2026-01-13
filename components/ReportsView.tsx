'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import { Sale, AdvancePayment, LeaseCollection } from '@/lib/database.types'
import { formatCurrency } from '@/lib/utils'
import { motion } from 'framer-motion'
import { TrendingUp, DollarSign, Receipt, Calendar } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ReportsViewProps {
  user: User
}

export default function ReportsView({ user }: ReportsViewProps) {
  const [monthlyProfit, setMonthlyProfit] = useState(0)
  const [salesSummary, setSalesSummary] = useState({
    totalSales: 0,
    totalVehicles: 0,
    averageProfit: 0,
  })
  const [advanceSummary, setAdvanceSummary] = useState({
    totalAdvance: 0,
    totalPayments: 0,
  })
  const [leaseSummary, setLeaseSummary] = useState({
    pending: 0,
    collected: 0,
  })
  const [monthlyProfitData, setMonthlyProfitData] = useState<Array<{ month: string; profit: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Monthly Profit (Admin Only)
    if (isAdmin(user)) {
      const { data: sales } = await supabase
        .from('sales')
        .select('profit, sold_date') // Database uses 'profit' (in LKR)
        .gte('sold_date', startOfMonth.toISOString().split('T')[0])
    
      // Each sale row only has "profit" (already in LKR)
      const profit = sales?.reduce((sum, s) => sum + (s.profit || 0), 0) || 0
      setMonthlyProfit(profit)

      // Load monthly profit data for graph (last 12 months)
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
      const { data: allSales } = await supabase
        .from('sales')
        .select('profit, sold_date') // "profit" only
        .gte('sold_date', twelveMonthsAgo.toISOString().split('T')[0])
        .order('sold_date', { ascending: true })

      // Group by month
      const monthlyData = new Map<string, number>()
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      
      // Initialize last 12 months with 0
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${monthNames[date.getMonth()]} ${date.getFullYear()}`
        monthlyData.set(key, 0)
      }

      // Add actual profit data
      allSales?.forEach(sale => {
        const saleDate = new Date(sale.sold_date)
        const key = `${monthNames[saleDate.getMonth()]} ${saleDate.getFullYear()}`
        const currentProfit = monthlyData.get(key) || 0
        monthlyData.set(key, currentProfit + (sale.profit || 0))
      })

      // Convert to array format for chart
      const chartData = Array.from(monthlyData.entries()).map(([month, profit]) => ({
        month,
        profit: Math.round(profit * 100) / 100 // Round to 2 decimal places
      }))

      setMonthlyProfitData(chartData)
    }

    // Sales Summary
    const { data: allSales } = await supabase
      .from('sales')
      .select('profit, sold_price') // Database uses 'profit' (in LKR)

    const totalSales = allSales?.reduce((sum, s) => sum + (s.sold_price || 0), 0) || 0
    const totalProfit = allSales?.reduce((sum, s) => sum + (s.profit || 0), 0) || 0
    const avgProfit = allSales && allSales.length > 0 ? totalProfit / allSales.length : 0

    setSalesSummary({
      totalSales,
      totalVehicles: allSales?.length || 0,
      averageProfit: avgProfit,
    })

    // Advance Summary
    const { data: payments } = await supabase
      .from('advance_payments')
      .select('amount_lkr')

    const totalAdvance = payments?.reduce((sum, p) => sum + (p.amount_lkr || 0), 0) || 0
    setAdvanceSummary({
      totalAdvance,
      totalPayments: payments?.length || 0,
    })

    // Lease Summary
    const { data: leases } = await supabase
      .from('lease_collections')
      .select('due_amount_lkr, collected')

    const pending = leases?.filter(l => !l.collected).reduce((sum, l) => sum + (l.due_amount_lkr || 0), 0) || 0
    const collected = leases?.filter(l => l.collected).reduce((sum, l) => sum + (l.due_amount_lkr || 0), 0) || 0

    setLeaseSummary({ pending, collected })
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-4xl font-bold text-slate-800 mb-2">Reports</h1>
        <p className="text-slate-600">View system reports and summaries</p>
      </div>

      {isAdmin(user) && (
        <>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card p-8 bg-gradient-to-br from-purple-500 to-pink-600 text-white"
          >
            <div className="flex items-center gap-4 mb-4">
              <TrendingUp className="w-8 h-8" />
              <h2 className="text-2xl font-bold">Monthly Profit (Admin Only)</h2>
            </div>
            <div className="text-4xl font-bold">
              {formatCurrency(monthlyProfit)}
            </div>
            <p className="text-purple-100 mt-2">Profit for current month</p>
          </motion.div>

          {monthlyProfitData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6"
            >
              <h3 className="text-xl font-bold text-stone-800 mb-4">Monthly Profit Trend (Last 12 Months)</h3>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={monthlyProfitData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    tickFormatter={(value) => formatCurrency(value)}
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelStyle={{ color: '#1e293b' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="profit" 
                    stroke="#92400E" 
                    strokeWidth={3}
                    dot={{ fill: '#92400E', r: 4 }}
                    name="Profit (LKR)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          )}
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Sales Summary</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Total Vehicles Sold:</span>
              <span className="font-bold">{salesSummary.totalVehicles}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Total Sales:</span>
              <span className="font-bold">{formatCurrency(salesSummary.totalSales)}</span>
            </div>
            {isAdmin(user) && (
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-600">Avg Profit:</span>
                <span className="font-bold text-green-700">{formatCurrency(salesSummary.averageProfit)}</span>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Advance Summary</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Total Advance:</span>
              <span className="font-bold text-green-700">{formatCurrency(advanceSummary.totalAdvance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Total Payments:</span>
              <span className="font-bold">{advanceSummary.totalPayments}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Receipt className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Lease Collection</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Pending:</span>
              <span className="font-bold text-orange-700">{formatCurrency(leaseSummary.pending)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Collected:</span>
              <span className="font-bold text-green-700">{formatCurrency(leaseSummary.collected)}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}

