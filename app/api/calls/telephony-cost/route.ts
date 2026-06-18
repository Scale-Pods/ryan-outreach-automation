import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import RATES_DATA from '../../../../context/rates.json';

function cleanPhoneNumber(num: any): string {
    if (!num) return "Unknown";
    const str = String(num).replace(/\s+/g, '').replace(/\+/g, '').replace(/\D/g, '');
    if (!str || str.length < 5 || str.length > 22) return "Unknown";
    return str;
}

let ratesCache: any[] | null = null;
function getRateInfo(phoneNumber: string) {
    try {
        if (!ratesCache) {
            const ratesData = fs.readFileSync(path.join(process.cwd(), 'context', 'rates.json'), 'utf8');
            ratesCache = JSON.parse(ratesData);
        }
    } catch (e) {
        ratesCache = RATES_DATA;
    }
    const cleaned = cleanPhoneNumber(phoneNumber);
    if (cleaned === "Unknown") return null;
    const dataToFilter = Array.isArray(ratesCache) ? ratesCache : (Array.isArray(RATES_DATA) ? RATES_DATA : []);
    const matches = dataToFilter.filter((r: any) => cleaned.startsWith(String(r.Prefix)));
    if (matches.length === 0) return null;
    matches.sort((a, b) => String(b.Prefix).length - String(a.Prefix).length);
    return matches[0];
}

function calculateTelephonyCost(durationSecs: number, customerPhone: string, botPhone: string, isInbound: boolean) {
    // Inbound calls are always computed at $0.02
    if (isInbound) return durationSecs > 0 ? 0.02 : 0;
    if (!durationSecs || durationSecs <= 0) return 0;

    const cClean = cleanPhoneNumber(customerPhone);
    const bClean = cleanPhoneNumber(botPhone);

    // Special backup rates: US to UAE and UK to UAE
    const botIsUS = bClean.startsWith('1');
    const botIsUK = bClean.startsWith('44');
    const customerIsUAE = cClean.startsWith('971');

    if ((botIsUS || botIsUK) && customerIsUAE) {
        return Math.ceil(durationSecs / 60) * 0.2995;
    }

    // Default to rates.json matching
    const rateInfo = getRateInfo(cClean);
    if (!rateInfo) return 0;
    
    return Math.ceil(durationSecs / 60) * rateInfo.Rate;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const calls = body.calls || [];

        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioToken = process.env.TWILIO_AUTH_TOKEN;

        const results: Record<string, number> = {};

        await Promise.all(calls.map(async (call: any) => {
            const { id, phoneNumber: assistantNum, phone, durationSeconds, isInbound, startedAt } = call;
            const pClean = cleanPhoneNumber(assistantNum);
            const cClean = cleanPhoneNumber(phone);
            
            const botIsUS = pClean.startsWith('1');
            const botIsUK = pClean.startsWith('44');
            const customerIsUAE = cClean.startsWith('971');

            // 1. Special case: US/UK to UAE (Direct Backup Rate) - Only for Outbound
            if ((botIsUS || botIsUK) && customerIsUAE && !isInbound) {
                results[id] = durationSeconds > 0 ? Math.ceil(durationSeconds / 60) * 0.2995 : 0;
                return;
            }

            // 2. US/UK to ANY OTHER Country (Twilio API)
            if ((botIsUS || botIsUK) && twilioSid && twilioToken && startedAt) {
                try {
                    const callDate = new Date(startedAt);
                    const dateStr = callDate.toISOString().split('T')[0];
                    const customerClean = cleanPhoneNumber(phone);
                    const botClean = cleanPhoneNumber(assistantNum);
                    
                    const fromNum = isInbound ? `%2B${customerClean}` : `%2B${botClean}`;
                    const toNum = isInbound ? `%2B${botClean}` : `%2B${customerClean}`;

                    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json?From=${fromNum}&To=${toNum}&StartTime=${dateStr}`;
                    const twRes = await fetch(url, {
                        headers: { 'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64') }
                    });
                    
                    if (twRes.ok) {
                        const twData = await twRes.json();
                        const twCalls = twData.calls || [];
                        const matched = twCalls.find((tc: any) => {
                            const tcStart = new Date(tc.start_time).getTime();
                            const diff = Math.abs(tcStart - callDate.getTime());
                            const tcDur = parseInt(tc.duration);
                            const durDiff = Math.abs(tcDur - durationSeconds);
                            return diff < 120000 && (isNaN(tcDur) || durDiff < 20); 
                        });
                        
                        if (matched && matched.price) {
                            results[id] = Math.abs(parseFloat(matched.price));
                            return;
                        }
                    }

                    // Fallback: search by customer number if specific match failed
                    const fallbackParam = isInbound ? `From=%2B${customerClean}` : `To=%2B${customerClean}`;
                    const fbUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json?${fallbackParam}&StartTime=${dateStr}`;
                    const fbRes = await fetch(fbUrl, {
                        headers: { 'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64') }
                    });
                    if (fbRes.ok) {
                        const fbData = await fbRes.json();
                        const matched = (fbData.calls || []).find((tc: any) => {
                            const tcStart = new Date(tc.start_time).getTime();
                            return Math.abs(tcStart - callDate.getTime()) < 120000;
                        });
                        if (matched && matched.price) {
                            results[id] = Math.abs(parseFloat(matched.price));
                            return;
                        }
                    }
                } catch (e) {
                    console.error("Twilio fetch error", e);
                }
            }
            
            // 3. Fallback/UAE source/Inbound: Use rates.json or fixed logic
            results[id] = calculateTelephonyCost(durationSeconds, phone, assistantNum, isInbound);
        }));

        return NextResponse.json({ success: true, costs: results });
    } catch (e) {
        console.error("Telephony Cost API error:", e);
        return NextResponse.json({ error: "Failed to fetch telephony costs" }, { status: 500 });
    }
}
