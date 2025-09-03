/*
  # Simplify Everything - Remove All Complexity

  1. Drop Complex Tables
    - Remove user_profiles table completely
    - Remove departments table
    - Remove document_assignments table
    - Keep only: documents, annotations, activity_logs, notifications

  2. Simplify RLS Policies
    - Remove all complex policies
    - Use simple auth.uid() checks only
    - Make everything readable by authenticated users

  3. Clean Database
    - Remove all triggers and functions
    - Remove all constraints and foreign keys to dropped tables
*/

-- 1. Drop all complex tables and their dependencies
DROP TABLE IF EXISTS document_assignments CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- 2. Drop all triggers and functions
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
DROP FUNCTION IF EXISTS create_user_profile() CASCADE;
DROP FUNCTION IF EXISTS create_missing_profiles() CASCADE;

-- 3. Clean up documents table - remove any department references
ALTER TABLE documents DROP COLUMN IF EXISTS department_id CASCADE;

-- 4. Simplify all RLS policies

-- Documents: Simple ownership-based access
DROP POLICY IF EXISTS "Users can manage their own documents" ON documents;
DROP POLICY IF EXISTS "Users can read all documents" ON documents;
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

-- Annotations: Simple access
DROP POLICY IF EXISTS "Users can read all annotations" ON annotations;
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

-- Activity logs: Simple access
DROP POLICY IF EXISTS "Users can read all activity logs" ON activity_logs;
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

-- Notifications: Simple access
DROP POLICY IF EXISTS "Users can manage their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

CREATE POLICY "Users can manage their own notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());