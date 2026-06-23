-- ============================================================
-- FILE: 001_voice_metrics.sql
-- ============================================================

-- =============================================================================
-- VOICE METRICS â€” PRODUCTION SQL
-- Run in Supabase SQL Editor: Dashboard â†’ SQL Editor â†’ New Query â†’ Run
-- Safe to re-run: all statements use CREATE OR REPLACE / IF NOT EXISTS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. INDEXES â€” vapi_call_logs
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_vcl_started_at
    ON vapi_call_logs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_vcl_source
    ON vapi_call_logs (source);

CREATE INDEX IF NOT EXISTS idx_vcl_vapi_account
    ON vapi_call_logs (vapi_account);

CREATE INDEX IF NOT EXISTS idx_vcl_source_started_at
    ON vapi_call_logs (source, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_vcl_vapi_account_source
    ON vapi_call_logs (vapi_account, source);

-- ---------------------------------------------------------------------------
-- 2. FUNCTION: get_voice_metrics
--
--    Single round-trip â€” returns every metric the dashboard needs.
--    All math (counts, sums, averages, rates, chart data) runs in PostgreSQL.
--    Node.js receives ~1KB JSON, never raw rows.
--
--    Pickup Rate  = duration_seconds > 18 (phone was physically answered)
--    Completion   = status IN (assistant-ended-call, customer-ended-call)
--    Normal Positive = leads from master_leads joined on phone number
--                      where call_sentiment IN ('positive', 'hesitant')
--    Owner Positive  = owner_data rows where "call Lead Status" contains
--                      "expression of interest" or "callback" with Voice_1/2
--                      date in range
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_voice_metrics(
    p_from           timestamptz,
    p_to             timestamptz,
    p_include_eleven boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_result json;
BEGIN
    WITH
    calls_in_range AS (
        SELECT
            started_at,
            duration_seconds,
            cost_usd,
            status,
            source,
            vapi_account,
            REPLACE(customer_phone, '+', '') AS customer_phone_clean
        FROM vapi_call_logs
        WHERE started_at >= p_from
          AND started_at <= p_to
          AND (p_include_eleven OR COALESCE(source, '') != 'elevenlabs')
    ),
    summary AS (
        SELECT
            COUNT(*)                                                        AS total_calls,
            COALESCE(SUM(duration_seconds), 0)                             AS total_duration,
            COALESCE(AVG(duration_seconds), 0)                             AS avg_duration,
            COALESCE(SUM(cost_usd), 0)                                     AS total_cost,
            COALESCE(AVG(cost_usd), 0)                                     AS avg_cost,
            COUNT(*) FILTER (WHERE status IN (
                'answered','ended','customer-ended-call',
                'assistant-ended-call','done','completed','success','voicemail'
            ))                                                              AS answered_calls,
            COUNT(*) FILTER (WHERE status IN (
                'assistant-ended-call','customer-ended-call',
                'done','completed','success'
            ))                                                              AS completed_calls,
            COUNT(*) FILTER (WHERE vapi_account = 'owners')                AS owner_calls,
            COUNT(*) FILTER (WHERE vapi_account != 'owners'
                              OR vapi_account IS NULL)                      AS normal_calls,
            -- Pickup = duration > 18s (phone physically answered)
            COUNT(*) FILTER (
                WHERE duration_seconds > 18
                  AND (vapi_account != 'owners' OR vapi_account IS NULL)
            )                                                               AS normal_connected,
            -- Completion = proper conversation ended by either party
            COUNT(*) FILTER (
                WHERE status IN ('assistant-ended-call', 'customer-ended-call')
                  AND (vapi_account != 'owners' OR vapi_account IS NULL)
            )                                                               AS normal_qualified,
            COUNT(*) FILTER (
                WHERE duration_seconds > 18
                  AND vapi_account = 'owners'
            )                                                               AS owner_connected,
            COUNT(*) FILTER (
                WHERE status IN ('assistant-ended-call', 'customer-ended-call')
                  AND vapi_account = 'owners'
            )                                                               AS owner_qualified
        FROM calls_in_range
    ),
    daily AS (
        SELECT
            (started_at AT TIME ZONE 'UTC')::date AS day,
            COUNT(*)                               AS calls,
            COALESCE(SUM(cost_usd), 0)             AS cost
        FROM calls_in_range
        GROUP BY day
        ORDER BY day
    ),
    hourly AS (
        SELECT
            EXTRACT(HOUR FROM started_at AT TIME ZONE 'UTC')::int AS hour,
            COUNT(*)                                               AS calls
        FROM calls_in_range
        GROUP BY hour
        ORDER BY hour
    ),
    dur_buckets AS (
        SELECT
            CASE
                WHEN duration_seconds < 30  THEN '0-30s'
                WHEN duration_seconds < 60  THEN '30s-1m'
                WHEN duration_seconds < 120 THEN '1m-2m'
                WHEN duration_seconds < 300 THEN '2m-5m'
                ELSE                             '5m+'
            END       AS label,
            COUNT(*) AS calls
        FROM calls_in_range
        GROUP BY label
    ),
    alltime AS (
        SELECT
            COUNT(*) FILTER (WHERE vapi_account = 'owners'
                AND (p_include_eleven OR COALESCE(source, '') != 'elevenlabs'))  AS owner_calls,
            COUNT(*) FILTER (WHERE (vapi_account != 'owners' OR vapi_account IS NULL)
                AND (p_include_eleven OR COALESCE(source, '') != 'elevenlabs'))  AS normal_calls
        FROM vapi_call_logs
    ),
    owner_positive AS (
        SELECT COUNT(*) AS positive_count
        FROM owner_data
        WHERE (
            LOWER("call Lead Status") LIKE '%expression of interest%'
            OR LOWER("call Lead Status") LIKE '%callback%'
        )
        AND (
            (
                "Voice_1" IS NOT NULL
                AND "Voice_1" NOT IN ('', 'No', 'no')
                AND "Voice_1"::timestamptz >= p_from
                AND "Voice_1"::timestamptz <= p_to
            )
            OR (
                "Voice_2" IS NOT NULL
                AND "Voice_2" NOT IN ('', 'No', 'no')
                AND "Voice_2"::timestamptz >= p_from
                AND "Voice_2"::timestamptz <= p_to
            )
        )
    ),
    -- Join calls to master_leads on phone number (strip + from vapi_call_logs)
    -- Count distinct leads with positive or hesitant sentiment
    normal_sentiment AS (
        SELECT
            COUNT(DISTINCT ml."Lead ID") FILTER (
                WHERE LOWER(ml.call_sentiment) IN ('positive', 'hesitant')
            ) AS positive_count
        FROM calls_in_range c
        JOIN master_leads ml
          ON ml."Phone" = c.customer_phone_clean
        WHERE (c.vapi_account != 'owners' OR c.vapi_account IS NULL)
    )
    SELECT json_build_object(
        'totalCalls',               s.total_calls,
        'totalDuration',            s.total_duration,
        'avgDuration',              ROUND(s.avg_duration::numeric, 2),
        'totalCost',                ROUND(s.total_cost::numeric, 6),
        'avgCost',                  ROUND(s.avg_cost::numeric, 6),
        'answeredCalls',            s.answered_calls,
        'completedCalls',           s.completed_calls,
        'successRate',              CASE WHEN s.total_calls > 0
                                         THEN ROUND((s.answered_calls::numeric / s.total_calls) * 100, 2)
                                         ELSE 0 END,
        'normalCalls',              s.normal_calls,
        'ownerCalls',               s.owner_calls,
        'normalConnected',          s.normal_connected,
        'normalQualified',          s.normal_qualified,
        'normalPickupRate',         CASE WHEN s.normal_calls > 0
                                         THEN ROUND((s.normal_connected::numeric / s.normal_calls) * 100, 2)
                                         ELSE 0 END,
        'normalCompletionRate',     CASE WHEN s.normal_calls > 0
                                         THEN ROUND((s.normal_qualified::numeric / s.normal_calls) * 100, 2)
                                         ELSE 0 END,
        'normalPositiveCount',      ns.positive_count,
        'normalPositiveRate',       CASE WHEN s.normal_calls > 0
                                         THEN ROUND((ns.positive_count::numeric / s.normal_calls) * 100, 2)
                                         ELSE 0 END,
        'ownerConnected',           s.owner_connected,
        'ownerQualified',           s.owner_qualified,
        'ownerPickupRate',          CASE WHEN s.owner_calls > 0
                                         THEN ROUND((s.owner_connected::numeric / s.owner_calls) * 100, 2)
                                         ELSE 0 END,
        'ownerCompletionRate',      CASE WHEN s.owner_calls > 0
                                         THEN ROUND((s.owner_qualified::numeric / s.owner_calls) * 100, 2)
                                         ELSE 0 END,
        'ownerPositiveCount',       op.positive_count,
        'ownerPositiveRate',        CASE WHEN s.owner_calls > 0
                                         THEN ROUND((op.positive_count::numeric / s.owner_calls) * 100, 2)
                                         ELSE 0 END,
        'allTimeNormalCalls',       at.normal_calls,
        'allTimeOwnerCalls',        at.owner_calls,
        'dailyVolume',              COALESCE(
                                        (SELECT json_agg(json_build_object(
                                            'date',  to_char(day, 'YYYY-MM-DD'),
                                            'calls', calls,
                                            'cost',  ROUND(cost::numeric, 6)
                                        ) ORDER BY day) FROM daily),
                                        '[]'::json),
        'hourlyDistribution',       COALESCE(
                                        (SELECT json_agg(json_build_object(
                                            'hour', hour, 'calls', calls
                                        ) ORDER BY hour) FROM hourly),
                                        '[]'::json),
        'durationBuckets',          COALESCE(
                                        (SELECT json_agg(json_build_object(
                                            'label', label, 'calls', calls
                                        ) ORDER BY CASE label
                                            WHEN '0-30s'  THEN 1 WHEN '30s-1m' THEN 2
                                            WHEN '1m-2m'  THEN 3 WHEN '2m-5m'  THEN 4
                                            WHEN '5m+'    THEN 5 END
                                        ) FROM dur_buckets),
                                        '[]'::json)
    )
    INTO v_result
    FROM summary s, alltime at, owner_positive op, normal_sentiment ns;

    RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Grants
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION get_voice_metrics(timestamptz, timestamptz, boolean)
    TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Verify
--    SELECT get_voice_metrics(now() - interval '7 days', now(), false);
-- ---------------------------------------------------------------------------


-- ============================================================
-- FILE: 002_leads_rpc.sql
-- ============================================================

-- =============================================================================
-- get_leads_for_display â€” returns date-filtered rows from all 4 lead tables
-- Run in Supabase SQL Editor: Dashboard â†’ SQL Editor â†’ New Query â†’ Run
-- Safe to re-run: uses CREATE OR REPLACE
-- =============================================================================

CREATE OR REPLACE FUNCTION get_leads_for_display(
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
    SELECT json_build_object(
        'nr_wf', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT *,
                    "Sender Email" AS "Senders email"
                FROM nr_wf
                WHERE "Created At" >= p_from AND "Created At" <= p_to
            ) r
        ), '[]'::json),

        'followup', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT *,
                    "W.P_1  TS" AS "W.P_1 TS"
                FROM followup
                WHERE "Created At" >= p_from AND "Created At" <= p_to
            ) r
        ), '[]'::json),

        'nurture', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT *
                FROM nurture
                WHERE "Created At" >= p_from AND "Created At" <= p_to
            ) r
        ), '[]'::json),

        'master_leads', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT "Lead ID", "Name", "Phone", "Email", "Created At", "Updated At"
                FROM master_leads
                WHERE "Created At" >= p_from AND "Created At" <= p_to
            ) r
        ), '[]'::json)
    )
    INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_leads_for_display(timestamptz, timestamptz) TO anon, authenticated, service_role;


-- ============================================================
-- FILE: 003_whatsapp_owner_metrics.sql
-- ============================================================

-- =============================================================================
-- WHATSAPP + OWNER METRICS â€” PRODUCTION SQL
-- Run in Supabase SQL Editor: Dashboard â†’ SQL Editor â†’ New Query â†’ Run
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


-- ============================================================
-- FILE: 004_wa_leads_list.sql
-- ============================================================

-- =============================================================================
-- WA LEADS LIST â€” date-filters by actual WhatsApp send timestamps
--
-- Run in Supabase SQL Editor â€” safe to re-run (CREATE OR REPLACE / IF NOT EXISTS)
-- =============================================================================

-- â”€â”€ Indexes (already exist in prod, IF NOT EXISTS is safe) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- nr_wf."W.P_1 TS" (single space) â€” already created by prod DDL
CREATE INDEX IF NOT EXISTS idx_nr_wf_wp1_ts
    ON nr_wf ("W.P_1 TS")
    WHERE "W.P_1 TS" IS NOT NULL AND "W.P_1 TS" <> '';

-- followup."W.P_1  TS" (double space) â€” already created by prod DDL
CREATE INDEX IF NOT EXISTS idx_followup_wp1_ts
    ON followup ("W.P_1  TS")
    WHERE "W.P_1  TS" IS NOT NULL AND "W.P_1  TS" <> '';

-- owner_data."Whatsapp_1_Date" â€” already created by prod DDL
CREATE INDEX IF NOT EXISTS idx_owner_data_whatsapp1_date
    ON owner_data ("Whatsapp_1_Date")
    WHERE "Whatsapp_1_Date" IS NOT NULL AND "Whatsapp_1_Date" <> '';

-- â”€â”€ Helper: parse "Delivered - DD/MM/YYYY" or "Read - DD/MM/YYYY HH:MM:SS" â”€â”€

CREATE OR REPLACE FUNCTION parse_wp_ts(v text)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    date_part text;
    d         date;
    t         time;
BEGIN
    IF v IS NULL OR v = '' THEN RETURN NULL; END IF;

    -- Strip leading "Status - " prefix
    IF position(' - ' IN v) > 0 THEN
        date_part := trim(split_part(v, ' - ', 2));
    ELSE
        date_part := trim(v);
    END IF;

    -- Parse DD/MM/YYYY
    BEGIN
        d := to_date(substring(date_part FROM '^\d{1,2}/\d{1,2}/\d{4}'), 'DD/MM/YYYY');
    EXCEPTION WHEN OTHERS THEN
        RETURN NULL;
    END;

    -- Parse optional time (HH:MM or HH:MM:SS, with optional AM/PM)
    BEGIN
        t := (regexp_match(date_part, '(\d{1,2}:\d{2}(?::\d{2})?)', 'i'))[1]::time;
    EXCEPTION WHEN OTHERS THEN
        t := '00:00:00'::time;
    END;

    RETURN (d + t) AT TIME ZONE 'Asia/Dubai';
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- â”€â”€ RPC: get_wa_leads_list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION get_wa_leads_list(
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
    SELECT json_build_object(

        -- â”€â”€ nr_wf: filter by date embedded in W.P_1 message text â”€â”€â”€â”€â”€â”€â”€â”€â”€
        -- Format: "...message...\n\nDD Mon YYYY, HH:MM AM/PM"
        -- parse_wp_date() already handles this format (defined in Supabase DB)
        'nr_wf', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT
                    "Lead ID",
                    "Name",
                    "Phone",
                    "Email",
                    "Created At",
                    "Updated At",
                    "Sender Email"       AS "Senders email",
                    "W.P_1",
                    "W.P_2",
                    "W.P_3",
                    "W.P_4",
                    "W.P_1 TS",
                    "W.P_2 TS",
                    "W.P_3 TS",
                    "W.P_4 TS",
                    "WP_Replied_track",
                    "W.P_FollowUp 1"     AS "W.P_FollowUp",
                    "W.P_FollowUp_TS1"   AS "W.P_FollowUp TS",
                    parse_wp_date("W.P_1") AS wp1_parsed_date
                FROM nr_wf
                WHERE "W.P_1" IS NOT NULL
                  AND "W.P_1" <> ''
                  AND parse_wp_date("W.P_1") BETWEEN p_from AND p_to
                ORDER BY parse_wp_date("W.P_1") DESC
            ) r
        ), '[]'::json),

        -- â”€â”€ followup: filter by date embedded in W.P_1 message text â”€â”€â”€â”€â”€â”€
        'followup', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT
                    "Lead ID",
                    "Name",
                    "Phone",
                    "Email",
                    "Created At",
                    "Updated At",
                    "Senders email",
                    "W.P_1",
                    "W.P_2",
                    "W.P_3",
                    "W.P_4",
                    "W.P_1  TS"          AS "W.P_1 TS",
                    "W.P_2 TS",
                    "W.P_3 TS",
                    "W.P_4 TS",
                    "WP_Replied_track",
                    "W.P_FollowUp 1"     AS "W.P_FollowUp",
                    "W.P_FollowUp_TS1"   AS "W.P_FollowUp TS",
                    parse_wp_date("W.P_1") AS wp1_parsed_date
                FROM followup
                WHERE "W.P_1" IS NOT NULL
                  AND "W.P_1" <> ''
                  AND parse_wp_date("W.P_1") BETWEEN p_from AND p_to
                ORDER BY parse_wp_date("W.P_1") DESC
            ) r
        ), '[]'::json),

        -- â”€â”€ nurture: filter by date embedded in W.P_1 message text â”€â”€â”€â”€â”€â”€â”€
        'nurture', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT
                    "Lead ID",
                    "Name",
                    "Phone",
                    "Email",
                    "Created At",
                    "Updated At",
                    "Senders email",
                    "W.P_1",  "W.P_2",  "W.P_3",  "W.P_4",
                    "W.P_5",  "W.P_6",  "W.P_7",  "W.P_8",
                    "W.P_9",  "W.P_10", "W.P_11", "W.P_12",
                    "W.P_1 TS",  "W.P_2 TS",  "W.P_3 TS",  "W.P_4 TS",
                    "W.P_5 TS",  "W.P_6 TS",  "W.P_7 TS",  "W.P_8 TS",
                    "W.P_9 TS",  "W.P_10 TS", "W.P_11 TS", "W.P_12 TS",
                    "WP_Replied_track",
                    "W.P_FollowUp 1"   AS "W.P_FollowUp",
                    "W.P_FollowUp_TS1" AS "W.P_FollowUp TS",
                    parse_wp_date("W.P_1") AS wp1_parsed_date
                FROM nurture
                WHERE "W.P_1" IS NOT NULL
                  AND "W.P_1" <> ''
                  AND parse_wp_date("W.P_1") BETWEEN p_from AND p_to
                ORDER BY parse_wp_date("W.P_1") DESC
            ) r
        ), '[]'::json),

        -- â”€â”€ owners: filter by "Whatsapp_1_Date" â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        -- owner_data only has Bot_Replied_Status_1..5 (not 6..10)
        'owners', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT
                    id,
                    "createdOn",
                    name,
                    "contactNo",
                    "Whatsapp_1",
                    "Whatsapp_1_Date",
                    "Whatsapp_1_status",
                    "WTS_Reply_Track",
                    retry_1,
                    "User_Replied_1",   "User_Replied_2",   "User_Replied_3",
                    "User_Replied_4",   "User_Replied_5",   "User_Replied_6",
                    "User_Replied_7",   "User_Replied_8",   "User_Replied_9",
                    "User_Replied_10",
                    "Bot_Replied_1",    "Bot_Replied_2",    "Bot_Replied_3",
                    "Bot_Replied_4",    "Bot_Replied_5",    "Bot_Replied_6",
                    "Bot_Replied_7",    "Bot_Replied_8",    "Bot_Replied_9",
                    "Bot_Replied_10",
                    "Bot_Replied_Status_1", "Bot_Replied_Status_2",
                    "Bot_Replied_Status_3", "Bot_Replied_Status_4",
                    "Bot_Replied_Status_5",
                    safe_ts("Whatsapp_1_Date") AS whatsapp_1_parsed_date
                FROM owner_data
                WHERE "Whatsapp_1_Date" IS NOT NULL
                  AND "Whatsapp_1_Date" <> ''
                  AND safe_ts("Whatsapp_1_Date") BETWEEN p_from AND p_to
                ORDER BY safe_ts("Whatsapp_1_Date") DESC
            ) r
        ), '[]'::json)

    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION parse_wp_ts(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_wa_leads_list(timestamptz, timestamptz) TO anon, authenticated, service_role;


-- ============================================================
-- FILE: 005_master_metrics_fix.sql
-- ============================================================

-- =============================================================================
-- get_master_metrics â€” FIXED
--
-- Changes from 003:
--   1. followup reachouts now filter by parse_wp_date("W.P_1") (consistent with nr_wf/nurture)
--   2. ownerWaReachouts filtered by Whatsapp_1_Date only (not createdOn)
--   3. ownerWaReplies filtered by Whatsapp_1_Date only (not createdOn)
--   4. totalOwnerLeads still uses createdOn for owner lead count
--
-- Run in Supabase SQL Editor â€” safe to re-run (CREATE OR REPLACE)
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

    -- â”€â”€ Total Leads (master_leads, filtered by "Created At") â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    -- â”€â”€ WA Reachouts (nr_wf + followup + nurture) â€” all via parse_wp_date â”€â”€â”€â”€
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

    -- â”€â”€ WA Replies (nr_wf + followup + nurture) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    -- â”€â”€ Owner Leads count (by createdOn) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    owner_summary AS (
        SELECT COUNT(*) AS total_owner_leads
        FROM owner_data
        WHERE "createdOn" >= p_from AND "createdOn" <= p_to
    ),

    -- â”€â”€ Owner WA Reachouts â€” filtered by Whatsapp_1_Date â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    owner_wa_reach AS (
        SELECT COUNT(*) AS owner_wa_reachouts
        FROM owner_data
        WHERE "Whatsapp_1_Date" IS NOT NULL AND "Whatsapp_1_Date" != ''
          AND safe_ts("Whatsapp_1_Date") IS NOT NULL
          AND safe_ts("Whatsapp_1_Date") >= p_from
          AND safe_ts("Whatsapp_1_Date") <= p_to
    ),

    -- â”€â”€ Owner WA Replies â€” filtered by Whatsapp_1_Date â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


-- ============================================================
-- FILE: 006_wa_leads_any_msg_date.sql
-- ============================================================

-- =============================================================================
-- get_wa_leads_list â€” FIXED: filter by ANY WP message date in range
--
-- Problem: 004 only filtered by parse_wp_date("W.P_1"), so leads whose first
-- message was sent before the range start were excluded even if W.P_2/W.P_3/W.P_4
-- fell within the range. This caused "less data" in the chat page.
--
-- Fix: include the lead if ANY of W.P_1..W.P_4 (and W.P_FollowUp 1 for nr_wf/followup)
-- has a parsed date within [p_from, p_to]. Also add latest_wp_date computed column
-- (the most recent message date in range) for display/sorting.
--
-- Run in Supabase SQL Editor â€” safe to re-run (CREATE OR REPLACE)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_wa_leads_list(
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
    SELECT json_build_object(

        -- â”€â”€ nr_wf â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        -- Include if ANY of W.P_1..W.P_4 or W.P_FollowUp 1 has a date in range.
        -- latest_wp_date = most recent message date within the range (for display).
        'nr_wf', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT
                    "Lead ID",
                    "Name",
                    "Phone",
                    "Email",
                    "Created At",
                    "Updated At",
                    "Sender Email"       AS "Senders email",
                    "W.P_1",
                    "W.P_2",
                    "W.P_3",
                    "W.P_4",
                    "W.P_1 TS",
                    "W.P_2 TS",
                    "W.P_3 TS",
                    "W.P_4 TS",
                    "WP_Replied_track",
                    "W.P_FollowUp 1"     AS "W.P_FollowUp",
                    "W.P_FollowUp_TS1"   AS "W.P_FollowUp TS",
                    -- wp1_parsed_date kept for backwards-compat; latest_wp_date is preferred
                    parse_wp_date("W.P_1") AS wp1_parsed_date,
                    GREATEST(
                        CASE WHEN parse_wp_date("W.P_1") BETWEEN p_from AND p_to THEN parse_wp_date("W.P_1") END,
                        CASE WHEN parse_wp_date("W.P_2") BETWEEN p_from AND p_to THEN parse_wp_date("W.P_2") END,
                        CASE WHEN parse_wp_date("W.P_3") BETWEEN p_from AND p_to THEN parse_wp_date("W.P_3") END,
                        CASE WHEN parse_wp_date("W.P_4") BETWEEN p_from AND p_to THEN parse_wp_date("W.P_4") END,
                        CASE WHEN parse_wp_date("W.P_FollowUp 1") BETWEEN p_from AND p_to THEN parse_wp_date("W.P_FollowUp 1") END
                    ) AS latest_wp_date
                FROM nr_wf
                WHERE (
                    (parse_wp_date("W.P_1") BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_2") BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_3") BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_4") BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_FollowUp 1") BETWEEN p_from AND p_to)
                )
                ORDER BY GREATEST(
                    parse_wp_date("W.P_1"),
                    parse_wp_date("W.P_2"),
                    parse_wp_date("W.P_3"),
                    parse_wp_date("W.P_4"),
                    parse_wp_date("W.P_FollowUp 1")
                ) DESC NULLS LAST
            ) r
        ), '[]'::json),

        -- â”€â”€ followup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'followup', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT
                    "Lead ID",
                    "Name",
                    "Phone",
                    "Email",
                    "Created At",
                    "Updated At",
                    "Senders email",
                    "W.P_1",
                    "W.P_2",
                    "W.P_3",
                    "W.P_4",
                    "W.P_1  TS"          AS "W.P_1 TS",
                    "W.P_2 TS",
                    "W.P_3 TS",
                    "W.P_4 TS",
                    "WP_Replied_track",
                    "W.P_FollowUp 1"     AS "W.P_FollowUp",
                    "W.P_FollowUp_TS1"   AS "W.P_FollowUp TS",
                    parse_wp_date("W.P_1") AS wp1_parsed_date,
                    GREATEST(
                        CASE WHEN parse_wp_date("W.P_1") BETWEEN p_from AND p_to THEN parse_wp_date("W.P_1") END,
                        CASE WHEN parse_wp_date("W.P_2") BETWEEN p_from AND p_to THEN parse_wp_date("W.P_2") END,
                        CASE WHEN parse_wp_date("W.P_3") BETWEEN p_from AND p_to THEN parse_wp_date("W.P_3") END,
                        CASE WHEN parse_wp_date("W.P_4") BETWEEN p_from AND p_to THEN parse_wp_date("W.P_4") END,
                        CASE WHEN parse_wp_date("W.P_FollowUp 1") BETWEEN p_from AND p_to THEN parse_wp_date("W.P_FollowUp 1") END
                    ) AS latest_wp_date
                FROM followup
                WHERE (
                    (parse_wp_date("W.P_1") BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_2") BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_3") BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_4") BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_FollowUp 1") BETWEEN p_from AND p_to)
                )
                ORDER BY GREATEST(
                    parse_wp_date("W.P_1"),
                    parse_wp_date("W.P_2"),
                    parse_wp_date("W.P_3"),
                    parse_wp_date("W.P_4"),
                    parse_wp_date("W.P_FollowUp 1")
                ) DESC NULLS LAST
            ) r
        ), '[]'::json),

        -- â”€â”€ nurture â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        -- nurture has W.P_1..W.P_12; check all 12 for a date in range
        'nurture', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT
                    "Lead ID",
                    "Name",
                    "Phone",
                    "Email",
                    "Created At",
                    "Updated At",
                    "Senders email",
                    "W.P_1",  "W.P_2",  "W.P_3",  "W.P_4",
                    "W.P_5",  "W.P_6",  "W.P_7",  "W.P_8",
                    "W.P_9",  "W.P_10", "W.P_11", "W.P_12",
                    "W.P_1 TS",  "W.P_2 TS",  "W.P_3 TS",  "W.P_4 TS",
                    "W.P_5 TS",  "W.P_6 TS",  "W.P_7 TS",  "W.P_8 TS",
                    "W.P_9 TS",  "W.P_10 TS", "W.P_11 TS", "W.P_12 TS",
                    "WP_Replied_track",
                    "W.P_FollowUp 1"   AS "W.P_FollowUp",
                    "W.P_FollowUp_TS1" AS "W.P_FollowUp TS",
                    parse_wp_date("W.P_1") AS wp1_parsed_date,
                    GREATEST(
                        CASE WHEN parse_wp_date("W.P_1")  BETWEEN p_from AND p_to THEN parse_wp_date("W.P_1")  END,
                        CASE WHEN parse_wp_date("W.P_2")  BETWEEN p_from AND p_to THEN parse_wp_date("W.P_2")  END,
                        CASE WHEN parse_wp_date("W.P_3")  BETWEEN p_from AND p_to THEN parse_wp_date("W.P_3")  END,
                        CASE WHEN parse_wp_date("W.P_4")  BETWEEN p_from AND p_to THEN parse_wp_date("W.P_4")  END,
                        CASE WHEN parse_wp_date("W.P_5")  BETWEEN p_from AND p_to THEN parse_wp_date("W.P_5")  END,
                        CASE WHEN parse_wp_date("W.P_6")  BETWEEN p_from AND p_to THEN parse_wp_date("W.P_6")  END,
                        CASE WHEN parse_wp_date("W.P_7")  BETWEEN p_from AND p_to THEN parse_wp_date("W.P_7")  END,
                        CASE WHEN parse_wp_date("W.P_8")  BETWEEN p_from AND p_to THEN parse_wp_date("W.P_8")  END,
                        CASE WHEN parse_wp_date("W.P_9")  BETWEEN p_from AND p_to THEN parse_wp_date("W.P_9")  END,
                        CASE WHEN parse_wp_date("W.P_10") BETWEEN p_from AND p_to THEN parse_wp_date("W.P_10") END,
                        CASE WHEN parse_wp_date("W.P_11") BETWEEN p_from AND p_to THEN parse_wp_date("W.P_11") END,
                        CASE WHEN parse_wp_date("W.P_12") BETWEEN p_from AND p_to THEN parse_wp_date("W.P_12") END,
                        CASE WHEN parse_wp_date("W.P_FollowUp 1") BETWEEN p_from AND p_to THEN parse_wp_date("W.P_FollowUp 1") END
                    ) AS latest_wp_date
                FROM nurture
                WHERE (
                    (parse_wp_date("W.P_1")  BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_2")  BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_3")  BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_4")  BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_5")  BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_6")  BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_7")  BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_8")  BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_9")  BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_10") BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_11") BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_12") BETWEEN p_from AND p_to) OR
                    (parse_wp_date("W.P_FollowUp 1") BETWEEN p_from AND p_to)
                )
                ORDER BY GREATEST(
                    parse_wp_date("W.P_1"),  parse_wp_date("W.P_2"),
                    parse_wp_date("W.P_3"),  parse_wp_date("W.P_4"),
                    parse_wp_date("W.P_5"),  parse_wp_date("W.P_6"),
                    parse_wp_date("W.P_7"),  parse_wp_date("W.P_8"),
                    parse_wp_date("W.P_9"),  parse_wp_date("W.P_10"),
                    parse_wp_date("W.P_11"), parse_wp_date("W.P_12"),
                    parse_wp_date("W.P_FollowUp 1")
                ) DESC NULLS LAST
            ) r
        ), '[]'::json),

        -- â”€â”€ owners: unchanged â€” filter by Whatsapp_1_Date â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'owners', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT
                    id,
                    "createdOn",
                    name,
                    "contactNo",
                    "Whatsapp_1",
                    "Whatsapp_1_Date",
                    "Whatsapp_1_status",
                    "WTS_Reply_Track",
                    retry_1,
                    "User_Replied_1",   "User_Replied_2",   "User_Replied_3",
                    "User_Replied_4",   "User_Replied_5",   "User_Replied_6",
                    "User_Replied_7",   "User_Replied_8",   "User_Replied_9",
                    "User_Replied_10",
                    "Bot_Replied_1",    "Bot_Replied_2",    "Bot_Replied_3",
                    "Bot_Replied_4",    "Bot_Replied_5",    "Bot_Replied_6",
                    "Bot_Replied_7",    "Bot_Replied_8",    "Bot_Replied_9",
                    "Bot_Replied_10",
                    "Bot_Replied_Status_1", "Bot_Replied_Status_2",
                    "Bot_Replied_Status_3", "Bot_Replied_Status_4",
                    "Bot_Replied_Status_5",
                    safe_ts("Whatsapp_1_Date") AS whatsapp_1_parsed_date
                FROM owner_data
                WHERE "Whatsapp_1_Date" IS NOT NULL
                  AND "Whatsapp_1_Date" <> ''
                  AND safe_ts("Whatsapp_1_Date") BETWEEN p_from AND p_to
                ORDER BY safe_ts("Whatsapp_1_Date") DESC
            ) r
        ), '[]'::json)

    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_wa_leads_list(timestamptz, timestamptz) TO anon, authenticated, service_role;


-- ============================================================
-- FILE: 007_wa_leads_full_schema.sql
-- ============================================================

-- =============================================================================
-- get_wa_leads_list â€” FINAL: use whatsapp_last_contacted for filtering,
-- return ALL reply/followup columns with underscore aliases for the chat detail
--
-- Key changes from 006:
--   1. Filter by whatsapp_last_contacted BETWEEN p_from AND p_to (proper timestamptz)
--   2. Return "W.P_Replied N" AS "W.P_Replied_N" (spaceâ†’underscore alias)
--   3. Return "W.P_FollowUp N" AS "W.P_FollowUp_N" (spaceâ†’underscore alias)
--   4. Return "W.P_FollowUp_TSN" columns for delivery status
--   5. latest_wp_date = whatsapp_last_contacted (already the correct value)
--   6. Retry columns included
--
-- Run in Supabase SQL Editor â€” safe to re-run (CREATE OR REPLACE)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_wa_leads_list(
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
    SELECT json_build_object(

        -- â”€â”€ nr_wf â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'nr_wf', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT
                    "Lead ID",
                    "Name",
                    "Phone",
                    "Email",
                    "Created At",
                    "Updated At",
                    "Sender Email"            AS "Senders email",
                    -- Bot outbound messages
                    "W.P_1", "W.P_2", "W.P_3", "W.P_4",
                    -- Delivery status TS
                    "W.P_1 TS", "W.P_2 TS", "W.P_3 TS", "W.P_4 TS",
                    -- Retry columns
                    "W.P_1 Retry", "W.P_2 Retry", "W.P_3 Retry", "W.P_4 Retry",
                    -- Reply track
                    "WP_Replied_track",
                    -- FollowUp messages (aliased spaceâ†’underscore for JS access)
                    "W.P_FollowUp 1"  AS "W.P_FollowUp_1",
                    "W.P_FollowUp 2"  AS "W.P_FollowUp_2",
                    "W.P_FollowUp 3"  AS "W.P_FollowUp_3",
                    "W.P_FollowUp 4"  AS "W.P_FollowUp_4",
                    "W.P_FollowUp 5"  AS "W.P_FollowUp_5",
                    "W.P_FollowUp 6"  AS "W.P_FollowUp_6",
                    "W.P_FollowUp 7"  AS "W.P_FollowUp_7",
                    "W.P_FollowUp 8"  AS "W.P_FollowUp_8",
                    "W.P_FollowUp 9"  AS "W.P_FollowUp_9",
                    "W.P_FollowUp 10" AS "W.P_FollowUp_10",
                    -- User replies (aliased spaceâ†’underscore)
                    "W.P_Replied 1"   AS "W.P_Replied_1",
                    "W.P_Replied 2"   AS "W.P_Replied_2",
                    "W.P_Replied 3"   AS "W.P_Replied_3",
                    "W.P_Replied 4"   AS "W.P_Replied_4",
                    "W.P_Replied 5"   AS "W.P_Replied_5",
                    "W.P_Replied 6"   AS "W.P_Replied_6",
                    "W.P_Replied 7"   AS "W.P_Replied_7",
                    "W.P_Replied 8"   AS "W.P_Replied_8",
                    "W.P_Replied 9"   AS "W.P_Replied_9",
                    "W.P_Replied 10"  AS "W.P_Replied_10",
                    -- FollowUp delivery TS
                    "W.P_FollowUp_TS1",  "W.P_FollowUp_TS2",  "W.P_FollowUp_TS3",
                    "W.P_FollowUp_TS4",  "W.P_FollowUp_TS5",  "W.P_FollowUp_TS6",
                    "W.P_FollowUp_TS7",  "W.P_FollowUp_TS8",  "W.P_FollowUp_TS9",
                    "W.P_FollowUp_TS10",
                    -- Also keep "W.P_FollowUp" alias (first followup) for backwards compat
                    "W.P_FollowUp 1"     AS "W.P_FollowUp",
                    "W.P_FollowUp_TS1"   AS "W.P_FollowUp TS",
                    -- Date fields
                    whatsapp_last_contacted,
                    whatsapp_last_contacted AS latest_wp_date,
                    parse_wp_date("W.P_1") AS wp1_parsed_date
                FROM nr_wf
                WHERE whatsapp_last_contacted IS NOT NULL
                  AND whatsapp_last_contacted BETWEEN p_from AND p_to
                ORDER BY whatsapp_last_contacted DESC
            ) r
        ), '[]'::json),

        -- â”€â”€ followup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'followup', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT
                    "Lead ID",
                    "Name",
                    "Phone",
                    "Email",
                    "Created At",
                    "Updated At",
                    "Senders email",
                    -- Bot outbound messages
                    "W.P_1", "W.P_2", "W.P_3", "W.P_4",
                    -- Delivery status TS (followup uses double-space "W.P_1  TS")
                    "W.P_1  TS"  AS "W.P_1 TS",
                    "W.P_2 TS", "W.P_3 TS", "W.P_4 TS",
                    -- Retry columns
                    "W.P_1 Retry", "W.P_2 Retry", "W.P_3 Retry", "W.P_4 Retry",
                    -- Reply track
                    "WP_Replied_track",
                    -- FollowUp messages (spaceâ†’underscore)
                    "W.P_FollowUp 1"  AS "W.P_FollowUp_1",
                    "W.P_FollowUp 2"  AS "W.P_FollowUp_2",
                    "W.P_FollowUp 3"  AS "W.P_FollowUp_3",
                    "W.P_FollowUp 4"  AS "W.P_FollowUp_4",
                    "W.P_FollowUp 5"  AS "W.P_FollowUp_5",
                    "W.P_FollowUp 6"  AS "W.P_FollowUp_6",
                    "W.P_FollowUp 7"  AS "W.P_FollowUp_7",
                    "W.P_FollowUp 8"  AS "W.P_FollowUp_8",
                    "W.P_FollowUp 9"  AS "W.P_FollowUp_9",
                    "W.P_FollowUp 10" AS "W.P_FollowUp_10",
                    -- User replies (spaceâ†’underscore)
                    "W.P_Replied 1"   AS "W.P_Replied_1",
                    "W.P_Replied 2"   AS "W.P_Replied_2",
                    "W.P_Replied 3"   AS "W.P_Replied_3",
                    "W.P_Replied 4"   AS "W.P_Replied_4",
                    "W.P_Replied 5"   AS "W.P_Replied_5",
                    "W.P_Replied 6"   AS "W.P_Replied_6",
                    "W.P_Replied 7"   AS "W.P_Replied_7",
                    "W.P_Replied 8"   AS "W.P_Replied_8",
                    "W.P_Replied 9"   AS "W.P_Replied_9",
                    "W.P_Replied 10"  AS "W.P_Replied_10",
                    -- FollowUp delivery TS
                    "W.P_FollowUp_TS1",  "W.P_FollowUp_TS2",  "W.P_FollowUp_TS3",
                    "W.P_FollowUp_TS4",  "W.P_FollowUp_TS5",  "W.P_FollowUp_TS6",
                    "W.P_FollowUp_TS7",  "W.P_FollowUp_TS8",  "W.P_FollowUp_TS9",
                    "W.P_FollowUp_TS10",
                    -- Backwards compat aliases
                    "W.P_FollowUp 1"     AS "W.P_FollowUp",
                    "W.P_FollowUp_TS1"   AS "W.P_FollowUp TS",
                    -- Date fields
                    whatsapp_last_contacted,
                    whatsapp_last_contacted AS latest_wp_date,
                    parse_wp_date("W.P_1") AS wp1_parsed_date
                FROM followup
                WHERE whatsapp_last_contacted IS NOT NULL
                  AND whatsapp_last_contacted BETWEEN p_from AND p_to
                ORDER BY whatsapp_last_contacted DESC
            ) r
        ), '[]'::json),

        -- â”€â”€ nurture â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'nurture', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT
                    "Lead ID",
                    "Name",
                    "Phone",
                    "Email",
                    "Created At",
                    "Updated At",
                    "Senders email",
                    -- Bot outbound messages (nurture has up to 12)
                    "W.P_1",  "W.P_2",  "W.P_3",  "W.P_4",
                    "W.P_5",  "W.P_6",  "W.P_7",  "W.P_8",
                    "W.P_9",  "W.P_10", "W.P_11", "W.P_12",
                    -- Delivery TS
                    "W.P_1 TS",  "W.P_2 TS",  "W.P_3 TS",  "W.P_4 TS",
                    "W.P_5 TS",  "W.P_6 TS",  "W.P_7 TS",  "W.P_8 TS",
                    "W.P_9 TS",  "W.P_10 TS", "W.P_11 TS", "W.P_12 TS",
                    -- Retry columns
                    "W.P_1 Retry",  "W.P_2 Retry",  "W.P_3 Retry",  "W.P_4 Retry",
                    "W.P_5 Retry",  "W.P_6 Retry",  "W.P_7 Retry",  "W.P_8 Retry",
                    "W.P_9 Retry",  "W.P_10 Retry", "W.P_11 Retry", "W.P_12 Retry",
                    -- Reply track
                    "WP_Replied_track",
                    -- FollowUp messages (spaceâ†’underscore)
                    "W.P_FollowUp 1"  AS "W.P_FollowUp_1",
                    "W.P_FollowUp 2"  AS "W.P_FollowUp_2",
                    "W.P_FollowUp 3"  AS "W.P_FollowUp_3",
                    "W.P_FollowUp 4"  AS "W.P_FollowUp_4",
                    "W.P_FollowUp 5"  AS "W.P_FollowUp_5",
                    "W.P_FollowUp 6"  AS "W.P_FollowUp_6",
                    "W.P_FollowUp 7"  AS "W.P_FollowUp_7",
                    "W.P_FollowUp 8"  AS "W.P_FollowUp_8",
                    "W.P_FollowUp 9"  AS "W.P_FollowUp_9",
                    "W.P_FollowUp 10" AS "W.P_FollowUp_10",
                    -- User replies (spaceâ†’underscore)
                    "W.P_Replied 1"   AS "W.P_Replied_1",
                    "W.P_Replied 2"   AS "W.P_Replied_2",
                    "W.P_Replied 3"   AS "W.P_Replied_3",
                    "W.P_Replied 4"   AS "W.P_Replied_4",
                    "W.P_Replied 5"   AS "W.P_Replied_5",
                    "W.P_Replied 6"   AS "W.P_Replied_6",
                    "W.P_Replied 7"   AS "W.P_Replied_7",
                    "W.P_Replied 8"   AS "W.P_Replied_8",
                    "W.P_Replied 9"   AS "W.P_Replied_9",
                    "W.P_Replied 10"  AS "W.P_Replied_10",
                    -- FollowUp delivery TS
                    "W.P_FollowUp_TS1",  "W.P_FollowUp_TS2",  "W.P_FollowUp_TS3",
                    "W.P_FollowUp_TS4",  "W.P_FollowUp_TS5",  "W.P_FollowUp_TS6",
                    "W.P_FollowUp_TS7",  "W.P_FollowUp_TS8",  "W.P_FollowUp_TS9",
                    "W.P_FollowUp_TS10",
                    -- Backwards compat aliases
                    "W.P_FollowUp 1"     AS "W.P_FollowUp",
                    "W.P_FollowUp_TS1"   AS "W.P_FollowUp TS",
                    -- Date fields
                    whatsapp_last_contacted,
                    whatsapp_last_contacted AS latest_wp_date,
                    parse_wp_date("W.P_1") AS wp1_parsed_date
                FROM nurture
                WHERE whatsapp_last_contacted IS NOT NULL
                  AND whatsapp_last_contacted BETWEEN p_from AND p_to
                ORDER BY whatsapp_last_contacted DESC
            ) r
        ), '[]'::json),

        -- â”€â”€ owners: unchanged â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'owners', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT
                    id,
                    "createdOn",
                    name,
                    "contactNo",
                    "Whatsapp_1",
                    "Whatsapp_1_Date",
                    "Whatsapp_1_status",
                    "WTS_Reply_Track",
                    retry_1,
                    "User_Replied_1",   "User_Replied_2",   "User_Replied_3",
                    "User_Replied_4",   "User_Replied_5",   "User_Replied_6",
                    "User_Replied_7",   "User_Replied_8",   "User_Replied_9",
                    "User_Replied_10",
                    "Bot_Replied_1",    "Bot_Replied_2",    "Bot_Replied_3",
                    "Bot_Replied_4",    "Bot_Replied_5",    "Bot_Replied_6",
                    "Bot_Replied_7",    "Bot_Replied_8",    "Bot_Replied_9",
                    "Bot_Replied_10",
                    "Bot_Replied_Status_1", "Bot_Replied_Status_2",
                    "Bot_Replied_Status_3", "Bot_Replied_Status_4",
                    "Bot_Replied_Status_5",
                    safe_ts("Whatsapp_1_Date") AS whatsapp_1_parsed_date
                FROM owner_data
                WHERE "Whatsapp_1_Date" IS NOT NULL
                  AND "Whatsapp_1_Date" <> ''
                  AND safe_ts("Whatsapp_1_Date") BETWEEN p_from AND p_to
                ORDER BY safe_ts("Whatsapp_1_Date") DESC
            ) r
        ), '[]'::json)

    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_wa_leads_list(timestamptz, timestamptz) TO anon, authenticated, service_role;


-- ============================================================
-- FILE: 008_wa_leads_combined_date_filter.sql
-- ============================================================

-- =============================================================================
-- get_wa_leads_list â€” FIXED: combined date filter
--
-- whatsapp_last_contacted was added recently (oldest value ~25 May 2026).
-- Leads before that date have NULL there, so filtering by it alone misses them.
--
-- Strategy:
--   WHERE whatsapp_last_contacted BETWEEN p_from AND p_to          (new leads, 25 May+)
--      OR (whatsapp_last_contacted IS NULL                          (old leads, pre-25 May)
--          AND parse_wp_date("W.P_1") BETWEEN p_from AND p_to)
--   Using OR avoids COALESCE swallowing rows where parse_wp_date returns NULL.
--   latest_wp_date = COALESCE(whatsapp_last_contacted, parse_wp_date("W.P_1"))
--
-- All column aliases from 007 are preserved (spaceâ†’underscore for JS access).
-- Run in Supabase SQL Editor â€” safe to re-run (CREATE OR REPLACE)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_wa_leads_list(
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
    SELECT json_build_object(

        -- â”€â”€ nr_wf â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'nr_wf', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT
                    "Lead ID",
                    "Name",
                    "Phone",
                    "Email",
                    "Created At",
                    "Updated At",
                    "Sender Email"            AS "Senders email",
                    "W.P_1", "W.P_2", "W.P_3", "W.P_4",
                    "W.P_1 TS", "W.P_2 TS", "W.P_3 TS", "W.P_4 TS",
                    "W.P_1 Retry", "W.P_2 Retry", "W.P_3 Retry", "W.P_4 Retry",
                    "WP_Replied_track",
                    "W.P_FollowUp 1"  AS "W.P_FollowUp_1",
                    "W.P_FollowUp 2"  AS "W.P_FollowUp_2",
                    "W.P_FollowUp 3"  AS "W.P_FollowUp_3",
                    "W.P_FollowUp 4"  AS "W.P_FollowUp_4",
                    "W.P_FollowUp 5"  AS "W.P_FollowUp_5",
                    "W.P_FollowUp 6"  AS "W.P_FollowUp_6",
                    "W.P_FollowUp 7"  AS "W.P_FollowUp_7",
                    "W.P_FollowUp 8"  AS "W.P_FollowUp_8",
                    "W.P_FollowUp 9"  AS "W.P_FollowUp_9",
                    "W.P_FollowUp 10" AS "W.P_FollowUp_10",
                    "W.P_Replied 1"   AS "W.P_Replied_1",
                    "W.P_Replied 2"   AS "W.P_Replied_2",
                    "W.P_Replied 3"   AS "W.P_Replied_3",
                    "W.P_Replied 4"   AS "W.P_Replied_4",
                    "W.P_Replied 5"   AS "W.P_Replied_5",
                    "W.P_Replied 6"   AS "W.P_Replied_6",
                    "W.P_Replied 7"   AS "W.P_Replied_7",
                    "W.P_Replied 8"   AS "W.P_Replied_8",
                    "W.P_Replied 9"   AS "W.P_Replied_9",
                    "W.P_Replied 10"  AS "W.P_Replied_10",
                    "W.P_FollowUp_TS1",  "W.P_FollowUp_TS2",  "W.P_FollowUp_TS3",
                    "W.P_FollowUp_TS4",  "W.P_FollowUp_TS5",  "W.P_FollowUp_TS6",
                    "W.P_FollowUp_TS7",  "W.P_FollowUp_TS8",  "W.P_FollowUp_TS9",
                    "W.P_FollowUp_TS10",
                    "W.P_FollowUp 1"     AS "W.P_FollowUp",
                    "W.P_FollowUp_TS1"   AS "W.P_FollowUp TS",
                    whatsapp_last_contacted,
                    COALESCE(whatsapp_last_contacted, parse_wp_date("W.P_1")) AS latest_wp_date,
                    parse_wp_date("W.P_1") AS wp1_parsed_date
                FROM nr_wf
                WHERE (
                    (whatsapp_last_contacted BETWEEN p_from AND p_to)
                    OR (whatsapp_last_contacted IS NULL AND parse_wp_date("W.P_1") BETWEEN p_from AND p_to)
                )
                ORDER BY COALESCE(whatsapp_last_contacted, parse_wp_date("W.P_1")) DESC NULLS LAST
            ) r
        ), '[]'::json),

        -- â”€â”€ followup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'followup', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT
                    "Lead ID",
                    "Name",
                    "Phone",
                    "Email",
                    "Created At",
                    "Updated At",
                    "Senders email",
                    "W.P_1", "W.P_2", "W.P_3", "W.P_4",
                    "W.P_1  TS"  AS "W.P_1 TS",
                    "W.P_2 TS", "W.P_3 TS", "W.P_4 TS",
                    "W.P_1 Retry", "W.P_2 Retry", "W.P_3 Retry", "W.P_4 Retry",
                    "WP_Replied_track",
                    "W.P_FollowUp 1"  AS "W.P_FollowUp_1",
                    "W.P_FollowUp 2"  AS "W.P_FollowUp_2",
                    "W.P_FollowUp 3"  AS "W.P_FollowUp_3",
                    "W.P_FollowUp 4"  AS "W.P_FollowUp_4",
                    "W.P_FollowUp 5"  AS "W.P_FollowUp_5",
                    "W.P_FollowUp 6"  AS "W.P_FollowUp_6",
                    "W.P_FollowUp 7"  AS "W.P_FollowUp_7",
                    "W.P_FollowUp 8"  AS "W.P_FollowUp_8",
                    "W.P_FollowUp 9"  AS "W.P_FollowUp_9",
                    "W.P_FollowUp 10" AS "W.P_FollowUp_10",
                    "W.P_Replied 1"   AS "W.P_Replied_1",
                    "W.P_Replied 2"   AS "W.P_Replied_2",
                    "W.P_Replied 3"   AS "W.P_Replied_3",
                    "W.P_Replied 4"   AS "W.P_Replied_4",
                    "W.P_Replied 5"   AS "W.P_Replied_5",
                    "W.P_Replied 6"   AS "W.P_Replied_6",
                    "W.P_Replied 7"   AS "W.P_Replied_7",
                    "W.P_Replied 8"   AS "W.P_Replied_8",
                    "W.P_Replied 9"   AS "W.P_Replied_9",
                    "W.P_Replied 10"  AS "W.P_Replied_10",
                    "W.P_FollowUp_TS1",  "W.P_FollowUp_TS2",  "W.P_FollowUp_TS3",
                    "W.P_FollowUp_TS4",  "W.P_FollowUp_TS5",  "W.P_FollowUp_TS6",
                    "W.P_FollowUp_TS7",  "W.P_FollowUp_TS8",  "W.P_FollowUp_TS9",
                    "W.P_FollowUp_TS10",
                    "W.P_FollowUp 1"     AS "W.P_FollowUp",
                    "W.P_FollowUp_TS1"   AS "W.P_FollowUp TS",
                    whatsapp_last_contacted,
                    COALESCE(whatsapp_last_contacted, parse_wp_date("W.P_1")) AS latest_wp_date,
                    parse_wp_date("W.P_1") AS wp1_parsed_date
                FROM followup
                WHERE (
                    (whatsapp_last_contacted BETWEEN p_from AND p_to)
                    OR (whatsapp_last_contacted IS NULL AND parse_wp_date("W.P_1") BETWEEN p_from AND p_to)
                )
                ORDER BY COALESCE(whatsapp_last_contacted, parse_wp_date("W.P_1")) DESC NULLS LAST
            ) r
        ), '[]'::json),

        -- â”€â”€ nurture â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'nurture', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT
                    "Lead ID",
                    "Name",
                    "Phone",
                    "Email",
                    "Created At",
                    "Updated At",
                    "Senders email",
                    "W.P_1",  "W.P_2",  "W.P_3",  "W.P_4",
                    "W.P_5",  "W.P_6",  "W.P_7",  "W.P_8",
                    "W.P_9",  "W.P_10", "W.P_11", "W.P_12",
                    "W.P_1 TS",  "W.P_2 TS",  "W.P_3 TS",  "W.P_4 TS",
                    "W.P_5 TS",  "W.P_6 TS",  "W.P_7 TS",  "W.P_8 TS",
                    "W.P_9 TS",  "W.P_10 TS", "W.P_11 TS", "W.P_12 TS",
                    "W.P_1 Retry",  "W.P_2 Retry",  "W.P_3 Retry",  "W.P_4 Retry",
                    "W.P_5 Retry",  "W.P_6 Retry",  "W.P_7 Retry",  "W.P_8 Retry",
                    "W.P_9 Retry",  "W.P_10 Retry", "W.P_11 Retry", "W.P_12 Retry",
                    "WP_Replied_track",
                    "W.P_FollowUp 1"  AS "W.P_FollowUp_1",
                    "W.P_FollowUp 2"  AS "W.P_FollowUp_2",
                    "W.P_FollowUp 3"  AS "W.P_FollowUp_3",
                    "W.P_FollowUp 4"  AS "W.P_FollowUp_4",
                    "W.P_FollowUp 5"  AS "W.P_FollowUp_5",
                    "W.P_FollowUp 6"  AS "W.P_FollowUp_6",
                    "W.P_FollowUp 7"  AS "W.P_FollowUp_7",
                    "W.P_FollowUp 8"  AS "W.P_FollowUp_8",
                    "W.P_FollowUp 9"  AS "W.P_FollowUp_9",
                    "W.P_FollowUp 10" AS "W.P_FollowUp_10",
                    "W.P_Replied 1"   AS "W.P_Replied_1",
                    "W.P_Replied 2"   AS "W.P_Replied_2",
                    "W.P_Replied 3"   AS "W.P_Replied_3",
                    "W.P_Replied 4"   AS "W.P_Replied_4",
                    "W.P_Replied 5"   AS "W.P_Replied_5",
                    "W.P_Replied 6"   AS "W.P_Replied_6",
                    "W.P_Replied 7"   AS "W.P_Replied_7",
                    "W.P_Replied 8"   AS "W.P_Replied_8",
                    "W.P_Replied 9"   AS "W.P_Replied_9",
                    "W.P_Replied 10"  AS "W.P_Replied_10",
                    "W.P_FollowUp_TS1",  "W.P_FollowUp_TS2",  "W.P_FollowUp_TS3",
                    "W.P_FollowUp_TS4",  "W.P_FollowUp_TS5",  "W.P_FollowUp_TS6",
                    "W.P_FollowUp_TS7",  "W.P_FollowUp_TS8",  "W.P_FollowUp_TS9",
                    "W.P_FollowUp_TS10",
                    "W.P_FollowUp 1"     AS "W.P_FollowUp",
                    "W.P_FollowUp_TS1"   AS "W.P_FollowUp TS",
                    whatsapp_last_contacted,
                    COALESCE(whatsapp_last_contacted, parse_wp_date("W.P_1")) AS latest_wp_date,
                    parse_wp_date("W.P_1") AS wp1_parsed_date
                FROM nurture
                WHERE (
                    (whatsapp_last_contacted BETWEEN p_from AND p_to)
                    OR (whatsapp_last_contacted IS NULL AND parse_wp_date("W.P_1") BETWEEN p_from AND p_to)
                )
                ORDER BY COALESCE(whatsapp_last_contacted, parse_wp_date("W.P_1")) DESC NULLS LAST
            ) r
        ), '[]'::json),

        -- â”€â”€ owners: unchanged â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        'owners', COALESCE((
            SELECT json_agg(row_to_json(r))
            FROM (
                SELECT
                    id,
                    "createdOn",
                    name,
                    "contactNo",
                    "Whatsapp_1",
                    "Whatsapp_1_Date",
                    "Whatsapp_1_status",
                    "WTS_Reply_Track",
                    retry_1,
                    "User_Replied_1",   "User_Replied_2",   "User_Replied_3",
                    "User_Replied_4",   "User_Replied_5",   "User_Replied_6",
                    "User_Replied_7",   "User_Replied_8",   "User_Replied_9",
                    "User_Replied_10",
                    "Bot_Replied_1",    "Bot_Replied_2",    "Bot_Replied_3",
                    "Bot_Replied_4",    "Bot_Replied_5",    "Bot_Replied_6",
                    "Bot_Replied_7",    "Bot_Replied_8",    "Bot_Replied_9",
                    "Bot_Replied_10",
                    "Bot_Replied_Status_1", "Bot_Replied_Status_2",
                    "Bot_Replied_Status_3", "Bot_Replied_Status_4",
                    "Bot_Replied_Status_5",
                    safe_ts("Whatsapp_1_Date") AS whatsapp_1_parsed_date
                FROM owner_data
                WHERE "Whatsapp_1_Date" IS NOT NULL
                  AND "Whatsapp_1_Date" <> ''
                  AND safe_ts("Whatsapp_1_Date") BETWEEN p_from AND p_to
                ORDER BY safe_ts("Whatsapp_1_Date") DESC
            ) r
        ), '[]'::json)

    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_wa_leads_list(timestamptz, timestamptz) TO anon, authenticated, service_role;


-- ============================================================
-- FILE: 009_master_metrics_voice_replies.sql
-- ============================================================

-- =============================================================================
-- get_master_metrics â€” add voice counts + fix WA replies source
--
-- Changes from 005:
--   1. totalVoiceCalls  = vapi_call_logs WHERE source='vapi' AND vapi_account != 'owners'
--      filtered by started_at BETWEEN p_from AND p_to
--   2. ownerVoiceCalls  = vapi_call_logs WHERE vapi_account = 'owners'
--      filtered by started_at BETWEEN p_from AND p_to
--   3. totalWaReplies   = count of leads with non-null/empty "W.P_Replied 1"
--      across nr_wf, followup, nurture â€” using whatsapp_last_contacted OR
--      parse_wp_date("W.P_1") for the date filter (same as get_wa_leads_list)
--
-- Run in Supabase SQL Editor â€” safe to re-run (CREATE OR REPLACE)
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

    -- â”€â”€ Total Leads (master_leads, filtered by "Created At") â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    -- â”€â”€ WA Reachouts â€” all three lead tables via parse_wp_date("W.P_1") â”€â”€â”€â”€â”€â”€
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

    -- â”€â”€ WA Replies â€” count leads with "W.P_Replied 1" populated in range â”€â”€â”€â”€â”€
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

    -- â”€â”€ Voice counts + Vapi cost â€” from vapi_call_logs, filtered by started_at â”€
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

    -- â”€â”€ Owner Leads count (by createdOn) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    owner_summary AS (
        SELECT COUNT(*) AS total_owner_leads
        FROM owner_data
        WHERE "createdOn" >= p_from AND "createdOn" <= p_to
    ),

    -- â”€â”€ Owner WA Reachouts â€” filtered by Whatsapp_1_Date â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    owner_wa_reach AS (
        SELECT COUNT(*) AS owner_wa_reachouts
        FROM owner_data
        WHERE "Whatsapp_1_Date" IS NOT NULL AND "Whatsapp_1_Date" != ''
          AND safe_ts("Whatsapp_1_Date") IS NOT NULL
          AND safe_ts("Whatsapp_1_Date") >= p_from
          AND safe_ts("Whatsapp_1_Date") <= p_to
    ),

    -- â”€â”€ Owner WA Replies â€” filtered by Whatsapp_1_Date â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


-- ============================================================
-- FILE: 010_users_table.sql
-- ============================================================

-- Create the users table for authentication
CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    email text NOT NULL,
    password_hash text NOT NULL,
    full_name text NULL,
    is_active bool NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    last_login timestamptz NULL,
    password_changed_at timestamptz NULL DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email)
) TABLESPACE pg_default;

-- Grant access to anon, authenticated, and service_role
GRANT ALL ON public.users TO anon, authenticated, service_role;

-- Seed the admin user
-- Password: ScalePods@123 (bcrypt hashed)
INSERT INTO public.users (email, password_hash, full_name, is_active)
VALUES (
    'info@scalepods.co',
    '$2b$10$nnrLniUWbr4DX0y7ZI1GkeP02nw2CJR0akmDe8jWRWPExuaNAKTBi',
    'ScalePods Admin',
    true
)
ON CONFLICT (email) DO NOTHING;


-- ============================================================
-- FILE: 011_seed_admin_user.sql
-- ============================================================

-- ============================================================
-- Migration 011: Seed / update the ScalePods admin user
-- Password: ScalePods@123
-- Hash generated with bcryptjs (cost=10)
-- ============================================================

-- Ensure the users table exists (idempotent)
CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    email text NOT NULL,
    password_hash text NOT NULL,
    full_name text NULL,
    is_active boolean NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    last_login timestamp with time zone NULL,
    password_changed_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email)
) TABLESPACE pg_default;

-- Grant necessary permissions
GRANT ALL ON public.users TO anon, authenticated, service_role;

-- Upsert the admin credential
-- If the row exists, update password_hash and reset password_changed_at so it is not expired.
INSERT INTO public.users (email, password_hash, full_name, is_active, password_changed_at)
VALUES (
    'info@scalepods.co',
    '$2b$10$.JS3hD4iv8nzry4P0sxG1ukadTa6YvCSsDwbBUJ7agmh/WpK6UY/6',
    'ScalePods Admin',
    true,
    now()
)
ON CONFLICT (email) DO UPDATE
    SET password_hash        = EXCLUDED.password_hash,
        full_name            = EXCLUDED.full_name,
        is_active            = EXCLUDED.is_active,
        password_changed_at  = now();



