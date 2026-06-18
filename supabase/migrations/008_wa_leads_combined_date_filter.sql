-- =============================================================================
-- get_wa_leads_list — FIXED: combined date filter
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
-- All column aliases from 007 are preserved (space→underscore for JS access).
-- Run in Supabase SQL Editor — safe to re-run (CREATE OR REPLACE)
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

        -- ── nr_wf ─────────────────────────────────────────────────────────────
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

        -- ── followup ──────────────────────────────────────────────────────────
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

        -- ── nurture ───────────────────────────────────────────────────────────
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

        -- ── owners: unchanged ─────────────────────────────────────────────────
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
