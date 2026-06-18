-- =============================================================================
-- get_leads_for_display — returns date-filtered rows from all 4 lead tables
-- Run in Supabase SQL Editor: Dashboard → SQL Editor → New Query → Run
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
