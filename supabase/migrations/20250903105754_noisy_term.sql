/*
  # Simplify Authentication System

  1. Remove Complex Tables
    - Drop user_profiles table and all related complexity
    - Keep only essential tables: documents, annotations, activity_logs, notifications
    - Remove department assignments and complex RLS policies

  2. Simplify RLS Policies
    - Use simple auth.uid() checks
    - Remove all complex department-based policies
    - Focus on user ownership only

  3. Clean Up
    - Remove triggers and functions
    - Remove unnecessary constraints
*/

-- 1. Drop the complex user_profiles table and related objects
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
DROP FUNCTION IF EXISTS create_user_profile();
DROP FUNCTION IF EXISTS create_missing_profiles();
DROP TABLE IF EXISTS user_profiles CASCADE;

-- 2. Drop department-related tables since we're not using them
DROP TABLE IF EXISTS document_assignments CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- 3. Simplify documents table - remove department references
ALTER TABLE documents DROP COLUMN IF EXISTS department_id;

-- 4. Simplify RLS policies for documents
DROP POLICY IF EXISTS "Users can read documents they uploaded" ON documents;
DROP POLICY IF EXISTS "Users can read assigned documents" ON documents;
DROP POLICY IF EXISTS "Users can insert documents" ON documents;
DROP POLICY IF EXISTS "Users can update own documents" ON documents;

-- Simple document policies
CREATE POLICY "Users can manage their own documents"
  ON documents
  FOR ALL
  TO authenticated
  USING (uploaded_by_id = auth.uid())
  WITH CHECK (uploaded_by_id = auth.uid());

CREATE POLICY "Users can read all documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (true);

-- 5. Simplify annotations policies
DROP POLICY IF EXISTS "Users can read annotations on accessible documents" ON annotations;
DROP POLICY IF EXISTS "Users can create annotations on accessible documents" ON annotations;
DROP POLICY IF EXISTS "Users can update own annotations" ON annotations;

CREATE POLICY "Users can read all annotations"
  ON annotations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own annotations"
  ON annotations
  FOR ALL
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- 6. Simplify activity logs policies
DROP POLICY IF EXISTS "Users can read activity logs for accessible documents" ON activity_logs;
DROP POLICY IF EXISTS "Users can create activity logs" ON activity_logs;

CREATE POLICY "Users can read all activity logs"
  ON activity_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create activity logs"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 7. Simplify notifications policies
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

CREATE POLICY "Users can manage their own notifications"
  ON notifications
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());