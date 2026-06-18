-- =============================================================================
-- VOICE METRICS — PRODUCTION SQL
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query → Run
-- Safe to re-run: all statements use CREATE OR REPLACE / IF NOT EXISTS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. INDEXES — vapi_call_logs
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
--    Single round-trip — returns every metric the dashboard needs.
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
