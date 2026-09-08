import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length > 0) {
        envVars[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
    }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkClifford() {
    console.log("=== Checking Clifford Hughes, Scott Elias, Lauren Anderson ===");
    const phones = ['12173414430', '12155345158', '16305384300'];
    const tables = ['naples_leads', 'fello_leads', 'aspen_leads', 'master_leads', 'nr_wf', 'followup', 'nurture'];

    for (const phone of phones) {
        for (const tbl of tables) {
            try {
                const { data } = await supabaseAdmin.from(tbl).select('*').eq('phone', phone);
                if (data && data.length > 0) {
                    console.log(`\nTable ${tbl} for ${phone}:`, JSON.stringify(data[0], null, 2));
                }
            } catch (e) {}
        }
    }
}

checkClifford();
