-- =============================================================================
-- get_master_metrics — add voice counts + fix WA replies source
--
-- Changes from 005:
--   1. totalVoiceCalls  = vapi_call_logs WHERE source='vapi' AND vapi_account != 'owners'
--      filtered by started_at BETWEEN p_from AND p_to
--   2. ownerVoiceCalls  = vapi_call_logs WHERE vapi_account = 'owners'
--      filtered by started_at BETWEEN p_from AND p_to
--   3. totalWaReplies   = count of leads with non-null/empty "W.P_Replied 1"
--      across nr_wf, followup, nurture — using whatsapp_last_contacted OR
--      parse_wp_date("W.P_1") for the date filter (same as get_wa_leads_list)
--
-- Run in Supabase SQL Editor — safe to re-run (CREATE OR REPLACE)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_master_metrics(
    p_from timestamptz,
    p_to   timestamptz
)
RETURNS json
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_result json;
BEGIN
    WITH

    -- ── Total Leads (master_leads, filtered by "Created At") ─────────────────
    leads_in_range AS (
        SELECT "Created At"
        FROM master_leads
        WHERE "Created At" >= p_from AND "Created At" <= p_to
    ),
    leads_summary AS (
        SELECT COUNT(*) AS total_leads, MIN("Created At") AS oldest_date
        FROM leads_in_range
    ),
    leads_daily AS (
        SELECT ("Created At" AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS leads
        FROM leads_in_range
        GROUP BY day
        ORDER BY day
    ),

    -- ── WA Reachouts — all three lead tables via parse_wp_date("W.P_1") ──────
    nw_reach AS (
        SELECT 1
        FROM nr_wf
        WHERE "W.P_1" IS NOT NULL AND "W.P_1" <> ''
          AND (
              (whatsapp_last_contacted BETWEEN p_from AND p_to)
              OR (whatsapp_last_contacted IS NULL AND parse_wp_date("W.P_1") BETWEEN p_from AND p_to)
          )
    ),
    fu_reach AS (
        SELECT 1
        FROM followup
        WHERE "W.P_1" IS NOT NULL AND "W.P_1" <> ''
          AND (
              (whatsapp_last_contacted BETWEEN p_from AND p_to)
              OR (whatsapp_last_contacted IS NULL AND parse_wp_date("W.P_1") BETWEEN p_from AND p_to)
          )
    ),
    nu_reach AS (
        SELECT 1
        FROM nurture
        WHERE "W.P_1" IS NOT NULL AND "W.P_1" <> ''
          AND (
              (whatsapp_last_contacted BETWEEN p_from AND p_to)
              OR (whatsapp_last_contacted IS NULL AND parse_wp_date("W.P_1") BETWEEN p_from AND p_to)
          )
    ),

    -- ── WA Replies — count leads with "W.P_Replied 1" populated in range ─────
    -- Same date filter as reachouts so numerator/denominator are consistent
    nw_rep AS (
        SELECT 1
        FROM nr_wf
        WHERE "W.P_1" IS NOT NULL AND "W.P_1" <> ''
          AND (
              (whatsapp_last_contacted BETWEEN p_from AND p_to)
              OR (whatsapp_last_contacted IS NULL AND parse_wp_date("W.P_1") BETWEEN p_from AND p_to)
          )
          AND "W.P_Replied 1" IS NOT NULL AND "W.P_Replied 1" <> ''
    ),
    fu_rep AS (
        SELECT 1
        FROM followup
        WHERE "W.P_1" IS NOT NULL AND "W.P_1" <> ''
          AND (
              (whatsapp_last_contacted BETWEEN p_from AND p_to)
              OR (whatsapp_last_contacted IS NULL AND parse_wp_date("W.P_1") BETWEEN p_from AND p_to)
          )
          AND "W.P_Replied 1" IS NOT NULL AND "W.P_Replied 1" <> ''
    ),
    nu_rep AS (
        SELECT 1
        FROM nurture
        WHERE "W.P_1" IS NOT NULL AND "W.P_1" <> ''
          AND (
              (whatsapp_last_contacted BETWEEN p_from AND p_to)
              OR (whatsapp_last_contacted IS NULL AND parse_wp_date("W.P_1") BETWEEN p_from AND p_to)
          )
          AND "W.P_Replied 1" IS NOT NULL AND "W.P_Replied 1" <> ''
    ),

    -- ── Voice counts + Vapi cost — from vapi_call_logs, filtered by started_at ─
    voice_counts AS (
        SELECT
            COUNT(*) FILTER (WHERE COALESCE(vapi_account, '') != 'owners'
                               AND COALESCE(source, '') != 'elevenlabs') AS normal_calls,
            COUNT(*) FILTER (WHERE vapi_account = 'owners')              AS owner_calls,
            COALESCE(SUM(cost_usd) FILTER (
                WHERE COALESCE(vapi_account, '') != 'owners'
                  AND COALESCE(source, '') != 'elevenlabs'
            ), 0)                                                         AS normal_vapi_cost,
            COALESCE(SUM(cost_usd) FILTER (
                WHERE vapi_account = 'owners'
            ), 0)                                                         AS owner_vapi_cost
        FROM vapi_call_logs
        WHERE started_at >= p_from AND started_at <= p_to
    ),

    -- ── Owner Leads count (by createdOn) ─────────────────────────────────────
    owner_summary AS (
        SELECT COUNT(*) AS total_owner_leads
        FROM owner_data
        WHERE "createdOn" >= p_from AND "createdOn" <= p_to
    ),

    -- ── Owner WA Reachouts — filtered by Whatsapp_1_Date ─────────────────────
    owner_wa_reach AS (
        SELECT COUNT(*) AS owner_wa_reachouts
        FROM owner_data
        WHERE "Whatsapp_1_Date" IS NOT NULL AND "Whatsapp_1_Date" != ''
          AND safe_ts("Whatsapp_1_Date") IS NOT NULL
          AND safe_ts("Whatsapp_1_Date") >= p_from
          AND safe_ts("Whatsapp_1_Date") <= p_to
    ),

    -- ── Owner WA Replies — filtered by Whatsapp_1_Date ───────────────────────
    owner_wa_rep AS (
        SELECT COUNT(*) AS owner_wa_replies
        FROM owner_data
        WHERE "Whatsapp_1_Date" IS NOT NULL AND "Whatsapp_1_Date" != ''
          AND safe_ts("Whatsapp_1_Date") IS NOT NULL
          AND safe_ts("Whatsapp_1_Date") >= p_from
          AND safe_ts("Whatsapp_1_Date") <= p_to
          AND "WTS_Reply_Track" IS NOT NULL
          AND "WTS_Reply_Track" NOT IN ('', 'no', 'No')
    )

    SELECT json_build_object(
        'totalLeads',       ls.total_leads,
        'oldestLeadDate',   ls.oldest_date,
        'totalWaReachouts', (SELECT COUNT(*) FROM nw_reach) +
                            (SELECT COUNT(*) FROM fu_reach) +
                            (SELECT COUNT(*) FROM nu_reach),
        'totalWaReplies',   (SELECT COUNT(*) FROM nw_rep) +
                            (SELECT COUNT(*) FROM fu_rep) +
                            (SELECT COUNT(*) FROM nu_rep),
        'totalVoiceCalls',  vc.normal_calls,
        'ownerVoiceCalls',  vc.owner_calls,
        'normalVapiCost',   vc.normal_vapi_cost,
        'ownerVapiCost',    vc.owner_vapi_cost,
        'leadsDaily',       COALESCE(
                                (SELECT json_agg(json_build_object(
                                    'date',  to_char(day, 'YYYY-MM-DD'),
                                    'leads', leads
                                ) ORDER BY day) FROM leads_daily),
                                '[]'::json),
        'totalOwnerLeads',  os.total_owner_leads,
        'ownerWaReachouts', owr.owner_wa_reachouts,
        'ownerWaReplies',   orep.owner_wa_replies
    )
    INTO v_result
    FROM leads_summary ls, owner_summary os, owner_wa_reach owr, owner_wa_rep orep,
         voice_counts vc;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_master_metrics(timestamptz, timestamptz) TO anon, authenticated, service_role;
