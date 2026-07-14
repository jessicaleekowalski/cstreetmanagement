
-- Monthly income & expenses per property
CREATE TABLE public.property_financials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  gross_income numeric(14,2) NOT NULL DEFAULT 0,
  operating_expenses numeric(14,2) NOT NULL DEFAULT 0,
  other_income numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, period_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_financials TO authenticated;
GRANT ALL ON public.property_financials TO service_role;
ALTER TABLE public.property_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financials_manager_all" ON public.property_financials FOR ALL TO authenticated
  USING (public.user_manages_property(property_id)) WITH CHECK (public.user_manages_property(property_id));
CREATE POLICY "financials_owner_read" ON public.property_financials FOR SELECT TO authenticated
  USING (public.user_owns_property(property_id));

CREATE TRIGGER trg_property_financials_updated BEFORE UPDATE ON public.property_financials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Annual budget line items
CREATE TABLE public.property_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  year int NOT NULL,
  category text NOT NULL,
  budgeted_amount numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, year, category)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_budgets TO authenticated;
GRANT ALL ON public.property_budgets TO service_role;
ALTER TABLE public.property_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "budgets_manager_all" ON public.property_budgets FOR ALL TO authenticated
  USING (public.user_manages_property(property_id)) WITH CHECK (public.user_manages_property(property_id));
CREATE POLICY "budgets_owner_read" ON public.property_budgets FOR SELECT TO authenticated
  USING (public.user_owns_property(property_id));

CREATE TRIGGER trg_property_budgets_updated BEFORE UPDATE ON public.property_budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Line-item GL transactions
CREATE TABLE public.gl_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  txn_date date NOT NULL,
  txn_type text NOT NULL CHECK (txn_type IN ('income','expense')),
  category text,
  vendor text,
  description text,
  amount numeric(14,2) NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gl_txn_property_date ON public.gl_transactions(property_id, txn_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gl_transactions TO authenticated;
GRANT ALL ON public.gl_transactions TO service_role;
ALTER TABLE public.gl_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gl_manager_all" ON public.gl_transactions FOR ALL TO authenticated
  USING (public.user_manages_property(property_id)) WITH CHECK (public.user_manages_property(property_id));
CREATE POLICY "gl_owner_read" ON public.gl_transactions FOR SELECT TO authenticated
  USING (public.user_owns_property(property_id));

CREATE TRIGGER trg_gl_transactions_updated BEFORE UPDATE ON public.gl_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Property valuations (for cap rate)
CREATE TABLE public.property_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  market_value numeric(14,2) NOT NULL,
  source text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, as_of_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_valuations TO authenticated;
GRANT ALL ON public.property_valuations TO service_role;
ALTER TABLE public.property_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "val_manager_all" ON public.property_valuations FOR ALL TO authenticated
  USING (public.user_manages_property(property_id)) WITH CHECK (public.user_manages_property(property_id));
CREATE POLICY "val_owner_read" ON public.property_valuations FOR SELECT TO authenticated
  USING (public.user_owns_property(property_id));

CREATE TRIGGER trg_property_valuations_updated BEFORE UPDATE ON public.property_valuations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
