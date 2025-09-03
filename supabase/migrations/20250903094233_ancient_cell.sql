/*
  # Create activity logs table

  1. New Tables
    - `activity_logs`
      - `id` (uuid, primary key)
      - `document_id` (uuid, foreign key to documents)
      - `user_id` (uuid, foreign key to auth.users)
      - `action` (text, required)
      - `created_at` (timestamp)
  2. Security
    - Enable RLS on `activity_logs` table
    - Add policies for activity log access
*/

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_activity_logs_document_id ON activity_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Users can read activity logs for documents they have access to
CREATE POLICY "Users can read activity logs for accessible documents"
  ON activity_logs
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

-- Users can create activity logs
CREATE POLICY "Users can create activity logs"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());