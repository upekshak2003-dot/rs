'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import { User } from '@/lib/supabase'
import Layout from './Layout'
import { 
  PlusCircle, 
  Car, 
  CheckCircle, 
  Receipt, 
  FileText,
  TrendingUp,
  DollarSign,
  Calendar
} from 'lucide-react'
import { motion } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState({
    vehiclesSoldThisMonth: 0,
    totalAdvanceMoney: 0,
    leaseMoneyToCollect: 0,
    monthlyProfit: 0,
  })
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      router.push('/login')
      return
    }
    
    const role = (authUser.user_metadata?.role as 'admin' | 'staff') || 'staff'
    setUser({
      id: authUser.id,
      email: authUser.email!,
      role,
    })

    // Load dashboard stats
    await Promise.all([
      loadVehiclesSoldThisMonth(),
      loadTotalAdvanceMoney(),
      loadLeaseMoneyToCollect(),
      loadMonthlyProfit(role),
    ])
    
    setLoading(false)
  }

  async function loadVehiclesSoldThisMonth() {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const { count } = await supabase
      .from('sales')
      .select('*', { count: 'exact', head: true })
      .gte('sold_date', startOfMonth.toISOString().split('T')[0])
    
    setStats(prev => ({ ...prev, vehiclesSoldThisMonth: count || 0 }))
  }

  async function loadTotalAdvanceMoney() {
    // Get all available vehicles (not sold)
    const { data: availableVehicles } = await supabase
      .from('vehicles')
      .select('chassis_no')
      .eq('status', 'available')
    
    if (!availableVehicles || availableVehicles.length === 0) {
      setStats(prev => ({ ...prev, totalAdvanceMoney: 0 }))
      return
    }
    
    // Get advance payments only for available vehicles
    const chassisNos = availableVehicles.map(v => v.chassis_no)
    const { data } = await supabase
      .from('advance_payments')
      .select('amount_lkr')
      .in('chassis_no', chassisNos)
    
    const total = data?.reduce((sum, payment) => sum + (payment.amount_lkr || 0), 0) || 0
    setStats(prev => ({ ...prev, totalAdvanceMoney: total }))
  }

  async function loadLeaseMoneyToCollect() {
    const { data } = await supabase
      .from('lease_collections')
      .select('due_amount_lkr')
      .eq('collected', false)
    
    const total = data?.reduce((sum, lease) => sum + (lease.due_amount_lkr || 0), 0) || 0
    setStats(prev => ({ ...prev, leaseMoneyToCollect: total }))
  }

  async function loadMonthlyProfit(role: 'admin' | 'staff') {
    if (role !== 'admin') return
    
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    const { data } = await supabase
      .from('sales')
      .select('profit') // Database uses 'profit' (in LKR)
      .gte('sold_date', startOfMonth.toISOString().split('T')[0])
    
    // Each sale row only has "profit" (already in LKR)
    const total = data?.reduce((sum, sale) => sum + (sale.profit || 0), 0) || 0
    setStats(prev => ({ ...prev, monthlyProfit: total }))
  }

  const quickActions = [
    { href: '/add-vehicle', label: 'Add Vehicle', icon: PlusCircle, adminOnly: true },
    { href: '/available', label: 'Available Vehicles', icon: Car, adminOnly: false },
    { href: '/sold', label: 'Sold Vehicles', icon: CheckCircle, adminOnly: false },
    { href: '/lease', label: 'Lease', icon: Receipt, adminOnly: false },
    { href: '/reports', label: 'Reports', icon: FileText, adminOnly: false },
  ]

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-1">Dashboard</h1>
          <p className="text-slate-600 text-sm">Overview of your vehicle management system</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Vehicles Sold This Month"
            value={stats.vehiclesSoldThisMonth}
            icon={CheckCircle}
            color=""
            delay={0.1}
          />
          {isAdmin(user) && (
            <StatCard
              title="Monthly Profit"
              value={formatCurrency(stats.monthlyProfit)}
              icon={TrendingUp}
              color=""
              delay={0.2}
            />
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action, index) => {
              // Hide "Add Vehicle" for staff
              if (action.adminOnly && !isAdmin(user)) {
                return null
              }
              
              const Icon = action.icon
              return (
                <motion.button
                  key={action.href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  whileHover={{ scale: 1.05, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => router.push(action.href)}
                  className="card p-6 text-left bg-white hover:shadow-md transition-all duration-200 border border-slate-200"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-100 rounded-lg">
                      <Icon className="w-6 h-6 text-slate-700" />
                    </div>
                    <h3 className="text-base font-medium text-slate-900">{action.label}</h3>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>
      </motion.div>
    </Layout>
  )
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  delay 
}: { 
  title: string
  value: string | number
  icon: any
  color: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card p-6 bg-white"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="p-2.5 bg-slate-100 rounded-lg">
          <Icon className="w-5 h-5 text-slate-700" />
        </div>
      </div>
      <h3 className="text-sm font-medium text-slate-600 mb-2">{title}</h3>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </motion.div>
  )
}

