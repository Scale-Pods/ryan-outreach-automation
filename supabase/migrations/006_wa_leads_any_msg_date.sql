-- =============================================================================
-- get_wa_leads_list — FIXED: filter by ANY WP message date in range
--
-- Problem: 004 only filtered by parse_wp_date("W.P_1"), so leads whose first
-- message was sent before the range start were excluded even if W.P_2/W.P_3/W.P_4
-- fell within the range. This caused "less data" in the chat page.
--
-- Fix: include the lead if ANY of W.P_1..W.P_4 (and W.P_FollowUp 1 for nr_wf/followup)
-- has a parsed date within [p_from, p_to]. Also add latest_wp_date computed column
-- (the most recent message date in range) for display/sorting.
--
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

        -- ── nurture ───────────────────────────────────────────────────────────
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

        -- ── owners: unchanged — filter by Whatsapp_1_Date ────────────────────
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
