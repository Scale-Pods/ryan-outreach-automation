-- =============================================================================
-- WA LEADS LIST — date-filters by actual WhatsApp send timestamps
--
-- Run in Supabase SQL Editor — safe to re-run (CREATE OR REPLACE / IF NOT EXISTS)
-- =============================================================================

-- ── Indexes (already exist in prod, IF NOT EXISTS is safe) ───────────────────

-- nr_wf."W.P_1 TS" (single space) — already created by prod DDL
CREATE INDEX IF NOT EXISTS idx_nr_wf_wp1_ts
    ON nr_wf ("W.P_1 TS")
    WHERE "W.P_1 TS" IS NOT NULL AND "W.P_1 TS" <> '';

-- followup."W.P_1  TS" (double space) — already created by prod DDL
CREATE INDEX IF NOT EXISTS idx_followup_wp1_ts
    ON followup ("W.P_1  TS")
    WHERE "W.P_1  TS" IS NOT NULL AND "W.P_1  TS" <> '';

-- owner_data."Whatsapp_1_Date" — already created by prod DDL
CREATE INDEX IF NOT EXISTS idx_owner_data_whatsapp1_date
    ON owner_data ("Whatsapp_1_Date")
    WHERE "Whatsapp_1_Date" IS NOT NULL AND "Whatsapp_1_Date" <> '';

-- ── Helper: parse "Delivered - DD/MM/YYYY" or "Read - DD/MM/YYYY HH:MM:SS" ──

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

-- ── RPC: get_wa_leads_list ────────────────────────────────────────────────────

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

        -- ── nr_wf: filter by date embedded in W.P_1 message text ─────────
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

        -- ── followup: filter by date embedded in W.P_1 message text ──────
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

        -- ── nurture: filter by date embedded in W.P_1 message text ───────
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

        -- ── owners: filter by "Whatsapp_1_Date" ──────────────────────────
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
