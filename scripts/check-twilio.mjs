import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');

const envFile = readFileSync(envPath, 'utf-8');
for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
    }
}

const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;

if (!sid || !token) {
    console.error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in .env.local');
    process.exit(1);
}

const auth = Buffer.from(`${sid}:${token}`).toString('base64');
const headers = { Authorization: `Basic ${auth}` };

async function checkTwilio() {
    try {
        const [balRes, usageRes, callsRes] = await Promise.all([
            fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`, { headers }).then(r => r.json()),
            fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Usage/Records.json?Category=totalprice`, { headers }).then(r => r.json()),
            fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json?PageSize=15`, { headers }).then(r => r.json())
        ]);

        console.log('====================================');
        console.log('📌 TWILIO ACCOUNT OVERVIEW');
        console.log('====================================');
        console.log('Account SID:           ', balRes.account_sid);
        console.log('Current Balance:       ', `$${parseFloat(balRes.balance).toFixed(2)} ${balRes.currency}`);
        
        const used = parseFloat(usageRes.usage_records?.[0]?.price || '0');
        const balance = parseFloat(balRes.balance || '0');
        const totalRecharge = balance + used;
        
        console.log('Total Usage Spent:     ', `$${used.toFixed(2)} USD`);
        console.log('Total Lifetime Recharge:', `$${totalRecharge.toFixed(2)} USD`);

        console.log('\n====================================');
        console.log('📞 RECENT CALLS & INDIVIDUAL COSTS');
        console.log('====================================');
        if (callsRes.calls && callsRes.calls.length > 0) {
            callsRes.calls.forEach((c, idx) => {
                const cost = c.price ? `$${Math.abs(parseFloat(c.price)).toFixed(4)} ${c.price_unit}` : 'Free / Pending';
                console.log(`[${idx + 1}] Date: ${c.start_time}`);
                console.log(`    From: ${c.from} ➔ To: ${c.to}`);
                console.log(`    Duration: ${c.duration}s | Status: ${c.status}`);
                console.log(`    Cost: ${cost}`);
                console.log('------------------------------------');
            });
        } else {
            console.log('No recent call records found on this account.');
        }
    } catch (err) {
        console.error('Error fetching Twilio data:', err);
    }
}

checkTwilio();
