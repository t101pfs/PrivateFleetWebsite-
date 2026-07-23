
-- =============================================
-- CRM TABLES (Sales only)
-- =============================================

-- Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  preferred_currency TEXT DEFAULT 'USD',
  billing_entity TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'prospect')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales can manage clients" ON public.clients
  FOR ALL USING (public.has_role(auth.uid(), 'sales'));

CREATE POLICY "Admin can view clients" ON public.clients
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  source TEXT,
  description TEXT,
  estimated_value NUMERIC,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales can manage leads" ON public.leads
  FOR ALL USING (public.has_role(auth.uid(), 'sales'));

CREATE POLICY "Admin can view leads" ON public.leads
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Opportunities table
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  route_from TEXT,
  route_to TEXT,
  departure_date DATE,
  return_date DATE,
  passengers INTEGER,
  estimated_value NUMERIC,
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'quoted', 'negotiation', 'won', 'lost')),
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales can manage opportunities" ON public.opportunities
  FOR ALL USING (public.has_role(auth.uid(), 'sales'));

CREATE POLICY "Admin can view opportunities" ON public.opportunities
  FOR SELECT USING (public.is_admin(auth.uid()));

-- =============================================
-- AIRCRAFT CATALOG TABLES (Operations only)
-- =============================================

-- Operators table
CREATE TABLE public.operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  aoc_number TEXT,
  country TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  insurance_expiry DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operations can manage operators" ON public.operators
  FOR ALL USING (public.has_role(auth.uid(), 'operations'));

CREATE POLICY "Admin can view operators" ON public.operators
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Aircraft table
CREATE TABLE public.aircraft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL,
  tail_number TEXT NOT NULL UNIQUE,
  aircraft_type TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  year_of_manufacture INTEGER,
  seating_capacity INTEGER,
  max_range_nm INTEGER,
  cruise_speed_kts INTEGER,
  base_airport TEXT,
  home_base_icao TEXT,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'in_flight', 'maintenance', 'reserved', 'inactive')),
  hourly_rate NUMERIC,
  images TEXT[],
  amenities TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.aircraft ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operations can manage aircraft" ON public.aircraft
  FOR ALL USING (public.has_role(auth.uid(), 'operations'));

CREATE POLICY "Admin can view aircraft" ON public.aircraft
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Maintenance windows
CREATE TABLE public.maintenance_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aircraft_id UUID REFERENCES public.aircraft(id) ON DELETE CASCADE NOT NULL,
  maintenance_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.maintenance_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operations can manage maintenance" ON public.maintenance_windows
  FOR ALL USING (public.has_role(auth.uid(), 'operations'));

CREATE POLICY "Admin can view maintenance" ON public.maintenance_windows
  FOR SELECT USING (public.is_admin(auth.uid()));

-- =============================================
-- QUOTATION ENGINE TABLES (Operations only)
-- =============================================

-- Rate cards
CREATE TABLE public.rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  aircraft_type TEXT,
  hourly_rate NUMERIC NOT NULL,
  minimum_hours NUMERIC DEFAULT 2,
  repositioning_fee NUMERIC DEFAULT 0,
  crew_overnight_rate NUMERIC DEFAULT 0,
  fuel_surcharge_percent NUMERIC DEFAULT 0,
  landing_fee_estimate NUMERIC DEFAULT 0,
  handling_fee_estimate NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  valid_from DATE,
  valid_until DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operations can manage rate cards" ON public.rate_cards
  FOR ALL USING (public.has_role(auth.uid(), 'operations'));

CREATE POLICY "Admin can view rate cards" ON public.rate_cards
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Quote number sequence
CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1000;

-- Quotes table
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  aircraft_id UUID REFERENCES public.aircraft(id) ON DELETE SET NULL,
  rate_card_id UUID REFERENCES public.rate_cards(id) ON DELETE SET NULL,
  route_from TEXT NOT NULL,
  route_to TEXT NOT NULL,
  departure_date DATE NOT NULL,
  return_date DATE,
  passengers INTEGER,
  flight_hours NUMERIC,
  base_price NUMERIC,
  fuel_surcharge NUMERIC DEFAULT 0,
  landing_fees NUMERIC DEFAULT 0,
  handling_fees NUMERIC DEFAULT 0,
  crew_costs NUMERIC DEFAULT 0,
  repositioning_costs NUMERIC DEFAULT 0,
  taxes NUMERIC DEFAULT 0,
  total_price NUMERIC,
  margin_percent NUMERIC,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')),
  valid_until DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operations can manage quotes" ON public.quotes
  FOR ALL USING (public.has_role(auth.uid(), 'operations'));

CREATE POLICY "Admin can view quotes" ON public.quotes
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Function to generate quote numbers
CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.quote_number := 'QT-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('quote_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_quote_number
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  WHEN (NEW.quote_number IS NULL OR NEW.quote_number = '')
  EXECUTE FUNCTION generate_quote_number();

-- =============================================
-- ANALYTICS TABLES (Admin only)
-- =============================================

-- Flight metrics for analytics
CREATE TABLE public.flight_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  aircraft_id UUID REFERENCES public.aircraft(id) ON DELETE SET NULL,
  flight_date DATE NOT NULL,
  route_from TEXT,
  route_to TEXT,
  flight_hours NUMERIC,
  revenue NUMERIC,
  costs NUMERIC,
  profit NUMERIC,
  passengers INTEGER,
  on_time BOOLEAN DEFAULT true,
  delay_minutes INTEGER DEFAULT 0,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.flight_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage flight metrics" ON public.flight_metrics
  FOR ALL USING (public.is_admin(auth.uid()));

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operators_updated_at BEFORE UPDATE ON public.operators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aircraft_updated_at BEFORE UPDATE ON public.aircraft
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_windows_updated_at BEFORE UPDATE ON public.maintenance_windows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_cards_updated_at BEFORE UPDATE ON public.rate_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
