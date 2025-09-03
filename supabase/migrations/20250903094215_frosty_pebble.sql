/*
  # Create document assignments table

  1. New Tables
    - `document_assignments`
      - `id` (uuid, primary key)
      - `document_id` (uuid, foreign key to documents)
      - `assigned_to_user_id` (uuid, foreign key to auth.users, nullable)
      - `assigned_to_department_id` (uuid, foreign key to departments, nullable)
      - `created_at` (timestamp)
  2. Security
    - Enable RLS on `document_assignments` table
    - Add policies for assignment access
  3. Constraints
    - Ensure either user or department is assigned (not both, not neither)
*/

CREATE TABLE IF NOT EXISTS document_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  assigned_to_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to_department_id uuid REFERENCES departments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  
  -- Constraint to ensure either user OR department is assigned, not both
  CONSTRAINT check_assignment_target 
    CHECK (
      (assigned_to_user_id IS NOT NULL AND assigned_to_department_id IS NULL) OR
      (assigned_to_user_id IS NULL AND assigned_to_department_id IS NOT NULL)
    )
);

ALTER TABLE document_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_document_assignments_document_id ON document_assignments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_assignments_user_id ON document_assignments(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_document_assignments_department_id ON document_assignments(assigned_to_department_id);

-- Users can read assignments for documents they can access
CREATE POLICY "Users can read document assignments"
  ON document_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d 
      WHERE d.id = document_id 
      AND d.uploaded_by_id = auth.uid()
    ) OR
    assigned_to_user_id = auth.uid() OR
    assigned_to_department_id IN (
      SELECT department_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Users can create assignments for their documents
CREATE POLICY "Users can create assignments for their documents"
  ON document_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d 
      WHERE d.id = document_id 
      AND d.uploaded_by_id = auth.uid()
    )
  );

-- Update documents policy to include assigned documents
CREATE POLICY "Users can read assigned documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (
    uploaded_by_id = auth.uid() OR
    id IN (
      SELECT document_id FROM document_assignments 
      WHERE assigned_to_user_id = auth.uid() OR
      assigned_to_department_id IN (
        SELECT department_id FROM user_profiles WHERE id = auth.uid()
      )
    )
  );