-- ============================================================
-- Migration 011: Seed / update the ScalePods admin user
-- Password: ScalePods@123
-- Hash generated with bcryptjs (cost=10)
-- ============================================================

-- Ensure the users table exists (idempotent)
CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    email text NOT NULL,
    password_hash text NOT NULL,
    full_name text NULL,
    is_active boolean NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    last_login timestamp with time zone NULL,
    password_changed_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email)
) TABLESPACE pg_default;

-- Grant necessary permissions
GRANT ALL ON public.users TO anon, authenticated, service_role;

-- Upsert the admin credential
-- If the row exists, update password_hash and reset password_changed_at so it is not expired.
INSERT INTO public.users (email, password_hash, full_name, is_active, password_changed_at)
VALUES (
    'info@scalepods.co',
    '$2b$10$.JS3hD4iv8nzry4P0sxG1ukadTa6YvCSsDwbBUJ7agmh/WpK6UY/6',
    'ScalePods Admin',
    true,
    now()
)
ON CONFLICT (email) DO UPDATE
    SET password_hash        = EXCLUDED.password_hash,
        full_name            = EXCLUDED.full_name,
        is_active            = EXCLUDED.is_active,
        password_changed_at  = now();
