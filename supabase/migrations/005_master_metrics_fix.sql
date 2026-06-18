-- =============================================================================
-- get_master_metrics — FIXED
--
-- Changes from 003:
--   1. followup reachouts now filter by parse_wp_date("W.P_1") (consistent with nr_wf/nurture)
--   2. ownerWaReachouts filtered by Whatsapp_1_Date only (not createdOn)
--   3. ownerWaReplies filtered by Whatsapp_1_Date only (not createdOn)
--   4. totalOwnerLeads still uses createdOn for owner lead count
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

    -- ── WA Reachouts (nr_wf + followup + nurture) — all via parse_wp_date ────
    nw_reach AS (
        SELECT parse_wp_date("W.P_1") AS reach_dt
        FROM nr_wf
        WHERE "W.P_1" IS NOT NULL AND "W.P_1" NOT IN ('', 'No', 'no')
          AND parse_wp_date("W.P_1") >= p_from AND parse_wp_date("W.P_1") <= p_to
    ),
    fu_reach AS (
        SELECT parse_wp_date("W.P_1") AS reach_dt
        FROM followup
        WHERE "W.P_1" IS NOT NULL AND "W.P_1" NOT IN ('', 'No', 'no')
          AND parse_wp_date("W.P_1") >= p_from AND parse_wp_date("W.P_1") <= p_to
    ),
    nu_reach AS (
        SELECT parse_wp_date("W.P_1") AS reach_dt
        FROM nurture
        WHERE "W.P_1" IS NOT NULL AND "W.P_1" NOT IN ('', 'No', 'no')
          AND parse_wp_date("W.P_1") >= p_from AND parse_wp_date("W.P_1") <= p_to
    ),
    all_wa_reach AS (
        SELECT reach_dt FROM nw_reach
        UNION ALL SELECT reach_dt FROM fu_reach
        UNION ALL SELECT reach_dt FROM nu_reach
    ),

    -- ── WA Replies (nr_wf + followup + nurture) ───────────────────────────────
    nw_rep AS (
        SELECT (regexp_match("WP_Replied_track", '(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^ \n]*)'))[1]::timestamptz AS reply_dt
        FROM nr_wf
        WHERE "WP_Replied_track" ~ '\d{4}-\d{2}-\d{2}T'
          AND "WP_Replied_track" NOT IN ('', 'no', 'No')
    ),
    fu_rep AS (
        SELECT (regexp_match("WP_Replied_track", '(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^ \n]*)'))[1]::timestamptz AS reply_dt
        FROM followup
        WHERE "WP_Replied_track" ~ '\d{4}-\d{2}-\d{2}T'
          AND "WP_Replied_track" NOT IN ('', 'no', 'No')
    ),
    nu_rep AS (
        SELECT (regexp_match("WP_Replied_track", '(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^ \n]*)'))[1]::timestamptz AS reply_dt
        FROM nurture
        WHERE "WP_Replied_track" ~ '\d{4}-\d{2}-\d{2}T'
          AND "WP_Replied_track" NOT IN ('', 'no', 'No')
    ),
    all_wa_replies AS (
        SELECT reply_dt FROM nw_rep WHERE reply_dt >= p_from AND reply_dt <= p_to
        UNION ALL SELECT reply_dt FROM fu_rep  WHERE reply_dt >= p_from AND reply_dt <= p_to
        UNION ALL SELECT reply_dt FROM nu_rep  WHERE reply_dt >= p_from AND reply_dt <= p_to
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
        'totalWaReachouts', (SELECT COUNT(*) FROM all_wa_reach),
        'totalWaReplies',   (SELECT COUNT(*) FROM all_wa_replies),
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
    FROM leads_summary ls, owner_summary os, owner_wa_reach owr, owner_wa_rep orep;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_master_metrics(timestamptz, timestamptz) TO anon, authenticated, service_role;
