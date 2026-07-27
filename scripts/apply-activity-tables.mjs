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

const TABLES = ['aspen_activity', 'fello_activity', 'naples_activity', 'old_activity'];

async function checkTables() {
    console.log('Checking activity tables...\n');
    const results = {};

    for (const table of TABLES) {
        const { error } = await supabase.from(table).select('id').limit(1);
        if (error && error.message?.includes(`relation "${table}" does not exist`)) {
            results[table] = 'MISSING';
            console.log(`  ✗ ${table} — does NOT exist`);
        } else if (error && error.message?.includes('does not exist')) {
            results[table] = 'MISSING';
            console.log(`  ✗ ${table} — does NOT exist`);
        } else if (error) {
            // Could be a permissions error or the table exists but has issues
            results[table] = 'ERROR';
            console.log(`  ? ${table} — error: ${error.message}`);
        } else {
            results[table] = 'EXISTS';
            console.log(`  ✓ ${table} — exists`);
        }
    }

    return results;
}

async function apply() {
    const results = await checkTables();

    const missingTables = Object.entries(results).filter(([, s]) => s === 'MISSING').map(([t]) => t);

    if (missingTables.length === 0) {
        console.log('\n✓ All activity tables already exist!');
        return;
    }

    console.log(`\n${missingTables.length} table(s) need to be created: ${missingTables.join(', ')}`);

    const sqlFile = 'supabase/migrations/013_complete_activity_tables_schema.sql';
    const sql = fs.readFileSync(sqlFile, 'utf-8');

    // Try exec_sql RPC first
    console.log('\nAttempting to apply via exec_sql RPC...');
    const { error: rpcError } = await supabase.rpc('exec_sql', { query: sql });

    if (rpcError) {
        console.log('exec_sql not available (DDL restricted via REST API).\n');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║  Please run this SQL manually in your Supabase SQL Editor   ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('\nSQL File:', sqlFile);
        console.log('\nSteps:');
        console.log('  1. Go to https://supabase.com/dashboard');
        console.log('  2. Select your project (ormxnfhrudqjiuwdjodc)');
        console.log('  3. Navigate to SQL Editor');
        console.log('  4. Copy & paste the SQL below, then click Run\n');
        console.log('='.repeat(70));
        console.log(sql);
        console.log('='.repeat(70));
        process.exit(1);
    }

    console.log('✓ Migration applied successfully via RPC!');

    // Verify
    console.log('\nVerifying...');
    await checkTables();
}

apply().catch(console.error);
