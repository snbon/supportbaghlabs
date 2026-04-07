-- Create a public bucket for ticket attachments (images + PDFs)
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
  true,
  ARRAY['image/jpeg','image/png','application/pdf'],
  10485760  -- 10 MB per file
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to this bucket
CREATE POLICY "ticket-attachments: auth upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ticket-attachments');

-- Anyone can read (URLs are embedded in GitHub comments)
CREATE POLICY "ticket-attachments: public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'ticket-attachments');
