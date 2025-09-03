/*
  # Create departments table

  1. New Tables
    - `departments`
      - `id` (uuid, primary key)
      - `name` (text, unique, required)
      - `created_at` (timestamp)
  2. Security
    - Enable RLS on `departments` table
    - Add policy for authenticated users to read departments
*/

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read departments"
  ON departments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create departments"
  ON departments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update departments"
  ON departments
  FOR UPDATE
  TO authenticated
  USING (true);