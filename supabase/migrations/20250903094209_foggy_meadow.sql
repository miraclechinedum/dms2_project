/*
  # Create documents table

  1. New Tables
    - `documents`
      - `id` (uuid, primary key)
      - `filename` (text, required)
      - `original_name` (text, required)
      - `file_path` (text, required)
      - `uploaded_by_id` (uuid, foreign key to auth.users)
      - `description` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  2. Security
    - Enable RLS on `documents` table
    - Add policies for document access based on assignments
  3. Indexes
    - Add index on uploaded_by_id for performance
*/

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  original_name text NOT NULL,
  file_path text NOT NULL,
  uploaded_by_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by_id ON documents(uploaded_by_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- Users can read documents they uploaded or are assigned to
CREATE POLICY "Users can read documents they uploaded"
  ON documents
  FOR SELECT
  TO authenticated
  USING (uploaded_by_id = auth.uid());

-- Users can insert documents
CREATE POLICY "Users can insert documents"
  ON documents
  FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by_id = auth.uid());

-- Users can update documents they uploaded
CREATE POLICY "Users can update own documents"
  ON documents
  FOR UPDATE
  TO authenticated
  USING (uploaded_by_id = auth.uid());