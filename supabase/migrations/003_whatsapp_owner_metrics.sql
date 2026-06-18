-- =============================================================================
-- WHATSAPP + OWNER METRICS — PRODUCTION SQL
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query → Run
-- Safe to re-run: all statements use CREATE OR REPLACE
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

    nw_reach_filtered AS (
        SELECT parse_wp_date("W.P_1") AS reach_dt
        FROM nr_wf
        WHERE "W.P_1" IS NOT NULL AND "W.P_1" NOT IN ('', 'No', 'no')
          AND parse_wp_date("W.P_1") >= p_from AND parse_wp_date("W.P_1") <= p_to
    ),
    fu_reach AS (
        SELECT "Created At" AS reach_dt
        FROM followup
        WHERE "W.P_1" IS NOT NULL AND "W.P_1" NOT IN ('', 'No', 'no')
          AND "Created At" >= p_from AND "Created At" <= p_to
    ),
    nu_reach_filtered AS (
        SELECT parse_wp_date("W.P_1") AS reach_dt
        FROM nurture
        WHERE "W.P_1" IS NOT NULL AND "W.P_1" NOT IN ('', 'No', 'no')
          AND parse_wp_date("W.P_1") >= p_from AND parse_wp_date("W.P_1") <= p_to
    ),
    all_wa_reach AS (
        SELECT reach_dt FROM nw_reach_filtered
        UNION ALL SELECT reach_dt FROM fu_reach
        UNION ALL SELECT reach_dt FROM nu_reach_filtered
    ),

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

    owner_in_range AS (
        SELECT
            "createdOn",
            "Whatsapp_1_Date",
            safe_ts("Whatsapp_1_Date") AS wp_dt,
            "WTS_Reply_Track"
        FROM owner_data
        WHERE "createdOn" >= p_from AND "createdOn" <= p_to
    ),
    owner_summary  AS (SELECT COUNT(*) AS total_owner_leads FROM owner_in_range),
    owner_wa_reach AS (
        SELECT COUNT(*) AS owner_wa_reachouts
        FROM owner_in_range
        WHERE "Whatsapp_1_Date" IS NOT NULL AND "Whatsapp_1_Date" != ''
          AND wp_dt IS NOT NULL
          AND wp_dt >= p_from AND wp_dt <= p_to
    ),
    owner_wa_rep AS (
        SELECT COUNT(*) AS owner_wa_replies
        FROM owner_in_range
        WHERE "WTS_Reply_Track" IS NOT NULL
          AND "WTS_Reply_Track" NOT IN ('', 'no', 'No')
          AND wp_dt >= p_from AND wp_dt <= p_to
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


CREATE OR REPLACE FUNCTION get_whatsapp_metrics(
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

    nw_reach AS (
        SELECT parse_wp_date("W.P_1") AS reach_dt
        FROM nr_wf
        WHERE "W.P_1" IS NOT NULL AND "W.P_1" NOT IN ('', 'No', 'no')
          AND parse_wp_date("W.P_1") >= p_from AND parse_wp_date("W.P_1") <= p_to
    ),
    fu_reach AS (
        SELECT "Created At" AS reach_dt
        FROM followup
        WHERE "W.P_1" IS NOT NULL AND "W.P_1" NOT IN ('', 'No', 'no')
          AND "Created At" >= p_from AND "Created At" <= p_to
    ),
    nu_reach AS (
        SELECT parse_wp_date("W.P_1") AS reach_dt
        FROM nurture
        WHERE "W.P_1" IS NOT NULL AND "W.P_1" NOT IN ('', 'No', 'no')
          AND parse_wp_date("W.P_1") >= p_from AND parse_wp_date("W.P_1") <= p_to
    ),
    all_normal_reach AS (
        SELECT reach_dt FROM nw_reach
        UNION ALL SELECT reach_dt FROM fu_reach
        UNION ALL SELECT reach_dt FROM nu_reach
    ),

    nw_rep AS (
        SELECT (regexp_match("WP_Replied_track", '(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^ \n]*)'))[1]::timestamptz AS reply_dt
        FROM nr_wf
        WHERE "WP_Replied_track" ~ '\d{4}-\d{2}-\d{2}T' AND "WP_Replied_track" NOT IN ('', 'no', 'No')
    ),
    fu_rep AS (
        SELECT (regexp_match("WP_Replied_track", '(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^ \n]*)'))[1]::timestamptz AS reply_dt
        FROM followup
        WHERE "WP_Replied_track" ~ '\d{4}-\d{2}-\d{2}T' AND "WP_Replied_track" NOT IN ('', 'no', 'No')
    ),
    nu_rep AS (
        SELECT (regexp_match("WP_Replied_track", '(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^ \n]*)'))[1]::timestamptz AS reply_dt
        FROM nurture
        WHERE "WP_Replied_track" ~ '\d{4}-\d{2}-\d{2}T' AND "WP_Replied_track" NOT IN ('', 'no', 'No')
    ),
    all_normal_replies AS (
        SELECT reply_dt FROM nw_rep WHERE reply_dt >= p_from AND reply_dt <= p_to
        UNION ALL SELECT reply_dt FROM fu_rep  WHERE reply_dt >= p_from AND reply_dt <= p_to
        UNION ALL SELECT reply_dt FROM nu_rep  WHERE reply_dt >= p_from AND reply_dt <= p_to
    ),

    owner_base AS (
        SELECT
            "Whatsapp_1_Date",
            safe_ts("Whatsapp_1_Date") AS wp_dt,
            "WTS_Reply_Track"
        FROM owner_data
        WHERE "Whatsapp_1" IS NOT NULL AND "Whatsapp_1" NOT IN ('', 'No', 'no')
          AND "Whatsapp_1_Date" IS NOT NULL AND "Whatsapp_1_Date" != ''
    ),
    owner_reach_in_range AS (
        SELECT wp_dt FROM owner_base
        WHERE wp_dt IS NOT NULL AND wp_dt >= p_from AND wp_dt <= p_to
    ),
    owner_replied AS (
        SELECT wp_dt FROM owner_base
        WHERE wp_dt IS NOT NULL AND wp_dt >= p_from AND wp_dt <= p_to
          AND "WTS_Reply_Track" IS NOT NULL
          AND "WTS_Reply_Track" NOT IN ('', 'no', 'No')
    ),

    normal_counts AS (
        SELECT
            COUNT(*)                                    AS total_reachouts,
            (SELECT COUNT(*) FROM all_normal_replies)   AS total_replies
        FROM all_normal_reach
    ),
    owner_counts AS (
        SELECT
            (SELECT COUNT(*) FROM owner_reach_in_range) AS owner_reachouts,
            (SELECT COUNT(*) FROM owner_replied)        AS owner_replies
    ),

    daily_reach AS (
        SELECT (reach_dt AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS reachouts
        FROM all_normal_reach GROUP BY day
    ),
    daily_reply AS (
        SELECT (reply_dt AT TIME ZONE 'UTC')::date AS day, COUNT(*) AS replies
        FROM all_normal_replies GROUP BY day
    ),
    date_spine AS (
        SELECT generate_series(p_from::date, p_to::date, interval '1 day')::date AS day
    ),
    daily_trend AS (
        SELECT ds.day,
               COALESCE(dr.reachouts, 0) AS reachouts,
               COALESCE(dp.replies,   0) AS replies
        FROM date_spine ds
        LEFT JOIN daily_reach dr ON dr.day = ds.day
        LEFT JOIN daily_reply dp ON dp.day = ds.day
        ORDER BY ds.day
    )

    SELECT json_build_object(
        'totalReachouts',  nc.total_reachouts,
        'totalReplies',    nc.total_replies,
        'replyRate',       CASE WHEN nc.total_reachouts > 0
                                THEN ROUND((nc.total_replies::numeric / nc.total_reachouts) * 100, 2)
                                ELSE 0 END,
        'dailyTrend',      COALESCE(
                               (SELECT json_agg(json_build_object(
                                   'date',      to_char(day, 'YYYY-MM-DD'),
                                   'reachouts', reachouts,
                                   'replies',   replies
                               ) ORDER BY day) FROM daily_trend),
                               '[]'::json),
        'ownerReachouts',  oc.owner_reachouts,
        'ownerReplies',    oc.owner_replies
    )
    INTO v_result
    FROM normal_counts nc, owner_counts oc;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_master_metrics(timestamptz, timestamptz)   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_whatsapp_metrics(timestamptz, timestamptz) TO anon, authenticated, service_role;
