-- Add M-Pesa reference field to payments table
ALTER TABLE public.payments 
ADD COLUMN mpesa_ref TEXT;