-- =============================================================================
-- 013_complete_activity_tables_schema.sql
-- Complete Schema & Indexes for Activity Tables:
--   1. public.aspen_activity
--   2. public.fello_activity
--   3. public.naples_activity
--   4. public.old_activity
-- =============================================================================

-- 1. TABLE: public.aspen_activity
CREATE TABLE IF NOT EXISTS public.aspen_activity (
  id bigserial not null,
  lead_id bigint not null,
  lead_name text null,
  lead_phone text null,
  lead_email text null,
  channel text not null,
  action_type text not null,
  status text null,
  sentiment text null,
  note text null,
  summary text null,
  content text null,
  transcript text null,
  duration_seconds integer null,
  appointment_datetime timestamp with time zone null,
  workflow_name text null,
  created_at timestamp with time zone null default now(),
  recording_url text null,
  cost_usd double precision null,
  vapi_call_id text null,
  assistant_id text null,
  vapi_account text null,
  lead_temp text null,
  crm_updated text null,
  replied_at text null,
  whatsapp_count integer null default 0,
  sms_count integer null default 0,
  call_count integer null default 0,
  email_count integer null default 0,
  last_reachout_at text null,
  next_reachout_at text null,
  type text null,
  started_at timestamp with time zone null,
  customer_phone text null,
  customer_name text null,
  source text null,
  master_leads_id bigint null,
  updated_at timestamp with time zone null default now(),
  "Error" text null,
  constraint aspen_activity_pkey primary key (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_aa_channel_created ON public.aspen_activity USING btree (channel, created_at desc);
CREATE INDEX IF NOT EXISTS idx_aa_channel_vapi_account ON public.aspen_activity USING btree (channel, vapi_account);
CREATE INDEX IF NOT EXISTS idx_aa_channel_status ON public.aspen_activity USING btree (channel, status);
CREATE INDEX IF NOT EXISTS idx_aa_channel_created_account ON public.aspen_activity USING btree (channel, created_at desc, vapi_account);
CREATE INDEX IF NOT EXISTS idx_aa_lead_phone ON public.aspen_activity USING btree (lead_phone);
CREATE INDEX IF NOT EXISTS idx_aa_lead_name ON public.aspen_activity USING btree (lead_name);
CREATE INDEX IF NOT EXISTS idx_aa_vapi_call_id ON public.aspen_activity USING btree (vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_aa_channel_assistant_id ON public.aspen_activity USING btree (channel, assistant_id);
CREATE INDEX IF NOT EXISTS idx_aa_channel_cost_created ON public.aspen_activity USING btree (channel, created_at, cost_usd);
CREATE INDEX IF NOT EXISTS idx_aa_channel_duration ON public.aspen_activity USING btree (channel, duration_seconds);
CREATE INDEX IF NOT EXISTS idx_aspen_activity_lead_id ON public.aspen_activity USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_aspen_activity_channel ON public.aspen_activity USING btree (channel);
CREATE INDEX IF NOT EXISTS idx_aspen_activity_action_type ON public.aspen_activity USING btree (action_type);
CREATE INDEX IF NOT EXISTS idx_aspen_activity_created_at ON public.aspen_activity USING btree (created_at desc);


-- 2. TABLE: public.fello_activity
CREATE TABLE IF NOT EXISTS public.fello_activity (
  id bigserial not null,
  lead_id bigint not null,
  lead_name text null,
  lead_phone text null,
  lead_email text null,
  channel text not null,
  action_type text not null,
  status text null,
  sentiment text null,
  note text null,
  summary text null,
  content text null,
  transcript text null,
  duration_seconds integer null,
  appointment_datetime timestamp with time zone null,
  workflow_name text null,
  created_at timestamp with time zone null default now(),
  recording_url text null,
  cost_usd double precision null,
  vapi_call_id text null,
  assistant_id text null,
  vapi_account text null,
  lead_temp text null,
  crm_updated text null,
  replied_at text null,
  whatsapp_count integer null default 0,
  sms_count integer null default 0,
  call_count integer null default 0,
  email_count integer null default 0,
  last_reachout_at text null,
  next_reachout_at text null,
  type text null,
  started_at timestamp with time zone null,
  customer_phone text null,
  customer_name text null,
  source text null,
  master_leads_id bigint null,
  updated_at timestamp with time zone null default now(),
  "Error" text null,
  constraint fello_activity_pkey primary key (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_fa_channel_created ON public.fello_activity USING btree (channel, created_at desc);
CREATE INDEX IF NOT EXISTS idx_fa_channel_vapi_account ON public.fello_activity USING btree (channel, vapi_account);
CREATE INDEX IF NOT EXISTS idx_fa_channel_status ON public.fello_activity USING btree (channel, status);
CREATE INDEX IF NOT EXISTS idx_fa_channel_created_account ON public.fello_activity USING btree (channel, created_at desc, vapi_account);
CREATE INDEX IF NOT EXISTS idx_fa_lead_phone ON public.fello_activity USING btree (lead_phone);
CREATE INDEX IF NOT EXISTS idx_fa_lead_name ON public.fello_activity USING btree (lead_name);
CREATE INDEX IF NOT EXISTS idx_fa_vapi_call_id ON public.fello_activity USING btree (vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_fa_channel_assistant_id ON public.fello_activity USING btree (channel, assistant_id);
CREATE INDEX IF NOT EXISTS idx_fa_channel_cost_created ON public.fello_activity USING btree (channel, created_at, cost_usd);
CREATE INDEX IF NOT EXISTS idx_fa_channel_duration ON public.fello_activity USING btree (channel, duration_seconds);
CREATE INDEX IF NOT EXISTS idx_fello_activity_lead_id ON public.fello_activity USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_fello_activity_channel ON public.fello_activity USING btree (channel);
CREATE INDEX IF NOT EXISTS idx_fello_activity_action_type ON public.fello_activity USING btree (action_type);
CREATE INDEX IF NOT EXISTS idx_fello_activity_created_at ON public.fello_activity USING btree (created_at desc);


-- 3. TABLE: public.naples_activity
CREATE TABLE IF NOT EXISTS public.naples_activity (
  id bigserial not null,
  lead_id bigint not null,
  lead_name text null,
  lead_phone text null,
  lead_email text null,
  channel text not null,
  action_type text not null,
  status text null,
  sentiment text null,
  note text null,
  summary text null,
  content text null,
  transcript text null,
  duration_seconds integer null,
  appointment_datetime timestamp with time zone null,
  workflow_name text null,
  created_at timestamp with time zone null default now(),
  recording_url text null,
  cost_usd double precision null,
  vapi_call_id text null,
  assistant_id text null,
  vapi_account text null,
  lead_temp text null,
  crm_updated text null,
  replied_at text null,
  whatsapp_count integer null default 0,
  sms_count integer null default 0,
  call_count integer null default 0,
  email_count integer null default 0,
  last_reachout_at text null,
  next_reachout_at text null,
  type text null,
  started_at timestamp with time zone null,
  customer_phone text null,
  customer_name text null,
  source text null,
  master_leads_id bigint null,
  updated_at timestamp with time zone null default now(),
  "Error" text null,
  constraint naples_activity_pkey primary key (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_na_channel_created ON public.naples_activity USING btree (channel, created_at desc);
CREATE INDEX IF NOT EXISTS idx_na_channel_vapi_account ON public.naples_activity USING btree (channel, vapi_account);
CREATE INDEX IF NOT EXISTS idx_na_channel_status ON public.naples_activity USING btree (channel, status);
CREATE INDEX IF NOT EXISTS idx_na_channel_created_account ON public.naples_activity USING btree (channel, created_at desc, vapi_account);
CREATE INDEX IF NOT EXISTS idx_na_lead_phone ON public.naples_activity USING btree (lead_phone);
CREATE INDEX IF NOT EXISTS idx_na_lead_name ON public.naples_activity USING btree (lead_name);
CREATE INDEX IF NOT EXISTS idx_na_vapi_call_id ON public.naples_activity USING btree (vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_na_channel_assistant_id ON public.naples_activity USING btree (channel, assistant_id);
CREATE INDEX IF NOT EXISTS idx_na_channel_cost_created ON public.naples_activity USING btree (channel, created_at, cost_usd);
CREATE INDEX IF NOT EXISTS idx_na_channel_duration ON public.naples_activity USING btree (channel, duration_seconds);
CREATE INDEX IF NOT EXISTS idx_naples_activity_lead_id ON public.naples_activity USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_naples_activity_channel ON public.naples_activity USING btree (channel);
CREATE INDEX IF NOT EXISTS idx_naples_activity_action_type ON public.naples_activity USING btree (action_type);
CREATE INDEX IF NOT EXISTS idx_naples_activity_created_at ON public.naples_activity USING btree (created_at desc);


-- 4. TABLE: public.old_activity
CREATE TABLE IF NOT EXISTS public.old_activity (
  id bigserial not null,
  lead_id bigint not null,
  lead_name text null,
  lead_phone text null,
  lead_email text null,
  channel text not null,
  action_type text not null,
  status text null,
  sentiment text null,
  note text null,
  summary text null,
  content text null,
  transcript text null,
  duration_seconds integer null,
  appointment_datetime timestamp with time zone null,
  workflow_name text null,
  created_at timestamp with time zone null default now(),
  recording_url text null,
  cost_usd double precision null,
  vapi_call_id text null,
  assistant_id text null,
  vapi_account text null,
  lead_temp text null,
  crm_updated text null,
  replied_at text null,
  whatsapp_count integer null default 0,
  sms_count integer null default 0,
  call_count integer null default 0,
  email_count integer null default 0,
  last_reachout_at text null,
  next_reachout_at text null,
  type text null,
  started_at timestamp with time zone null,
  customer_phone text null,
  customer_name text null,
  source text null,
  master_leads_id bigint null,
  updated_at timestamp with time zone null default now(),
  "Error" text null,
  constraint old_activity_pkey primary key (id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_oa_channel_created ON public.old_activity USING btree (channel, created_at desc);
CREATE INDEX IF NOT EXISTS idx_oa_channel_vapi_account ON public.old_activity USING btree (channel, vapi_account);
CREATE INDEX IF NOT EXISTS idx_oa_channel_status ON public.old_activity USING btree (channel, status);
CREATE INDEX IF NOT EXISTS idx_oa_channel_created_account ON public.old_activity USING btree (channel, created_at desc, vapi_account);
CREATE INDEX IF NOT EXISTS idx_oa_lead_phone ON public.old_activity USING btree (lead_phone);
CREATE INDEX IF NOT EXISTS idx_oa_lead_name ON public.old_activity USING btree (lead_name);
CREATE INDEX IF NOT EXISTS idx_oa_vapi_call_id ON public.old_activity USING btree (vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_oa_channel_assistant_id ON public.old_activity USING btree (channel, assistant_id);
CREATE INDEX IF NOT EXISTS idx_oa_channel_cost_created ON public.old_activity USING btree (channel, created_at, cost_usd);
CREATE INDEX IF NOT EXISTS idx_oa_channel_duration ON public.old_activity USING btree (channel, duration_seconds);
CREATE INDEX IF NOT EXISTS idx_old_activity_lead_id ON public.old_activity USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_old_activity_channel ON public.old_activity USING btree (channel);
CREATE INDEX IF NOT EXISTS idx_old_activity_action_type ON public.old_activity USING btree (action_type);
CREATE INDEX IF NOT EXISTS idx_old_activity_created_at ON public.old_activity USING btree (created_at desc);

-- Grants
GRANT ALL ON TABLE public.aspen_activity  TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.fello_activity  TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.naples_activity TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.old_activity    TO anon, authenticated, service_role;
