import { format } from "date-fns";

export interface EmailTableStat {
    name: string;
    totalLeads: number;
    emails: number;
    replies: number;
    unsubscribed: number;
}

export interface EmailMetricsResult {
    totalEmails: number;
    totalSent: number;
    firstEmailCount: number;
    replyCount: number;
    totalReplies: number;
    unsubscribedCount: number;
    totalUnsubscribed: number;
    totalLeadsCount: number;
    totalLeads: number;
    replyRate: string;
    unsubRate: string;
    tableStats: {
        naples: EmailTableStat;
        aspen: EmailTableStat;
        old: EmailTableStat;
        fello: EmailTableStat;
    };
    dailyChartData: { date: string; sent: number; replies: number }[];
}

export function getLeadSourceTableKey(lead: any): 'naples' | 'aspen' | 'old' | 'fello' {
    const src = String(
        lead._source_table ||
        lead.source_table ||
        lead.sourceTable ||
        lead.source_loop ||
        lead.source ||
        lead.campaign ||
        ''
    ).toLowerCase();

    if (src.includes('aspen')) return 'aspen';
    if (src.includes('fello')) return 'fello';
    if (src.includes('old') || src.includes('master')) return 'old';
    if (src.includes('naples')) return 'naples';
    return 'naples';
}

function parseMsgDate(content: any): Date | null {
    if (!content) return null;
    if (typeof content === 'number') return new Date(content);
    const s = String(content).trim();
    if (!s) return null;

    const ddmmyyyy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (ddmmyyyy) {
        const day = ddmmyyyy[1].padStart(2, '0');
        const month = ddmmyyyy[2].padStart(2, '0');
        const year = ddmmyyyy[3];
        const hh = (ddmmyyyy[4] || '00').padStart(2, '0');
        const mm = (ddmmyyyy[5] || '00').padStart(2, '0');
        const ss = (ddmmyyyy[6] || '00').padStart(2, '0');
        const d = new Date(`${year}-${month}-${day}T${hh}:${mm}:${ss}.000Z`);
        if (!isNaN(d.getTime())) return d;
    }

    const lines = s.split('\n');
    const lastLine = lines[lines.length - 1].trim();
    const dateObj = new Date(lastLine.replace(' ', 'T'));
    if (!isNaN(dateObj.getTime()) && lastLine.includes('-') && lastLine.includes(':')) {
        return dateObj;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

export function calculateEmailMetrics(
    allLeads: any[],
    dateRange?: { from?: Date; to?: Date }
): EmailMetricsResult {
    const fromD = dateRange?.from ? new Date(dateRange.from) : null;
    const toD = dateRange?.to ? new Date(dateRange.to) : (fromD ? new Date(fromD) : null);
    if (fromD) fromD.setHours(0, 0, 0, 0);
    if (toD) toD.setHours(23, 59, 59, 999);

    const checkDate = (d: Date | null) => {
        if (!fromD || !toD) return true;
        if (!d || isNaN(d.getTime())) return true;
        return d >= fromD && d <= toD;
    };

    let totalEmails = 0;
    let firstEmailCount = 0;
    let replyCount = 0;
    let unsubscribedCount = 0;
    let totalLeadsCount = 0;

    const tableStats = {
        naples: { name: "Naples (naples_activity)", totalLeads: 0, emails: 0, replies: 0, unsubscribed: 0 },
        aspen: { name: "Aspen (aspen_activity)", totalLeads: 0, emails: 0, replies: 0, unsubscribed: 0 },
        old: { name: "Old Leads (old_activity)", totalLeads: 0, emails: 0, replies: 0, unsubscribed: 0 },
        fello: { name: "Fello (fello_activity)", totalLeads: 0, emails: 0, replies: 0, unsubscribed: 0 },
    };

    const dailyMap: Record<string, { date: string; sent: number; replies: number }> = {};
    const processedIds = new Set<string>();

    (allLeads || []).forEach((lead: any) => {
        if (lead.id && processedIds.has(String(lead.id))) return;
        if (lead.id) processedIds.add(String(lead.id));

        const tableKey = getLeadSourceTableKey(lead);
        const channel = String(lead.channel || '').toLowerCase();
        const actionType = String(lead.action_type || '').toLowerCase();
        const status = String(lead.status || '').toLowerCase();

        // 1. Activity Table Records (aspen_activity, fello_activity, naples_activity, old_activity)
        if (lead._source_table || channel) {
            const isEmail = channel.includes('email') || actionType.includes('email');

            if (isEmail && channel !== 'voice' && channel !== 'whatsapp' && channel !== 'sms') {
                const rawDate = lead.created_at || lead.updated_at || lead['1st_email_ts'] || lead.last_email_at;
                const actDate = parseMsgDate(rawDate);
                if (checkDate(actDate)) {
                    totalLeadsCount++;
                    tableStats[tableKey].totalLeads++;

                    totalEmails++;
                    tableStats[tableKey].emails++;

                    if (actionType.includes('1') || actionType.includes('initial')) {
                        firstEmailCount++;
                    }

                    // Replies
                    const isReply = status.includes('replied') ||
                        status.includes('reply') ||
                        actionType.includes('reply') ||
                        actionType.includes('inbound') ||
                        !!lead.replied_at;
                    if (isReply) {
                        replyCount++;
                        tableStats[tableKey].replies++;
                    }

                    // Unsubscribed
                    const isUnsub = status.includes('unsubscribed') ||
                        actionType.includes('unsubscribed') ||
                        String(lead.unsubscribed || '').toLowerCase().includes('yes');
                    if (isUnsub) {
                        unsubscribedCount++;
                        tableStats[tableKey].unsubscribed++;
                    }

                    // Chart grouping
                    if (actDate && !isNaN(actDate.getTime())) {
                        const dateKey = format(actDate, "MMM dd");
                        if (!dailyMap[dateKey]) {
                            dailyMap[dateKey] = { date: dateKey, sent: 0, replies: 0 };
                        }
                        dailyMap[dateKey].sent++;
                        if (isReply) dailyMap[dateKey].replies++;
                    }
                }
            }
            return;
        }

        // 2. Legacy / Master / Nurture Lead Records
        let leadHasEmail = false;

        // Check Replies
        const emailReply = lead.email_replied;
        if (emailReply && !["no", "none", ""].includes(String(emailReply).toLowerCase().trim())) {
            const parsedDate = parseMsgDate(emailReply) || (lead.updated_at || lead.created_at ? new Date(lead.updated_at || lead.created_at) : null);
            if (checkDate(parsedDate)) {
                leadHasEmail = true;
                replyCount++;
                tableStats[tableKey].replies++;
            }
        }

        // Check Unsubscribed
        if (lead.unsubscribed && String(lead.unsubscribed).toLowerCase().includes("yes")) {
            const unsubDate = lead.updated_at || lead.created_at ? new Date(lead.updated_at || lead.created_at) : null;
            if (checkDate(unsubDate)) {
                leadHasEmail = true;
                unsubscribedCount++;
                tableStats[tableKey].unsubscribed++;
            }
        }

        // Check Stages / Emails Sent
        const stageData = lead.stage_data || {};
        const stages = lead.stages_passed || [];

        stages.forEach((stage: string) => {
            const s = stage.toLowerCase().trim();
            if (!s.startsWith("email_")) return;

            const rawContent = stageData[stage];
            const emailDate = parseMsgDate(rawContent) || (lead.created_at ? new Date(lead.created_at) : null);

            if (checkDate(emailDate)) {
                leadHasEmail = true;
                totalEmails++;
                tableStats[tableKey].emails++;
                if (s === "email_1") firstEmailCount++;

                if (emailDate && !isNaN(emailDate.getTime())) {
                    const dateKey = format(emailDate, "MMM dd");
                    if (!dailyMap[dateKey]) {
                        dailyMap[dateKey] = { date: dateKey, sent: 0, replies: 0 };
                    }
                    dailyMap[dateKey].sent++;
                }
            }
        });

        if (leadHasEmail) {
            totalLeadsCount++;
            tableStats[tableKey].totalLeads++;
        }
    });

    const dailyChartData = Object.values(dailyMap);
    const replyRate = totalEmails > 0 ? ((replyCount / totalEmails) * 100).toFixed(1) : "0.0";
    const unsubRate = totalEmails > 0 ? ((unsubscribedCount / totalEmails) * 100).toFixed(1) : "0.0";

    return {
        totalEmails,
        totalSent: totalEmails,
        firstEmailCount,
        replyCount,
        totalReplies: replyCount,
        unsubscribedCount,
        totalUnsubscribed: unsubscribedCount,
        totalLeadsCount,
        totalLeads: totalLeadsCount,
        replyRate,
        unsubRate,
        tableStats,
        dailyChartData,
    };
}
