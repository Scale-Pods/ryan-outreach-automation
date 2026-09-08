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
    const tables = ['naples_leads', 'fello_leads', 'aspen_leads', 'master_leads'];

    for (const phone of phones) {
        for (const tbl of tables) {
            try {
                const { data } = await supabaseAdmin.from(tbl).select('*').eq('phone', phone);
                if (data && data.length > 0) {
                    const row = data[0];
                    console.log(`Table ${tbl} for ${phone} (${row.name}):`, {
                        id: row.id,
                        name: row.name,
                        phone: row.phone,
                        replied: row.replied,
                        WP_Replied_track: row.WP_Replied_track,
                        whatsapp_replied: row.whatsapp_replied,
                        "W.P_Replied 1": row["W.P_Replied 1"],
                        "W.P_1": row["W.P_1"],
                        "1st_wa_ts": row["1st_wa_ts"],
                        created_at: row.created_at,
                        updated_at: row.updated_at,
                        next_whatsapp_at: row.next_whatsapp_at,
                    });
                }
            } catch (e) {}
        }
    }
}

checkClifford();
