/**
 * Utility functions for parsing reply dates, extracting clean message contents, and dynamic reply filtering.
 */

export function parseMsgDate(str: any): Date | null {
    if (!str) return null;
    const text = String(str).trim();
    if (!text || ["no", "none", "0", "false"].includes(text.toLowerCase())) return null;

    // 1. ISO string match anywhere
    const isoMatch = text.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?/i);
    if (isoMatch) {
        const d = new Date(isoMatch[0]);
        if (!isNaN(d.getTime())) return d;
    }

    // 2. DD/MM/YYYY HH:mm:ss or DD/MM/YYYY HH:mm or DD/MM/YYYY match (handles 20/08/2026 10:35)
    const ddmmyyyy = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (ddmmyyyy) {
        const day = ddmmyyyy[1].padStart(2, '0');
        const month = ddmmyyyy[2].padStart(2, '0');
        const year = ddmmyyyy[3];
        const hh = (ddmmyyyy[4] || '00').padStart(2, '0');
        const mm = (ddmmyyyy[5] || '00').padStart(2, '0');
        const ss = (ddmmyyyy[6] || '00').padStart(2, '0');
        const parsed = new Date(`${year}-${month}-${day}T${hh}:${mm}:${ss}`);
        if (!isNaN(parsed.getTime())) return parsed;
    }

    // 3. US Date format match: MM/DD/YYYY, HH:MM:SS AM/PM or MM/DD/YYYY HH:MM:SS AM/PM
    const usMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    if (usMatch) {
        const [_, m, d, y, timeStr] = usMatch;
        const parsed = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')} ${timeStr}`);
        if (!isNaN(parsed.getTime())) return parsed;
    }

    // 4. Space-separated format match: YYYY-MM-DD HH:MM:SS
    const spaceMatch = text.match(/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/);
    if (spaceMatch) {
        const parsed = new Date(spaceMatch[0].replace(' ', 'T'));
        if (!isNaN(parsed.getTime())) return parsed;
    }

    // 5. Standard Date fallback if whole string is valid date
    const d = new Date(text);
    if (!isNaN(d.getTime())) return d;

    return null;
}

export function extractReplyDate(lead: any): Date | null {
    if (!lead) return null;

    // 1. Explicit replied_at timestamp
    if (lead.replied_at) {
        const d = new Date(lead.replied_at);
        if (!isNaN(d.getTime())) return d;
    }

    // 2. Check embedded dates in WhatsApp reply fields
    const wpFields = [
        lead.WP_Replied_track,
        lead["WP_Replied_track"],
        lead.whatsapp_replied,
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
        if (!str || ["no", "none", "0", "false"].includes(str.toLowerCase())) continue;
        const d = parseMsgDate(val);
        if (d) return d;
        // If string contains non-empty text (even without timestamp), use updated_at/created_at
        if (lead.updated_at) {
            const dUp = new Date(lead.updated_at);
            if (!isNaN(dUp.getTime())) return dUp;
        }
        if (lead.created_at || lead["Created At"]) {
            const dCr = new Date(lead.created_at || lead["Created At"]);
            if (!isNaN(dCr.getTime())) return dCr;
        }
    }

    // 3. Check embedded dates in Email reply fields
    const emailFields = [lead.email_replied, lead["Email Replied"]];
    for (const val of emailFields) {
        if (!val) continue;
        const str = String(val).trim();
        if (!str || ["no", "none", "0", "false"].includes(str.toLowerCase())) continue;
        const d = parseMsgDate(val);
        if (d) return d;
        if (lead.updated_at) {
            const dUp = new Date(lead.updated_at);
            if (!isNaN(dUp.getTime())) return dUp;
        }
        if (lead.created_at || lead["Created At"]) {
            const dCr = new Date(lead.created_at || lead["Created At"]);
            if (!isNaN(dCr.getTime())) return dCr;
        }
    }

    // 4. Activity created_at / updated_at ONLY IF this is an activity table record with inbound/reply action_type or reply status
    const actionType = String(lead.action_type || '').toLowerCase();
    const status = String(lead.status || '').toLowerCase();
    const rVal = String(lead.replied ?? '').toLowerCase().trim();
    const isActivityReply =
        (lead._source_table?.endsWith('_activity') || lead.channel || lead.action_type) &&
        (rVal === 'yes' || rVal === 'true' || rVal === '1' || status.includes('reply') || status.includes('replied') || actionType.includes('reply') || actionType.includes('inbound'));

    if (isActivityReply) {
        if (lead.updated_at) {
            const d = new Date(lead.updated_at);
            if (!isNaN(d.getTime())) return d;
        }
        if (lead.created_at || lead["Created At"] || lead.createdOn) {
            const d = new Date(lead.created_at || lead["Created At"] || lead.createdOn);
            if (!isNaN(d.getTime())) return d;
        }
    }

    return null;
}

export function cleanMessageContent(raw: any, fallback: string = "Lead replied"): string {
    if (!raw || !String(raw).trim()) return fallback;
    const str = String(raw).trim();

    // Strip ISO, US Date, DD/MM/YYYY, and YYYY-MM-DD timestamp suffixes/lines
    let clean = str
        .replace(/\n{1,2}\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?/gi, '')
        .replace(/\n{1,2}\d{1,2}\/\d{1,2}\/\d{4},?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?/gi, '')
        .replace(/\n{1,2}\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/gi, '')
        .replace(/\n?\s*(?:Date\s*&\s*Time|Date|Timestamp):\s*[^\n]+/gi, '')
        .replace(/^(?:Replied|replied)$/i, '')
        .trim();

    // If remaining content is empty or is just another date string, return fallback
    if (!clean || parseMsgDate(clean)) {
        return fallback;
    }

    return clean;
}
