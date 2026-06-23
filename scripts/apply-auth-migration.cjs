const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bmczioxbzuosqciekavn.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ybXhuZmhydWRxaml1d3dqb2RjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQ5NTE4MCwiZXhwIjoyMDk3MDcxMTgwfQ.e6q8tVC9eJXFyqwy78gZfBIQzuOmBaBr6qET0jtjOSU';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
    console.log('Applying auth migration...');

    // Create the users table
    const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
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

            GRANT ALL ON public.users TO anon, authenticated, service_role;

            INSERT INTO public.users (email, password_hash, full_name, is_active)
            VALUES (
                'info@scalepods.co',
                '$2b$10$nnrLniUWbr4DX0y7ZI1GkeP02nw2CJR0akmDe8jWRWPExuaNAKTBi',
                'ScalePods Admin',
                true
            )
            ON CONFLICT (email) DO NOTHING;
        `
    });

    if (createError) {
        console.error('RPC exec_sql failed:', createError.message);
        console.log('Trying direct SQL via raw query...');

        // Try creating table via raw POST to Supabase REST API
        const { error: tableError } = await supabase.from('users').select('id').limit(1);
        if (tableError && tableError.message?.includes('relation "users" does not exist')) {
            console.log('Users table needs to be created manually in Supabase SQL Editor.');
            console.log('Please run the SQL from supabase/migrations/010_users_table.sql in your Supabase dashboard.');
            console.log('Supabase URL: ' + supabaseUrl);
        } else if (tableError) {
            console.error('Error checking users table:', tableError.message);
        } else {
            console.log('Users table already exists!');
        }
    } else {
        console.log('Migration applied successfully!');
    }

    // Verify the user was seeded
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('email, full_name, is_active')
        .eq('email', 'info@scalepods.co')
        .single();

    if (userError) {
        console.error('Error checking seed user:', userError.message);
    } else {
        console.log('Seed user found:', JSON.stringify(user, null, 2));
        console.log('\n✓ Users table is ready!');
        console.log('✓ Seed user is inserted!');
        console.log('\nYou can now login with:');
        console.log('  Email:    info@scalepods.co');
        console.log('  Password: ScalePods@123');
    }
}

applyMigration();
