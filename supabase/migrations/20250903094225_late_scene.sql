/*
  # Create annotations table

  1. New Tables
    - `annotations`
      - `id` (uuid, primary key)
      - `document_id` (uuid, foreign key to documents)
      - `author_id` (uuid, foreign key to auth.users)
      - `type` (text, annotation type)
      - `page_number` (integer, required)
      - `content` (jsonb, coordinates and content data)
      - `sequence_number` (integer, for ordering)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  2. Security
    - Enable RLS on `annotations` table
    - Add policies for annotation access
*/

CREATE TABLE IF NOT EXISTS annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'sticky_note',
  page_number integer NOT NULL DEFAULT 1,
  content jsonb NOT NULL DEFAULT '{}',
  sequence_number integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_annotations_document_id ON annotations(document_id);
CREATE INDEX IF NOT EXISTS idx_annotations_author_id ON annotations(author_id);
CREATE INDEX IF NOT EXISTS idx_annotations_page_number ON annotations(page_number);

-- Users can read annotations on documents they have access to
CREATE POLICY "Users can read annotations on accessible documents"
  ON annotations
  FOR SELECT
  TO authenticated
  USING (
    document_id IN (
      SELECT id FROM documents 
      WHERE uploaded_by_id = auth.uid() OR
      id IN (
        SELECT document_id FROM document_assignments 
        WHERE assigned_to_user_id = auth.uid() OR
        assigned_to_department_id IN (
          SELECT department_id FROM user_profiles WHERE id = auth.uid()
        )
      )
    )
  );

-- Users can create annotations on accessible documents
CREATE POLICY "Users can create annotations on accessible documents"
  ON annotations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND
    document_id IN (
      SELECT id FROM documents 
      WHERE uploaded_by_id = auth.uid() OR
      id IN (
        SELECT document_id FROM document_assignments 
        WHERE assigned_to_user_id = auth.uid() OR
        assigned_to_department_id IN (
          SELECT department_id FROM user_profiles WHERE id = auth.uid()
        )
      )
    )
  );

-- Users can update their own annotations
CREATE POLICY "Users can update own annotations"
  ON annotations
  FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid());