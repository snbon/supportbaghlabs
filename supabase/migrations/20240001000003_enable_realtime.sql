-- Enable Supabase Realtime for the tickets table so clients
-- receive live updates when ticket status or labels change via webhook.
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
