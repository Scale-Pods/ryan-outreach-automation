import { NextResponse } from 'next/server';
import { consolidateLeads } from "@/lib/leads-utils";

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ customerId: string }> }) {
    const { customerId } = await params;
    const decodedId = decodeURIComponent(customerId);
    const searchVal = decodedId.toLowerCase().trim();
    const searchPhoneRaw = searchVal.replace(/\D/g, '');
    const searchPhone = (searchPhoneRaw.length >= 7 && searchPhoneRaw.length <= 15) ? searchPhoneRaw : '';

    // Handle prefixed IDs (intro-xxx, followup-xxx, nurture-xxx, master-xxx)
    const prefixes = ['intro-', 'followup-', 'nurture-', 'master-', 'owner-'];
    let rawId = searchVal;
    let explicitOwner = false;
    
    if (searchVal.startsWith('owner-')) {
        explicitOwner = true;
    }

    for (const prefix of prefixes) {
        if (searchVal.startsWith(prefix)) {
            rawId = searchVal.slice(prefix.length);
            break;
        }
    }

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
    const secretKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    if (!supabaseUrl || !secretKey) {
        return NextResponse.json({ error: "Config missing" }, { status: 500 });
    }

    const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
    const commonHeaders = {
        "apikey": secretKey,
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json"
    };

    const fetchSingle = async (tableName: string, idFields: string[], phoneFields: string[] = []) => {
        const idFilters = idFields.map(field => {
            const quotedField = field.includes(' ') ? `"${field}"` : field;
            return `${quotedField}.eq.${rawId}`;
        }).join(',');
        let orParts = [idFilters];
        
        if (searchPhone) {
            phoneFields.forEach(field => {
                const quotedField = field.includes(' ') ? `"${field}"` : field;
                if (tableName === 'owner_data' && field === 'contactNo') {
                    // contactNo is a bigint/number in owner_data, so ilike will fail.
                    // We use eq for an exact match.
                    orParts.push(`${quotedField}.eq.${searchPhone}`);
                } else {
                    orParts.push(`${quotedField}.ilike.*${searchPhone}*`);
                }
            });
        }
        
        const url = `${baseUrl}/${tableName}?select=*&or=(${orParts.join(',')})`;

        try {
            const response = await fetch(url, { headers: commonHeaders, cache: 'no-store' });
            if (!response.ok) {
                const text = await response.text();
                console.error(`Public API: Error fetching from ${tableName}:`, text);
                return [];
            }
            const data = await response.json();
            return data;
        } catch (err: any) {
            console.error(`Public API: Fetch error for ${tableName}:`, err);
            return [];
        }
    };

    try {
        console.log(`Public API: Searching for ${searchVal} (rawId: ${rawId}, phone: ${searchPhone}, explicitOwner: ${explicitOwner})`);
        
        // Search across all possible tables
        // Note: Lead tables use "Lead ID", Owner table uses "id" or "Lead ID"
        const [nr_wf, followup, nurture, owner_data, master_leads] = await Promise.all([
            fetchSingle("nr_wf", ["Lead ID"], ["Phone"]),
            fetchSingle("followup", ["Lead ID"], ["Phone"]),
            fetchSingle("nurture", ["Lead ID"], ["Phone"]),
            fetchSingle("owner_data", ["id"], ["contactNo"]),
            fetchSingle("master_leads", ["Lead ID"], ["Phone", "phone"])
        ]);

        console.log(`Public API: Results - nr_wf: ${nr_wf.length}, followup: ${followup.length}, nurture: ${nurture.length}, owner_data: ${owner_data.length}, master_leads: ${master_leads.length}`);

        // Handle results
        const results: any = { lead: null, owner: null };

        if (owner_data.length > 0) {
            console.log("Public API: Found in owner_data");
            results.owner = owner_data[0];
        }

        // Always check leads too
        const consolidated = consolidateLeads({
            nr_wf,
            followup,
            nurture,
            master_leads
        });

        console.log(`Public API: Consolidated leads: ${consolidated.length}`);

        if (consolidated.length > 0) {
            const match = consolidated.find(l => l.id.toLowerCase() === searchVal || l.phone.replace(/\D/g, '') === searchPhone) || consolidated[0];
            console.log(`Public API: Found lead ${match.id}`);
            results.lead = match;
        }

        // If explicit owner was requested, and we found an owner, we can optionally clear the lead 
        // to force the owner tab in the frontend, OR just let the frontend handle it.
        // The frontend currently prefers lead if both exist.

        if (results.lead || results.owner) {
            return NextResponse.json(results);
        }

        console.log("Public API: No match found");
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });


    } catch (error: any) {
        console.error('Public API: Global error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
