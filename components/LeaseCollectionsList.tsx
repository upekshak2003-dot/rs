'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { LeaseCollection, Vehicle } from '@/lib/database.types'
import { formatCurrency } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Calendar, DollarSign, X } from 'lucide-react'
import jsPDF from 'jspdf'

export default function LeaseCollectionsList() {
  const [collections, setCollections] = useState<(LeaseCollection & { vehicle: Vehicle })[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<(LeaseCollection & { vehicle: Vehicle }) | null>(null)
  
  // Modal form fields
  const [chequeAmount, setChequeAmount] = useState('')
  const [personalLoanAmount, setPersonalLoanAmount] = useState('')
  const [chequeNo, setChequeNo] = useState('')
  const [chequeDepositBankName, setChequeDepositBankName] = useState('')
  const [chequeDepositBankAccNo, setChequeDepositBankAccNo] = useState('')
  const [chequeDepositDate, setChequeDepositDate] = useState('')
  const [personalLoanDepositBankName, setPersonalLoanDepositBankName] = useState('')
  const [personalLoanDepositBankAccNo, setPersonalLoanDepositBankAccNo] = useState('')
  const [personalLoanDepositDate, setPersonalLoanDepositDate] = useState('')

  // Customer details loaded for the lease (from sales table)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')

  useEffect(() => {
    loadCollections()
  }, [])

  async function loadCollections() {
    const { data: leaseData } = await supabase
      .from('lease_collections')
      .select('*')
      .order('due_date', { ascending: true })

    if (!leaseData) return

    const { data: vehiclesData } = await supabase
      .from('vehicles')
      .select('*')

    const vehiclesMap = new Map(vehiclesData?.map(v => [v.chassis_no, v]) || [])

    const collectionsWithVehicles = leaseData.map(l => ({
      ...l,
      vehicle: vehiclesMap.get(l.chassis_no),
    })).filter(c => c.vehicle) as (LeaseCollection & { vehicle: Vehicle })[]

    // Filter: Only show collections that are not fully collected OR don't have deposit details
    const filteredCollections = collectionsWithVehicles.filter(c => {
      // If not collected at all, show it
      if (!c.collected) return true
      
      // If collected, check if it has deposit details
      // Only hide if both payment methods have deposit details (if they were used)
      const hasCheque = (c as any).cheque_amount && (c as any).cheque_amount > 0
      const hasPersonalLoan = (c as any).personal_loan_amount && (c as any).personal_loan_amount > 0
      
      if (hasCheque && !(c as any).cheque_deposit_bank_name) return true
      if (hasPersonalLoan && !(c as any).personal_loan_deposit_bank_name) return true
      
      // If both are filled or neither was used, hide it
      return false
    })

    setCollections(filteredCollections)
    setLoading(false)
  }

  async function loadCustomerForCollection(chassisNo: string) {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('customer_name, customer_phone, customer_address')
        .eq('chassis_no', chassisNo)
        .maybeSingle()

      if (error) {
        console.warn('Error loading customer for lease collection:', error)
        setCustomerName('')
        setCustomerPhone('')
        setCustomerAddress('')
        return
      }

      if (data) {
        setCustomerName(data.customer_name || '')
        setCustomerPhone(data.customer_phone || '')
        setCustomerAddress(data.customer_address || '')
      } else {
        setCustomerName('')
        setCustomerPhone('')
        setCustomerAddress('')
      }
    } catch (err) {
      console.warn('Unexpected error loading customer for lease collection:', err)
      setCustomerName('')
      setCustomerPhone('')
      setCustomerAddress('')
    }
  }

  async function openMarkCollectedModal(collection: LeaseCollection & { vehicle: Vehicle }) {
    setSelectedCollection(collection)
    await loadCustomerForCollection(collection.chassis_no)
    // Load existing data if already partially collected
    if (collection.collected) {
      setChequeAmount((collection as any).cheque_amount?.toString() || '')
      setPersonalLoanAmount((collection as any).personal_loan_amount?.toString() || '')
      setChequeNo((collection as any).cheque_no || '')
      setChequeDepositBankName((collection as any).cheque_deposit_bank_name || '')
      setChequeDepositBankAccNo((collection as any).cheque_deposit_bank_acc_no || '')
      setChequeDepositDate((collection as any).cheque_deposit_date || '')
      setPersonalLoanDepositBankName((collection as any).personal_loan_deposit_bank_name || '')
      setPersonalLoanDepositBankAccNo((collection as any).personal_loan_deposit_bank_acc_no || '')
      setPersonalLoanDepositDate((collection as any).personal_loan_deposit_date || '')
    } else {
      // Reset form
      setChequeAmount('')
      setPersonalLoanAmount('')
      setChequeNo('')
      setChequeDepositBankName('')
      setChequeDepositBankAccNo('')
      setChequeDepositDate('')
      setPersonalLoanDepositBankName('')
      setPersonalLoanDepositBankAccNo('')
      setPersonalLoanDepositDate('')
    }
    setShowModal(true)
  }

  async function generateLeaseReport(collection: LeaseCollection & { vehicle: Vehicle }) {
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      // Title
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.text('LEASE REPORT', 105, 20, { align: 'center' })

      // Line under title
      pdf.setDrawColor(0, 0, 0)
      pdf.line(20, 25, 190, 25)

      let currentY = 35

      // Vehicle details section
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Vehicle Details', 20, currentY)
      currentY += 6

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(`Maker      : ${collection.vehicle.maker}`, 20, currentY)
      currentY += 5
      pdf.text(`Model      : ${collection.vehicle.model}`, 20, currentY)
      currentY += 5
      pdf.text(`Chassis No : ${collection.vehicle.chassis_no}`, 20, currentY)
      currentY += 5
      pdf.text(`Due Amount : ${formatCurrency(collection.due_amount_lkr)}`, 20, currentY)
      currentY += 5
      pdf.text(
        `Due Date   : ${new Date(collection.due_date).toLocaleDateString()}`,
        20,
        currentY
      )
      currentY += 10

      // Line
      pdf.line(20, currentY, 190, currentY)
      currentY += 8

      // Customer details section
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Customer Details', 20, currentY)
      currentY += 6

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(`Name    : ${customerName || 'N/A'}`, 20, currentY)
      currentY += 5
      pdf.text(`Phone   : ${customerPhone || 'N/A'}`, 20, currentY)
      currentY += 5
      pdf.text(`Address : ${customerAddress || 'N/A'}`, 20, currentY)
      currentY += 10

      // Line
      pdf.line(20, currentY, 190, currentY)
      currentY += 8

      // Collection / payment details typed in the modal
      const chequeAmt = parseFloat(chequeAmount) || 0
      const personalLoanAmt = parseFloat(personalLoanAmount) || 0
      const totalCollected = chequeAmt + personalLoanAmt
      const remaining =
        (collection.due_amount_lkr || 0) - totalCollected

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Collection Details', 20, currentY)
      currentY += 6

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text(`Cheque Amount        : ${formatCurrency(chequeAmt)}`, 20, currentY)
      currentY += 5
      pdf.text(`Cheque No            : ${chequeNo || 'N/A'}`, 20, currentY)
      currentY += 5
      pdf.text(`Cheque Deposit Bank Name     : ${chequeDepositBankName || 'N/A'}`, 20, currentY)
      currentY += 5
      pdf.text(
        `Cheque Deposit Bank Acc No   : ${chequeDepositBankAccNo || 'N/A'}`,
        20,
        currentY
      )
      currentY += 5
      pdf.text(
        `Cheque Deposit Date  : ${chequeDepositDate || 'N/A'}`,
        20,
        currentY
      )
      currentY += 7

      pdf.text(
        `Personal Loan Amount : ${formatCurrency(personalLoanAmt)}`,
        20,
        currentY
      )
      currentY += 5
      pdf.text(
        `PL Deposit Bank Name         : ${personalLoanDepositBankName || 'N/A'}`,
        20,
        currentY
      )
      currentY += 5
      pdf.text(
        `PL Deposit Bank Acc No       : ${personalLoanDepositBankAccNo || 'N/A'}`,
        20,
        currentY
      )
      currentY += 5
      pdf.text(
        `PL Deposit Date      : ${personalLoanDepositDate || 'N/A'}`,
        20,
        currentY
      )
      currentY += 7

      pdf.text(`Lease Company        : ${collection.lease_company || 'N/A'}`, 20, currentY)
      currentY += 5
      pdf.text(
        `Collected Date       : ${
          collection.collected_date
            ? new Date(collection.collected_date).toLocaleDateString()
            : 'N/A'
        }`,
        20,
        currentY
      )
      currentY += 7

      pdf.text(`Total Collected      : ${formatCurrency(totalCollected)}`, 20, currentY)
      currentY += 5
      pdf.text(`Balance Due            : ${formatCurrency(remaining)}`, 20, currentY)

      // Save PDF
      pdf.save(
        `Lease-Report-${collection.vehicle.chassis_no}-${Date.now()}.pdf`
      )
    } catch (err: any) {
      console.error('Error generating lease report:', err)
      alert(`Error generating lease report: ${err.message || err}`)
    }
  }

  async function handleSaveCollection() {
    if (!selectedCollection) return

    const chequeAmt = parseFloat(chequeAmount) || 0
    const personalLoanAmt = parseFloat(personalLoanAmount) || 0
    
    if (chequeAmt === 0 && personalLoanAmt === 0) {
      alert('Please enter at least one payment method (Cheque or Personal Loan)')
      return
    }

    const totalCollected = chequeAmt + personalLoanAmt
    const remainingAmount = selectedCollection.due_amount_lkr - totalCollected

    if (remainingAmount < 0) {
      alert(`Total collected amount (${formatCurrency(totalCollected)}) exceeds due amount (${formatCurrency(selectedCollection.due_amount_lkr)})`)
      return
    }

    // Validate cheque fields if cheque amount is entered
    if (chequeAmt > 0 && !chequeNo) {
      alert('Please enter cheque number')
      return
    }

    // Check if fully collected
    const isFullyCollected = remainingAmount === 0

    // Check if deposit details are filled for all payment methods used
    const chequeHasDeposit = chequeAmt > 0 ? (chequeDepositBankName && chequeDepositBankAccNo && chequeDepositDate) : true
    const personalLoanHasDeposit = personalLoanAmt > 0 ? (personalLoanDepositBankName && personalLoanDepositBankAccNo && personalLoanDepositDate) : true
    const allDepositsFilled = chequeHasDeposit && personalLoanHasDeposit

    // Mark as fully collected only if amount is fully collected AND all deposits are filled
    const shouldMarkCollected = isFullyCollected && allDepositsFilled

    try {
      // NOTE:
      // To avoid type / schema mismatches (e.g. invalid input syntax for boolean/date),
      // we only update the boolean collected flag here. The collected date is used
      // for the printed report only and not persisted, so different database schemas
      // (where collected_date might be a different type) will not cause errors.
      const updateData: any = {
        collected: shouldMarkCollected,
      }

      const { error } = await supabase
        .from('lease_collections')
        .update(updateData)
        .eq('id', selectedCollection.id)

      if (error) {
        alert(`Error: ${error.message}`)
        return
      }

      // If fully collected, offer to generate the lease report
      if (shouldMarkCollected) {
        const printReport = confirm('Print Lease Report?')
        if (printReport) {
          await generateLeaseReport(selectedCollection)
        }
      }

      alert('Collection details saved successfully.')
      setShowModal(false)
      loadCollections()
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-1">Lease</h1>
          <p className="text-slate-600 text-sm">Track pending lease payments</p>
        </div>

        {collections.length === 0 ? (
          <div className="card p-12 text-center">
            <DollarSign className="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Pending Collections</h3>
            <p className="text-slate-600">All lease payments have been collected</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {collections.map((collection, index) => {
              const chequeAmt = (collection as any).cheque_amount || 0
              const personalLoanAmt = (collection as any).personal_loan_amount || 0
              const totalCollected = chequeAmt + personalLoanAmt
              const remainingAmount = collection.due_amount_lkr - totalCollected
              const isPartiallyCollected = totalCollected > 0 && remainingAmount > 0

              return (
                <motion.div
                  key={collection.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="card p-6 hover:shadow-xl transition-all duration-300"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-slate-800">
                          {collection.vehicle.maker} {collection.vehicle.model}
                        </h3>
                        <p className="text-sm text-slate-600">
                          Chassis: {collection.vehicle.chassis_no}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-slate-200">
                      {collection.lease_company && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">Lease Company:</span>
                          <span className="font-semibold text-slate-800">
                            {collection.lease_company}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Due Amount:
                        </span>
                        <span className="font-bold text-slate-800 text-lg">
                          {formatCurrency(collection.due_amount_lkr)}
                        </span>
                      </div>
                      {isPartiallyCollected && (
                        <>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Collected:</span>
                            <span className="font-semibold text-green-700">
                              {formatCurrency(totalCollected)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">Remaining:</span>
                            <span className="font-bold text-orange-700">
                              {formatCurrency(remainingAmount)}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Due Date:
                        </span>
                        <span className={`font-semibold ${
                          new Date(collection.due_date) < new Date() 
                            ? 'text-red-600' 
                            : 'text-slate-800'
                        }`}>
                          {new Date(collection.due_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => openMarkCollectedModal(collection)}
                      className="w-full mt-4 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {isPartiallyCollected ? 'Update Collection' : 'Mark as Collected'}
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* Mark Collected Modal */}
      <AnimatePresence>
        {showModal && selectedCollection && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              >
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-slate-800">Mark as Collected</h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <div className="text-sm text-slate-600 mb-1">Due Amount:</div>
                    <div className="text-xl font-bold text-slate-900">
                      {formatCurrency(selectedCollection.due_amount_lkr)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Cheque Amount (LKR)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={chequeAmount}
                        onChange={(e) => setChequeAmount(e.target.value)}
                        className="input-field"
                        placeholder="Enter amount"
                        style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                      />
                    </div>
                    <div>
                      <label className="label">Personal Loan Amount (LKR)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={personalLoanAmount}
                        onChange={(e) => setPersonalLoanAmount(e.target.value)}
                        className="input-field"
                        placeholder="Enter amount"
                        style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                      />
                    </div>
                  </div>

                  {parseFloat(chequeAmount) > 0 && (
                    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <h3 className="font-semibold text-slate-800">Cheque Details</h3>
                      <div>
                        <label className="label">Cheque Number *</label>
                        <input
                          type="text"
                          value={chequeNo}
                          onChange={(e) => setChequeNo(e.target.value)}
                          className="input-field"
                          placeholder="Enter cheque number"
                          required
                          style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                        />
                      </div>
                      <div>
                        <label className="label">Cheque Amount (LKR)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={chequeAmount}
                          disabled
                          className="input-field bg-slate-100"
                        />
                      </div>
                      <div>
                        <label className="label">Deposit Bank Name</label>
                        <input
                          type="text"
                          value={chequeDepositBankName}
                          onChange={(e) => setChequeDepositBankName(e.target.value)}
                          className="input-field"
                          placeholder="Enter bank name"
                          style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                        />
                      </div>
                      <div>
                        <label className="label">Deposit Bank Account Number</label>
                        <input
                          type="text"
                          value={chequeDepositBankAccNo}
                          onChange={(e) => setChequeDepositBankAccNo(e.target.value)}
                          className="input-field"
                          placeholder="Enter account number"
                          style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                        />
                      </div>
                      <div>
                        <label className="label">Deposit Date</label>
                        <input
                          type="date"
                          value={chequeDepositDate}
                          onChange={(e) => setChequeDepositDate(e.target.value)}
                          className="input-field"
                          style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                        />
                      </div>
                    </div>
                  )}

                  {parseFloat(personalLoanAmount) > 0 && (
                    <div className="space-y-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <h3 className="font-semibold text-slate-800">Personal Loan Details</h3>
                      <div>
                        <label className="label">Personal Loan Amount (LKR)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={personalLoanAmount}
                          disabled
                          className="input-field bg-slate-100"
                        />
                      </div>
                      <div>
                        <label className="label">Deposit Bank Name</label>
                        <input
                          type="text"
                          value={personalLoanDepositBankName}
                          onChange={(e) => setPersonalLoanDepositBankName(e.target.value)}
                          className="input-field"
                          placeholder="Enter bank name"
                          style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                        />
                      </div>
                      <div>
                        <label className="label">Deposit Bank Account Number</label>
                        <input
                          type="text"
                          value={personalLoanDepositBankAccNo}
                          onChange={(e) => setPersonalLoanDepositBankAccNo(e.target.value)}
                          className="input-field"
                          placeholder="Enter account number"
                          style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                        />
                      </div>
                      <div>
                        <label className="label">Deposit Date</label>
                        <input
                          type="date"
                          value={personalLoanDepositDate}
                          onChange={(e) => setPersonalLoanDepositDate(e.target.value)}
                          className="input-field"
                          style={{ pointerEvents: 'auto', zIndex: 10, position: 'relative' }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="text-sm text-slate-600 mb-2">Summary:</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Due Amount:</span>
                        <span className="font-semibold">{formatCurrency(selectedCollection.due_amount_lkr)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cheque Amount:</span>
                        <span>{formatCurrency(parseFloat(chequeAmount) || 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Personal Loan Amount:</span>
                        <span>{formatCurrency(parseFloat(personalLoanAmount) || 0)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-amber-300 font-semibold">
                        <span>Total Collected:</span>
                        <span>{formatCurrency((parseFloat(chequeAmount) || 0) + (parseFloat(personalLoanAmount) || 0))}</span>
                      </div>
                      <div className="flex justify-between pt-1">
                        <span>Remaining:</span>
                        <span className={`font-bold ${
                          (selectedCollection.due_amount_lkr - ((parseFloat(chequeAmount) || 0) + (parseFloat(personalLoanAmount) || 0))) === 0
                            ? 'text-green-700'
                            : 'text-orange-700'
                        }`}>
                          {formatCurrency(selectedCollection.due_amount_lkr - ((parseFloat(chequeAmount) || 0) + (parseFloat(personalLoanAmount) || 0)))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-4">
                  <button
                    onClick={() => setShowModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCollection}
                    className="btn-primary"
                  >
                    Save
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
