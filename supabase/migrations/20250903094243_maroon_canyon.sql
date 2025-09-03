/*
  # Seed database with test data

  1. Seed Data
    - Create 3 departments: Engineering, Marketing, HR
    - Create 3 test users with different departments
    - Create sample documents and assignments
    - Create sample annotations and activity logs
  2. Test Credentials
    - john.doe@company.com (Engineering) - password: password123
    - jane.smith@company.com (Marketing) - password: password123  
    - mike.johnson@company.com (HR) - password: password123
*/

-- Insert departments
INSERT INTO departments (id, name) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'Engineering'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Marketing'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Human Resources')
ON CONFLICT (name) DO NOTHING;

-- Note: Users will be created through Supabase Auth
-- The following are the credentials for testing:
-- john.doe@company.com / password123 (Engineering)
-- jane.smith@company.com / password123 (Marketing)  
-- mike.johnson@company.com / password123 (HR)

-- Insert sample documents (these will be created after users sign up)
-- Sample annotations and activity logs will be created through the application