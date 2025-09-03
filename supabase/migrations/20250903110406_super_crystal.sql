/*
  # Simplify System But Keep Departments

  1. Keep Tables
    - Keep `departments` table (needed for the app)
    - Keep `documents`, `annotations`, `activity_logs`, `notifications`
    - Remove `user_profiles` and `document_assignments` (too complex)

  2. Simplify RLS Policies
    - Remove all complex policies
    - Use simple auth.uid() checks only
    - Make departments readable by everyone

  3. Clean Up
    - Remove all triggers and functions
    - Remove user profile dependencies
*/

-- 1. Drop complex tables we don't need
DROP TABLE IF EXISTS document_assignments CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- 2. Drop all triggers and functions
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
DROP FUNCTION IF EXISTS create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS create_missing_profiles() CASCADE;

-- 3. Keep departments but make them simple to read
DROP POLICY IF EXISTS "Public can read departments" ON departments;
DROP POLICY IF EXISTS "Authenticated users can read departments" ON departments;
DROP POLICY IF EXISTS "Authenticated users can create departments" ON departments;
DROP POLICY IF EXISTS "Authenticated users can update departments" ON departments;

CREATE POLICY "Anyone can read departments"
  ON departments FOR SELECT
  USING (true);

-- 4. Simplify documents table and policies
ALTER TABLE documents DROP COLUMN IF EXISTS department_id CASCADE;

DROP POLICY IF EXISTS "Authenticated users can read all documents" ON documents;
DROP POLICY IF EXISTS "Users can manage their own documents" ON documents;
DROP POLICY IF EXISTS "Users can read documents they uploaded" ON documents;
DROP POLICY IF EXISTS "Users can read assigned documents" ON documents;
DROP POLICY IF EXISTS "Users can insert documents" ON documents;
DROP POLICY IF EXISTS "Users can update own documents" ON documents;

CREATE POLICY "Authenticated users can read all documents"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own documents"
  ON documents FOR ALL
  TO authenticated
  USING (uploaded_by_id = auth.uid())
  WITH CHECK (uploaded_by_id = auth.uid());

-- 5. Simplify annotations policies
DROP POLICY IF EXISTS "Authenticated users can read all annotations" ON annotations;
DROP POLICY IF EXISTS "Users can manage their own annotations" ON annotations;
DROP POLICY IF EXISTS "Users can read annotations on accessible documents" ON annotations;
DROP POLICY IF EXISTS "Users can create annotations on accessible documents" ON annotations;
DROP POLICY IF EXISTS "Users can update own annotations" ON annotations;

CREATE POLICY "Authenticated users can read all annotations"
  ON annotations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own annotations"
  ON annotations FOR ALL
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- 6. Simplify activity logs policies
DROP POLICY IF EXISTS "Authenticated users can read all activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Users can create activity logs" ON activity_logs;
DROP POLICY IF EXISTS "Users can read activity logs for accessible documents" ON activity_logs;

CREATE POLICY "Authenticated users can read all activity logs"
  ON activity_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create activity logs"
  ON activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 7. Simplify notifications policies
DROP POLICY IF EXISTS "Users can manage their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

CREATE POLICY "Users can manage their own notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 8. Ensure departments exist (keep the existing ones)
INSERT INTO departments (id, name) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Engineering'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Marketing'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Human Resources')
ON CONFLICT (name) DO NOTHING;