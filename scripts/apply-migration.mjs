import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envRaw = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envRaw.split('\n')) {
    const m = line.match(/^([^=]+)=(.*)/);
    if (m) env[m[1].trim()] = m[2].trim();
}

const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const key = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!url || !key) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(url, key);

async function apply() {
    const { error: checkError } = await supabase.from('users').select('id').limit(1);

    if (checkError && checkError.message?.includes('relation "users" does not exist')) {
        console.log('Users table does not exist. Trying exec_sql...');

        const sql = fs.readFileSync('supabase/migrations/010_users_table.sql', 'utf-8');
        const { error: rawError } = await supabase.rpc('exec_sql', { query: sql });

        if (rawError) {
            console.log('exec_sql not available (DDL restricted via REST API).');
            console.log('\nRun this SQL in your Supabase SQL Editor:');
            console.log('='.repeat(60));
            console.log(sql);
            console.log('='.repeat(60));
            console.log('\nSupabase Dashboard: https://supabase.com/dashboard');
            console.log('Project ref from keys:', 'ormxnfhrudqjiuwdjodc');
            console.log('Go to SQL Editor → paste → Run');
            process.exit(1);
        }
        console.log('Migration applied!');
    } else if (checkError) {
        console.error('Error:', checkError.message);
        process.exit(1);
    } else {
        console.log('Users table already exists.');
    }

    const { data: user } = await supabase
        .from('users')
        .select('email, full_name, is_active')
        .eq('email', 'info@scalepods.co')
        .maybeSingle();

    if (user) {
        console.log('✓ Seed user found:', user.email);
    } else {
        console.log('Seed user not found. Inserting...');
        const { error: insErr } = await supabase.from('users').insert({
            email: 'info@scalepods.co',
            password_hash: '$2b$10$nnrLniUWbr4DX0y7ZI1GkeP02nw2CJR0akmDe8jWRWPExuaNAKTBi',
            full_name: 'ScalePods Admin',
            is_active: true
        });
        if (insErr) {
            console.error('Insert failed:', insErr.message);
        } else {
            console.log('✓ Seed user inserted!');
        }
    }

    console.log('\nLogin at http://localhost:3000');
    console.log('  Email:    info@scalepods.co');
    console.log('  Password: ScalePods@123');
}

apply().catch(console.error);
