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

function isTrueWpReply(lead) {
    if (!lead) return false;
    
    // 1. Check explicit WhatsApp reply content columns
    const wpFields = [
        lead.whatsapp_replied,
        lead.stage_data?.["WhatsApp Replied"],
        lead["W.P_Replied 1"],
        lead["W.P_Replied_1"],
    ];
    for (let i = 1; i <= 10; i++) {
        wpFields.push(lead[`W.P_Replied_${i}`]);
        wpFields.push(lead[`W.P_Replied ${i}`]);
    }
    for (const val of wpFields) {
        if (!val) continue;
        const str = String(val).trim();
        if (str && !["no", "none", "0", "false", "replied"].includes(str.toLowerCase())) {
            return true;
        }
    }

    // 2. Check WP_Replied_track for actual reply text (not just generic word "Replied")
    const track = String(lead.WP_Replied_track || lead["WP_Replied_track"] || "").trim();
    if (track && !["no", "none", "0", "false", "replied"].includes(track.toLowerCase())) {
        return true;
    }

    // 3. For WhatsApp activity table logs: must be inbound/reply action or have replied_at
    const channel = String(lead.channel || '').toLowerCase();
    const isWaChannel = channel.includes('whatsapp') || channel.includes('wp') || lead._source_table?.includes('wa');
    if (isWaChannel || lead.source_loop === "Activity") {
        const status = String(lead.status || '').toLowerCase();
        const actionType = String(lead.action_type || '').toLowerCase();
        if (!!lead.replied_at || status.includes('reply') || status.includes('replied') || actionType.includes('reply') || actionType.includes('inbound')) {
            return true;
        }
    }

    return false;
}

async function testFix() {
    const phones = ['12173414430', '12155345158', '16305384300', '17812175029'];
    for (const p of phones) {
        const { data } = await supabaseAdmin.from('naples_leads').select('*').eq('phone', p);
        if (data && data.length > 0) {
            const lead = data[0];
            console.log(`Lead ${lead.name} (${p}): isTrueWpReply = ${isTrueWpReply(lead)}`);
        }
    }
}

testFix();
