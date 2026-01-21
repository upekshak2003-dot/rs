-- Database Setup Script for Vehicle Management System
-- This script handles existing tables gracefully

-- ============================================
-- STEP 1: Drop existing tables if they exist
-- (Only run this if you want to start fresh)
-- ============================================

-- Uncomment the lines below if you want to drop and recreate everything:
-- DROP TABLE IF EXISTS lease_collections CASCADE;
-- DROP TABLE IF EXISTS sales CASCADE;
-- DROP TABLE IF EXISTS advance_payments CASCADE;
-- DROP TABLE IF EXISTS advances CASCADE;
-- DROP TABLE IF EXISTS vehicles CASCADE;

-- ============================================
-- STEP 2: Create tables (only if they don't exist)
-- ============================================

-- Vehicles Table
CREATE TABLE IF NOT EXISTS vehicles (
  chassis_no TEXT PRIMARY KEY,
  maker TEXT NOT NULL,
  model TEXT NOT NULL,
  manufacturer_year INTEGER NOT NULL,
  mileage INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'sold', 'not_available')),
  
  -- Japan costs (JPY)
  bid_jpy NUMERIC,
  commission_jpy NUMERIC,
  insurance_jpy NUMERIC,
  inland_transport_jpy NUMERIC,
  other_jpy NUMERIC,
  other_label TEXT,
  
  -- CIF split
  invoice_amount_jpy NUMERIC,
  invoice_jpy_to_lkr_rate NUMERIC,
  undial_amount_jpy NUMERIC,
  undial_jpy_to_lkr_rate NUMERIC,

  -- Undial transfer (optional)
  undial_transfer_has_bank BOOLEAN,
  undial_transfer_bank_name TEXT,
  undial_transfer_acc_no TEXT,
  undial_transfer_date DATE,
  
  -- Local costs (LKR)
  tax_lkr NUMERIC,
  clearance_lkr NUMERIC,
  transport_lkr NUMERIC,
  local_extra1_label TEXT,
  local_extra1_lkr NUMERIC,
  local_extra2_label TEXT,
  local_extra2_lkr NUMERIC,
  local_extra3_label TEXT,
  local_extra3_lkr NUMERIC,
  
  -- Computed totals
  japan_total_lkr NUMERIC,
  final_total_lkr NUMERIC,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advances Table
CREATE TABLE IF NOT EXISTS advances (
  chassis_no TEXT PRIMARY KEY REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  expected_sell_price_lkr NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advance Payments Table
CREATE TABLE IF NOT EXISTS advance_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chassis_no TEXT NOT NULL REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  paid_date DATE NOT NULL,
  amount_lkr NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales Table
CREATE TABLE IF NOT EXISTS sales (
  chassis_no TEXT PRIMARY KEY REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  sold_price NUMERIC NOT NULL,
  sold_currency TEXT NOT NULL CHECK (sold_currency IN ('JPY', 'LKR')),
  rate_jpy_to_lkr NUMERIC,
  profit_lkr NUMERIC NOT NULL,
  sold_date DATE NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_address TEXT,
  buyer_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lease Collections Table
CREATE TABLE IF NOT EXISTS lease_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chassis_no TEXT NOT NULL REFERENCES vehicles(chassis_no) ON DELETE CASCADE,
  due_amount_lkr NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  collected BOOLEAN DEFAULT FALSE,
  collected_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 3: Enable Row Level Security
-- ============================================

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE advance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE lease_collections ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Create RLS Policies
-- (Drop existing policies first to avoid conflicts)
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users" ON vehicles;
DROP POLICY IF EXISTS "Allow authenticated users" ON advances;
DROP POLICY IF EXISTS "Allow authenticated users" ON advance_payments;
DROP POLICY IF EXISTS "Allow authenticated users" ON sales;
DROP POLICY IF EXISTS "Allow authenticated users" ON lease_collections;

-- Create new policies
CREATE POLICY "Allow authenticated users" ON vehicles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON advances FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON advance_payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON sales FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users" ON lease_collections FOR ALL USING (auth.role() = 'authenticated');


