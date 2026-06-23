/**
 * scripts/seed-admin-user.mjs
 *
 * Seeds the ScalePods admin user into the `public.users` table.
 * Uses bcryptjs to hash the password on-the-fly, then upserts
 * via the Supabase service-role client.
 *
 * Usage:
 *   node scripts/seed-admin-user.mjs
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Load .env.local manually (Next.js doesn't load it for plain node scripts)
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');

try {
    const envFile = readFileSync(envPath, 'utf-8');
    for (const line of envFile.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
            process.env[key.trim()] = valueParts.join('=').trim();
        }
    }
    console.log('✅  Loaded .env.local');
} catch {
    console.warn('⚠️  Could not load .env.local – falling back to existing process.env');
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL          = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.');
    process.exit(1);
}

const ADMIN_EMAIL     = 'info@scalepods.co';
const ADMIN_PASSWORD  = 'ScalePods@123';
const ADMIN_FULL_NAME = 'ScalePods Admin';

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log(`\n🔐  Hashing password for ${ADMIN_EMAIL} …`);
const salt         = await bcrypt.genSalt(10);
const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, salt);
console.log(`✅  Hash generated: ${passwordHash}`);

console.log(`\n📤  Upserting user into public.users …`);
const { data, error } = await supabase
    .from('users')
    .upsert(
        {
            email:                ADMIN_EMAIL,
            password_hash:        passwordHash,
            full_name:            ADMIN_FULL_NAME,
            is_active:            true,
            password_changed_at:  new Date().toISOString(),
        },
        { onConflict: 'email' }
    )
    .select()
    .single();

if (error) {
    console.error('❌  Upsert failed:', error.message);
    process.exit(1);
}

console.log('\n✅  Admin user upserted successfully!');
console.log('   ID:          ', data.id);
console.log('   Email:       ', data.email);
console.log('   Full Name:   ', data.full_name);
console.log('   Is Active:   ', data.is_active);
console.log('   Password Changed At:', data.password_changed_at);
console.log('\n🎉  You can now log in with:');
console.log('   Email:    info@scalepods.co');
console.log('   Password: ScalePods@123');
