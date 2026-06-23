-- Create the users table for authentication
CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    email text NOT NULL,
    password_hash text NOT NULL,
    full_name text NULL,
    is_active bool NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    last_login timestamptz NULL,
    password_changed_at timestamptz NULL DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email)
) TABLESPACE pg_default;

-- Grant access to anon, authenticated, and service_role
GRANT ALL ON public.users TO anon, authenticated, service_role;

-- Seed the admin user
-- Password: ScalePods@123 (bcrypt hashed)
INSERT INTO public.users (email, password_hash, full_name, is_active)
VALUES (
    'info@scalepods.co',
    '$2b$10$nnrLniUWbr4DX0y7ZI1GkeP02nw2CJR0akmDe8jWRWPExuaNAKTBi',
    'ScalePods Admin',
    true
)
ON CONFLICT (email) DO NOTHING;
