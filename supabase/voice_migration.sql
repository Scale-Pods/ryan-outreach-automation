-- =============================================================================
-- 012_fello_activity_indexes_rpcs.sql
-- INDEXES + RPC FUNCTIONS for fello_activity (voice channel)
--
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query → Run
-- Safe to re-run: all statements use CREATE OR REPLACE / IF NOT EXISTS
-- =============================================================================

-- =============================================================================
-- 1. INDEXES — fello_activity
-- =============================================================================

-- Core filter: channel = 'voice' with date range
CREATE INDEX IF NOT EXISTS idx_fa_channel_created
    ON fello_activity (channel, created_at DESC);

-- Filter by vapi_account (normal vs owners)
CREATE INDEX IF NOT EXISTS idx_fa_channel_vapi_account
    ON fello_activity (channel, vapi_account);

-- Filter by status
CREATE INDEX IF NOT EXISTS idx_fa_channel_status
    ON fello_activity (channel, status);

-- Composite: channel + created_at + vapi_account (covers most queries)
CREATE INDEX IF NOT EXISTS idx_fa_channel_created_account
    ON fello_activity (channel, created_at DESC, vapi_account);

-- Phone number search (text_pattern_ops for LIKE 'prefix%')
CREATE INDEX IF NOT EXISTS idx_fa_lead_phone
    ON fello_activity (lead_phone);

-- Lead name search
CREATE INDEX IF NOT EXISTS idx_fa_lead_name
    ON fello_activity (lead_name);

-- vapi_call_id lookup (for joins / dedup)
CREATE INDEX IF NOT EXISTS idx_fa_vapi_call_id
    ON fello_activity (vapi_call_id);

-- assistant_id for region/open-house filters
CREATE INDEX IF NOT EXISTS idx_fa_channel_assistant_id
    ON fello_activity (channel, assistant_id);

-- Cost aggregation
CREATE INDEX IF NOT EXISTS idx_fa_channel_cost_created
    ON fello_activity (channel, created_at, cost_usd);

-- Duration bucketing
CREATE INDEX IF NOT EXISTS idx_fa_channel_duration
    ON fello_activity (channel, duration_seconds);

-- =============================================================================
-- 2. INDEXES — master_leads (for phone-based name resolution)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_ml_phone
    ON master_leads (phone);
CREATE INDEX IF NOT EXISTS idx_ml_name
    ON master_leads (name);

-- =============================================================================
-- 3. FUNCTION: get_voice_calls
--
--    Returns pre-processed voice calls ready for the frontend to render.
--    Handles: name resolution, type resolution, display formatting,
--             filtering, sorting, pagination.
--
--    Parameters:
--      p_from       — start of date range (timestamptz)
--      p_to         — end of date range (timestamptz)
--      p_account    — 'vapi' | 'vapi-normal' | 'open-house' | NULL (all)
--      p_status     — status filter or 'all'
--      p_type       — 'Inbound' | 'Outbound' | 'secondary-leads' | 'normal' | 'all'
--      p_phone      — free-text search on name/phone (NULL = no filter)
--      p_region     — 'uae' | 'us' | 'uk' | 'all'
--      p_sort       — 'newest' | 'oldest' | 'longest' | 'shortest'
--      p_page       — 1-based page number
--      p_limit      — rows per page
--
--    Returns: JSON { calls: [...], total: N }
-- =============================================================================

CREATE OR REPLACE FUNCTION get_voice_calls(
    p_from       timestamptz,
    p_to         timestamptz,
    p_account    text DEFAULT NULL,
    p_status     text DEFAULT 'all',
    p_type       text DEFAULT 'all',
    p_phone      text DEFAULT NULL,
    p_region     text DEFAULT 'all',
    p_sort       text DEFAULT 'newest',
    p_page       int  DEFAULT 1,
    p_limit      int  DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_result json;
    v_offset int := (p_page - 1) * p_limit;
    v_total  int;
BEGIN
    -- ── Count total matching rows ────────────────────────────────────────────
    SELECT COUNT(*) INTO v_total
    FROM fello_activity fa
    WHERE fa.channel = 'voice'
      AND fa.created_at >= p_from
      AND fa.created_at <= p_to
      -- Account filter
      AND (
          p_account IS NULL
          OR p_account = 'vapi'
          OR (p_account = 'vapi-normal' AND (fa.vapi_account IS NULL OR fa.vapi_account != 'owners'))
          OR (p_account = 'open-house' AND fa.assistant_id = '1ef6ea66-0a75-45f5-b025-1743e048dc90')
      )
      -- Status filter
      AND (p_status = 'all' OR LOWER(fa.status) = LOWER(p_status))
      -- Type filter
      AND (
          p_type = 'all'
          OR (p_type = 'Inbound' AND LOWER(fa.action_type) LIKE '%inbound%')
          OR (p_type = 'Outbound' AND LOWER(fa.action_type) NOT LIKE '%inbound%')
          OR (p_type = 'normal' AND fa.assistant_id != '560ca61b-8cd3-4b5f-996b-2966abfa37fd')
          OR (p_type = 'secondary-leads' AND fa.assistant_id = '560ca61b-8cd3-4b5f-996b-2966abfa37fd')
      )
      -- Phone / name search
      AND (
          p_phone IS NULL OR p_phone = ''
          OR fa.lead_name ILIKE '%' || p_phone || '%'
          OR REPLACE(fa.lead_phone, '+', '') ILIKE '%' || REPLACE(p_phone, '+', '') || '%'
      )
      -- Region filter
      AND (
          p_region = 'all'
          OR (p_region = 'uae' AND fa.assistant_id IN ('70f05e16-18f3-4f6e-964a-f47b299c6c1d', '9ac979c3-a0b3-4af6-bb0d-07ddf9c0d1cd'))
          OR (p_region = 'us' AND fa.assistant_id = 'b35e3032-7865-4913-ba22-a913b5d4117b')
          OR (p_region = 'uk' AND fa.assistant_id = '918c25eb-9882-452e-86df-b4851d464852')
      );

    -- ── Return paginated results with name resolution ────────────────────────
    SELECT json_build_object(
        'calls', COALESCE(
            (SELECT json_agg(row_to_json(t) ORDER BY t.sort_key)
            FROM (
                SELECT
                    COALESCE(fa.vapi_call_id, fa.id::text)       AS "id",
                    -- Name resolution: prefer fello_activity.lead_name, fallback to master_leads
                    COALESCE(
                        NULLIF(fa.lead_name, ''),
                        NULLIF(fa.lead_name, 'Guest'),
                        NULLIF(fa.lead_name, 'Unknown'),
                        ml.name,
                        'Guest'
                    )                                             AS "name",
                    COALESCE(fa.lead_phone, 'Unknown')            AS "phone",
                    fa.created_at                                 AS "startedAt",
                    COALESCE(fa.duration_seconds, 0)              AS "durationSeconds",
                    CASE WHEN fa.cost_usd IS NOT NULL
                          THEN '$' || ROUND(CAST(fa.cost_usd AS numeric), 3)::text
                         ELSE '$0.00'
                    END                                           AS "cost",
                    COALESCE(fa.cost_usd, 0)                     AS "costValue",
                    COALESCE(fa.status, 'unknown')                AS "status",
                    'vapi'                                        AS "source",
                    (LOWER(fa.action_type) LIKE '%inbound%')      AS "isInbound",
                    CASE WHEN LOWER(fa.action_type) LIKE '%inbound%'
                         THEN 'Inbound'
                         ELSE 'Outbound'
                    END                                           AS "type",
                    fa.sentiment                                  AS "sentiment",
                    fa.summary                                    AS "summary",
                    fa.recording_url                              AS "recordingUrl",
                    fa.transcript                                 AS "transcript",
                    fa.vapi_account                               AS "vapiAccount",
                    fa.assistant_id                               AS "assistantId",
                    fa.lead_id                                    AS "leadId",
                    fa.workflow_name                              AS "workflowName",
                    fa.appointment_datetime                       AS "appointmentDatetime",
                    fa.note                                       AS "note",
                    fa.content                                    AS "content",
                    COALESCE(fa.lead_temp, 'Unknown')             AS "leadTemp",
                    -- Cost breakdown
                    json_build_object(
                        'agent',     COALESCE(fa.cost_usd, 0),
                        'telephony', 0
                    )                                             AS "breakdown",
                    -- Display fields (formatted in SQL for zero client processing)
                    TO_CHAR(fa.created_at, 'Mon DD, YYYY at HH12:MI AM') AS "displayDate",
                    CASE
                        WHEN fa.duration_seconds >= 3600
                            THEN (fa.duration_seconds / 3600)::int || 'h '
                                 || ((fa.duration_seconds % 3600) / 60)::int || 'm '
                                 || (fa.duration_seconds % 60)::int || 's'
                        WHEN fa.duration_seconds >= 60
                            THEN (fa.duration_seconds / 60)::int || 'm '
                                 || (fa.duration_seconds % 60)::int || 's'
                        ELSE fa.duration_seconds::int || 's'
                    END                                           AS "displayDuration",
                    -- Sort key
                    CASE
                        WHEN p_sort = 'oldest'  THEN fa.created_at
                        WHEN p_sort = 'longest' THEN NULL  -- handled below
                        WHEN p_sort = 'shortest' THEN NULL
                        ELSE fa.created_at
                    END                                           AS "sort_key",
                    CASE
                        WHEN p_sort = 'longest'  THEN 999999999 - COALESCE(fa.duration_seconds, 0)
                        WHEN p_sort = 'shortest' THEN COALESCE(fa.duration_seconds, 0)
                        ELSE 0
                    END                                           AS "duration_sort"
                FROM fello_activity fa
                    LEFT JOIN master_leads ml
                    ON REPLACE(COALESCE(ml.phone, ''), '+', '') = REPLACE(fa.lead_phone, '+', '')
                    AND ml.phone IS NOT NULL
                    AND ml.phone != ''
                WHERE fa.channel = 'voice'
                  AND fa.created_at >= p_from
                  AND fa.created_at <= p_to
                  -- Same filters as count above
                  AND (
                      p_account IS NULL
                      OR p_account = 'vapi'
                      OR (p_account = 'vapi-normal' AND (fa.vapi_account IS NULL OR fa.vapi_account != 'owners'))
                      OR (p_account = 'open-house' AND fa.assistant_id = '1ef6ea66-0a75-45f5-b025-1743e048dc90')
                  )
                  AND (p_status = 'all' OR LOWER(fa.status) = LOWER(p_status))
                  AND (
                      p_type = 'all'
                      OR (p_type = 'Inbound' AND LOWER(fa.action_type) LIKE '%inbound%')
                      OR (p_type = 'Outbound' AND LOWER(fa.action_type) NOT LIKE '%inbound%')
                      OR (p_type = 'normal' AND fa.assistant_id != '560ca61b-8cd3-4b5f-996b-2966abfa37fd')
                      OR (p_type = 'secondary-leads' AND fa.assistant_id = '560ca61b-8cd3-4b5f-996b-2966abfa37fd')
                  )
                  AND (
                      p_phone IS NULL OR p_phone = ''
                      OR fa.lead_name ILIKE '%' || p_phone || '%'
                      OR REPLACE(fa.lead_phone, '+', '') ILIKE '%' || REPLACE(p_phone, '+', '') || '%'
                  )
                  AND (
                      p_region = 'all'
                      OR (p_region = 'uae' AND fa.assistant_id IN ('70f05e16-18f3-4f6e-964a-f47b299c6c1d', '9ac979c3-a0b3-4af6-bb0d-07ddf9c0d1cd'))
                      OR (p_region = 'us' AND fa.assistant_id = 'b35e3032-7865-4913-ba22-a913b5d4117b')
                      OR (p_region = 'uk' AND fa.assistant_id = '918c25eb-9882-452e-86df-b4851d464852')
                  )
                ORDER BY
                    CASE WHEN p_sort = 'newest'  THEN fa.created_at END DESC NULLS LAST,
                    CASE WHEN p_sort = 'oldest'  THEN fa.created_at END ASC  NULLS LAST,
                    CASE WHEN p_sort = 'longest' THEN COALESCE(fa.duration_seconds, 0) END DESC NULLS LAST,
                    CASE WHEN p_sort = 'shortest' THEN COALESCE(fa.duration_seconds, 0) END ASC  NULLS LAST
                LIMIT p_limit OFFSET v_offset
            ) t),
            '[]'::json
        ),
        'total', v_total
    )
    INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_voice_calls(timestamptz, timestamptz, text, text, text, text, text, text, int, int)
    TO anon, authenticated, service_role;

-- =============================================================================
-- 4. FUNCTION: get_voice_metrics_fello
--
--    Same shape as original get_voice_metrics but queries fello_activity.
--    Single round-trip — returns every metric the dashboard needs.
--    All math runs in PostgreSQL. Node.js receives ~1KB JSON.
--
--    Pickup Rate  = duration_seconds > 18
--    Completion   = status IN (assistant-ended-call, customer-ended-call)
--    Normal Positive = sentiment IN ('positive', 'hesitant') AND vapi_account != 'owners'
--    Owner Positive  = sentiment IN ('positive', 'hesitant') AND vapi_account = 'owners'
-- =============================================================================

CREATE OR REPLACE FUNCTION get_voice_metrics_fello(
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
    calls_in_range AS (
        SELECT
            created_at,
            duration_seconds,
            cost_usd,
            status,
            vapi_account,
            sentiment
        FROM fello_activity
        WHERE channel = 'voice'
          AND created_at >= p_from
          AND created_at <= p_to
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
            -- Pickup = duration > 18s
            COUNT(*) FILTER (
                WHERE duration_seconds > 18
                  AND (vapi_account != 'owners' OR vapi_account IS NULL)
            )                                                               AS normal_connected,
            -- Completion = proper conversation ended
            COUNT(*) FILTER (
                WHERE status IN ('assistant-ended-call', 'customer-ended-call')
                  AND (vapi_account != 'owners' OR vapi_account IS NULL)
            )                                                               AS normal_qualified,
            -- Owner variants
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
            (created_at AT TIME ZONE 'UTC')::date AS day,
            COUNT(*)                              AS calls,
            COALESCE(SUM(cost_usd), 0)            AS cost
        FROM calls_in_range
        GROUP BY day
        ORDER BY day
    ),
    hourly AS (
        SELECT
            EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour,
            COUNT(*)                                              AS calls
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
                ELSE                            '5m+'
            END       AS label,
            COUNT(*) AS calls
        FROM calls_in_range
        GROUP BY label
    ),
    alltime AS (
        SELECT
            COUNT(*) FILTER (WHERE vapi_account = 'owners')  AS owner_calls,
            COUNT(*) FILTER (WHERE vapi_account != 'owners'
                              OR vapi_account IS NULL)        AS normal_calls
        FROM fello_activity
        WHERE channel = 'voice'
    ),
    normal_sentiment AS (
        SELECT
            COUNT(*) AS positive_count
        FROM calls_in_range
        WHERE (vapi_account != 'owners' OR vapi_account IS NULL)
          AND LOWER(sentiment) IN ('positive', 'hesitant')
    ),
    owner_positive AS (
        SELECT
            COUNT(*) AS positive_count
        FROM calls_in_range
        WHERE vapi_account = 'owners'
          AND LOWER(sentiment) IN ('positive', 'hesitant')
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
                                        '[]'::json),
        'costByDay',                COALESCE(
                                        (SELECT json_agg(json_build_object(
                                            'date',  to_char(day, 'YYYY-MM-DD'),
                                            'calls', calls,
                                            'cost',  ROUND(cost::numeric, 6)
                                        ) ORDER BY day) FROM daily),
                                        '[]'::json)
    )
    INTO v_result
    FROM summary s, alltime at, normal_sentiment ns, owner_positive op;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_voice_metrics_fello(timestamptz, timestamptz)
    TO anon, authenticated, service_role;

-- =============================================================================
-- 5. Verify
--    SELECT * FROM get_voice_calls(now() - interval '7 days', now());
--    SELECT get_voice_metrics_fello(now() - interval '7 days', now());
-- =============================================================================
