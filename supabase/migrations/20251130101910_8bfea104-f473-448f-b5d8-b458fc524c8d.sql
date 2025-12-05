-- Create rooms table
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_number INTEGER NOT NULL UNIQUE CHECK (room_number >= 1 AND room_number <= 25),
  is_occupied BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tenants table
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  move_in_date DATE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  month TEXT NOT NULL,
  paid_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_tenants_room_id ON public.tenants(room_id);
CREATE INDEX idx_tenants_end_date ON public.tenants(end_date);
CREATE INDEX idx_payments_tenant_id ON public.payments(tenant_id);
CREATE INDEX idx_payments_month ON public.payments(month);

-- Insert all 25 rooms
INSERT INTO public.rooms (room_number) 
SELECT generate_series(1, 25);

-- Enable Row Level Security (landlord-only app, so allow all operations)
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create policies allowing all operations (since this is a landlord-only app)
CREATE POLICY "Allow all operations on rooms"
  ON public.rooms
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on tenants"
  ON public.tenants
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on payments"
  ON public.payments
  FOR ALL
  USING (true)
  WITH CHECK (true);