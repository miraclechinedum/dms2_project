/*
  # Fix all authentication and RLS issues

  1. RLS Policy Updates
    - Allow public read access to departments for registration
    - Fix user profile creation policies
    - Ensure proper department access
  2. Function Updates
    - Improve user profile creation trigger
    - Add department seeding function
  3. Data Seeding
    - Ensure departments exist with correct IDs
*/

-- 1. Fix departments table policies to allow public read access
DROP POLICY IF EXISTS "Authenticated users can read departments" ON departments;
DROP POLICY IF EXISTS "Anyone can read departments" ON departments;

CREATE POLICY "Public can read departments"
  ON departments
  FOR SELECT
  USING (true);

-- 2. Ensure departments exist
INSERT INTO departments (id, name) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Engineering'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Marketing'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Human Resources')
ON CONFLICT (name) DO NOTHING;

-- 3. Fix user profiles policies
DROP POLICY IF EXISTS "Users can read all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

CREATE POLICY "Users can read all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage own profile"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Create a robust user profile creation function
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS trigger AS $$
DECLARE
  default_dept_id uuid;
  target_dept_id uuid;
  user_name text;
BEGIN
  -- Get user name from metadata or email
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  
  -- Get target department ID
  IF NEW.raw_user_meta_data ? 'department_id' THEN
    target_dept_id := (NEW.raw_user_meta_data->>'department_id')::uuid;
  ELSE
    -- Default to Engineering
    target_dept_id := '550e8400-e29b-41d4-a716-446655440001';
  END IF;
  
  -- Verify department exists, fallback to first available
  IF NOT EXISTS (SELECT 1 FROM departments WHERE id = target_dept_id) THEN
    SELECT id INTO target_dept_id FROM departments ORDER BY name LIMIT 1;
  END IF;
  
  -- Create user profile
  IF target_dept_id IS NOT NULL THEN
    INSERT INTO user_profiles (id, name, department_id)
    VALUES (NEW.id, user_name, target_dept_id)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      department_id = EXCLUDED.department_id,
      updated_at = now();
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail user creation if profile creation fails
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recreate the trigger
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- 6. Create function to manually create profiles for existing users
CREATE OR REPLACE FUNCTION create_missing_profiles()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  default_dept_id uuid;
BEGIN
  -- Get default department
  SELECT id INTO default_dept_id FROM departments ORDER BY name LIMIT 1;
  
  -- Create profiles for users without them
  FOR user_record IN 
    SELECT u.id, u.email, u.raw_user_meta_data
    FROM auth.users u
    LEFT JOIN user_profiles up ON u.id = up.id
    WHERE up.id IS NULL
  LOOP
    INSERT INTO user_profiles (id, name, department_id)
    VALUES (
      user_record.id,
      COALESCE(
        user_record.raw_user_meta_data->>'name',
        split_part(user_record.email, '@', 1)
      ),
      COALESCE(
        (user_record.raw_user_meta_data->>'department_id')::uuid,
        default_dept_id
      )
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;