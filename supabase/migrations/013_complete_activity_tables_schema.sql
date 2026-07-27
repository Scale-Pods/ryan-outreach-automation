-- =============================================================================
-- 013_complete_activity_tables_schema.sql
-- Complete Schema & Indexes for:
--   1. public.aspen_activity
--   2. public.fello_activity
--   3. public.naples_activity
--   4. public.old_activity
--
-- Adds all necessary columns required for Voice AI, WhatsApp CRM, Email Marketing,
-- SMS, and Frontend Analytics across all 4 category activity tables.
-- =============================================================================

-- =============================================================================
-- 1. TABLE: public.aspen_activity
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.aspen_activity (
  id                      BIGSERIAL PRIMARY KEY,
  lead_id                 BIGINT NOT NULL,
  lead_name               TEXT NULL,
  lead_phone              TEXT NULL,
  lead_email              TEXT NULL,
  channel                 TEXT NOT NULL,               -- 'voice' | 'whatsapp' | 'email' | 'sms' | 'form'
  action_type             TEXT NOT NULL,               -- 'inbound_call' | 'outbound_call' | 'broadcast' | 'reply' | 'email_sent' | etc.
  status                  TEXT NULL,                  -- 'completed' | 'answered' | 'delivered' | 'read' | 'opened' | 'bounced' | etc.
  sentiment               TEXT NULL,                  -- 'positive' | 'neutral' | 'negative' | 'hesitant' | etc.
  lead_temp               TEXT NULL,                  -- 'Hot' | 'Warm' | 'Cold' | 'Unqualified' | etc.
  note                    TEXT NULL,
  summary                 TEXT NULL,
  content                 TEXT NULL,                  -- Message text / Email body / Form content
  transcript              TEXT NULL,                  -- Voice call transcript
  duration_seconds        INTEGER NULL,
  appointment_datetime    TIMESTAMP WITH TIME ZONE NULL,
  workflow_name           TEXT NULL,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recording_url           TEXT NULL,
  cost_usd                DOUBLE PRECISION NULL,
  telephony_cost          DOUBLE PRECISION NULL,       -- Separate Twilio / Telephony provider cost
  vapi_call_id            TEXT NULL,
  assistant_id            TEXT NULL,
  vapi_account            TEXT NULL,
  call_ended_reason       TEXT NULL,                  -- 'assistant-ended-call', 'customer-ended-call', etc.
  crm_updated             TEXT NULL,
  replied_at              TIMESTAMP WITH TIME ZONE NULL,
  
  -- Email Marketing Columns
  email_subject           TEXT NULL,
  campaign_id             TEXT NULL,
  campaign_name           TEXT NULL,
  message_id              TEXT NULL,
  opened_at               TIMESTAMP WITH TIME ZONE NULL,
  clicked_at              TIMESTAMP WITH TIME ZONE NULL,
  bounced_at              TIMESTAMP WITH TIME ZONE NULL,
  unsubscribed_at         TIMESTAMP WITH TIME ZONE NULL,

  -- WhatsApp & SMS Columns
  whatsapp_message_id     TEXT NULL,
  sender_phone            TEXT NULL,
  receiver_phone          TEXT NULL,
  direction               TEXT NULL,                  -- 'inbound' | 'outbound'
  delivered_at            TIMESTAMP WITH TIME ZONE NULL,
  read_at                 TIMESTAMP WITH TIME ZONE NULL,
  media_url               TEXT NULL,
  media_type              TEXT NULL,                  -- 'image' | 'document' | 'audio' | 'video'

  -- Metadata
  metadata                JSONB DEFAULT '{}'::jsonb
) TABLESPACE pg_default;

-- Indexes for aspen_activity
CREATE INDEX IF NOT EXISTS idx_aa_channel_created          ON public.aspen_activity USING btree (channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aa_channel_vapi_account     ON public.aspen_activity USING btree (channel, vapi_account);
CREATE INDEX IF NOT EXISTS idx_aa_channel_status           ON public.aspen_activity USING btree (channel, status);
CREATE INDEX IF NOT EXISTS idx_aa_channel_created_account ON public.aspen_activity USING btree (channel, created_at DESC, vapi_account);
CREATE INDEX IF NOT EXISTS idx_aa_lead_phone               ON public.aspen_activity USING btree (lead_phone);
CREATE INDEX IF NOT EXISTS idx_aa_lead_name                ON public.aspen_activity USING btree (lead_name);
CREATE INDEX IF NOT EXISTS idx_aa_vapi_call_id            ON public.aspen_activity USING btree (vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_aa_channel_assistant_id    ON public.aspen_activity USING btree (channel, assistant_id);
CREATE INDEX IF NOT EXISTS idx_aa_channel_cost_created     ON public.aspen_activity USING btree (channel, created_at, cost_usd);
CREATE INDEX IF NOT EXISTS idx_aa_channel_duration         ON public.aspen_activity USING btree (channel, duration_seconds);
CREATE INDEX IF NOT EXISTS idx_aspen_activity_lead_id     ON public.aspen_activity USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_aspen_activity_channel     ON public.aspen_activity USING btree (channel);
CREATE INDEX IF NOT EXISTS idx_aspen_activity_action_type ON public.aspen_activity USING btree (action_type);
CREATE INDEX IF NOT EXISTS idx_aspen_activity_created_at  ON public.aspen_activity USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aa_lead_temp               ON public.aspen_activity USING btree (lead_temp);
CREATE INDEX IF NOT EXISTS idx_aa_campaign_id             ON public.aspen_activity USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_aa_whatsapp_msg_id         ON public.aspen_activity USING btree (whatsapp_message_id);


-- =============================================================================
-- 2. TABLE: public.fello_activity
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.fello_activity (
  id                      BIGSERIAL PRIMARY KEY,
  lead_id                 BIGINT NOT NULL,
  lead_name               TEXT NULL,
  lead_phone              TEXT NULL,
  lead_email              TEXT NULL,
  channel                 TEXT NOT NULL,               -- 'voice' | 'whatsapp' | 'email' | 'sms' | 'form'
  action_type             TEXT NOT NULL,
  status                  TEXT NULL,
  sentiment               TEXT NULL,
  lead_temp               TEXT NULL,
  note                    TEXT NULL,
  summary                 TEXT NULL,
  content                 TEXT NULL,
  transcript              TEXT NULL,
  duration_seconds        INTEGER NULL,
  appointment_datetime    TIMESTAMP WITH TIME ZONE NULL,
  workflow_name           TEXT NULL,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recording_url           TEXT NULL,
  cost_usd                DOUBLE PRECISION NULL,
  telephony_cost          DOUBLE PRECISION NULL,
  vapi_call_id            TEXT NULL,
  assistant_id            TEXT NULL,
  vapi_account            TEXT NULL,
  call_ended_reason       TEXT NULL,
  crm_updated             TEXT NULL,
  replied_at              TIMESTAMP WITH TIME ZONE NULL,

  -- Email Marketing Columns
  email_subject           TEXT NULL,
  campaign_id             TEXT NULL,
  campaign_name           TEXT NULL,
  message_id              TEXT NULL,
  opened_at               TIMESTAMP WITH TIME ZONE NULL,
  clicked_at              TIMESTAMP WITH TIME ZONE NULL,
  bounced_at              TIMESTAMP WITH TIME ZONE NULL,
  unsubscribed_at         TIMESTAMP WITH TIME ZONE NULL,

  -- WhatsApp & SMS Columns
  whatsapp_message_id     TEXT NULL,
  sender_phone            TEXT NULL,
  receiver_phone          TEXT NULL,
  direction               TEXT NULL,
  delivered_at            TIMESTAMP WITH TIME ZONE NULL,
  read_at                 TIMESTAMP WITH TIME ZONE NULL,
  media_url               TEXT NULL,
  media_type              TEXT NULL,

  -- Metadata
  metadata                JSONB DEFAULT '{}'::jsonb
) TABLESPACE pg_default;

-- Indexes for fello_activity
CREATE INDEX IF NOT EXISTS idx_fa_channel_created          ON public.fello_activity USING btree (channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fa_channel_vapi_account     ON public.fello_activity USING btree (channel, vapi_account);
CREATE INDEX IF NOT EXISTS idx_fa_channel_status           ON public.fello_activity USING btree (channel, status);
CREATE INDEX IF NOT EXISTS idx_fa_channel_created_account ON public.fello_activity USING btree (channel, created_at DESC, vapi_account);
CREATE INDEX IF NOT EXISTS idx_fa_lead_phone               ON public.fello_activity USING btree (lead_phone);
CREATE INDEX IF NOT EXISTS idx_fa_lead_name                ON public.fello_activity USING btree (lead_name);
CREATE INDEX IF NOT EXISTS idx_fa_vapi_call_id            ON public.fello_activity USING btree (vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_fa_channel_assistant_id    ON public.fello_activity USING btree (channel, assistant_id);
CREATE INDEX IF NOT EXISTS idx_fa_channel_cost_created     ON public.fello_activity USING btree (channel, created_at, cost_usd);
CREATE INDEX IF NOT EXISTS idx_fa_channel_duration         ON public.fello_activity USING btree (channel, duration_seconds);
CREATE INDEX IF NOT EXISTS idx_fello_activity_lead_id     ON public.fello_activity USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_fello_activity_channel     ON public.fello_activity USING btree (channel);
CREATE INDEX IF NOT EXISTS idx_fello_activity_action_type ON public.fello_activity USING btree (action_type);
CREATE INDEX IF NOT EXISTS idx_fello_activity_created_at  ON public.fello_activity USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fa_lead_temp               ON public.fello_activity USING btree (lead_temp);
CREATE INDEX IF NOT EXISTS idx_fa_campaign_id             ON public.fello_activity USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_fa_whatsapp_msg_id         ON public.fello_activity USING btree (whatsapp_message_id);


-- =============================================================================
-- 3. TABLE: public.naples_activity
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.naples_activity (
  id                      BIGSERIAL PRIMARY KEY,
  lead_id                 BIGINT NOT NULL,
  lead_name               TEXT NULL,
  lead_phone              TEXT NULL,
  lead_email              TEXT NULL,
  channel                 TEXT NOT NULL,               -- 'voice' | 'whatsapp' | 'email' | 'sms' | 'form'
  action_type             TEXT NOT NULL,
  status                  TEXT NULL,
  sentiment               TEXT NULL,
  lead_temp               TEXT NULL,
  note                    TEXT NULL,
  summary                 TEXT NULL,
  content                 TEXT NULL,
  transcript              TEXT NULL,
  duration_seconds        INTEGER NULL,
  appointment_datetime    TIMESTAMP WITH TIME ZONE NULL,
  workflow_name           TEXT NULL,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recording_url           TEXT NULL,
  cost_usd                DOUBLE PRECISION NULL,
  telephony_cost          DOUBLE PRECISION NULL,
  vapi_call_id            TEXT NULL,
  assistant_id            TEXT NULL,
  vapi_account            TEXT NULL,
  call_ended_reason       TEXT NULL,
  crm_updated             TEXT NULL,
  replied_at              TIMESTAMP WITH TIME ZONE NULL,

  -- Email Marketing Columns
  email_subject           TEXT NULL,
  campaign_id             TEXT NULL,
  campaign_name           TEXT NULL,
  message_id              TEXT NULL,
  opened_at               TIMESTAMP WITH TIME ZONE NULL,
  clicked_at              TIMESTAMP WITH TIME ZONE NULL,
  bounced_at              TIMESTAMP WITH TIME ZONE NULL,
  unsubscribed_at         TIMESTAMP WITH TIME ZONE NULL,

  -- WhatsApp & SMS Columns
  whatsapp_message_id     TEXT NULL,
  sender_phone            TEXT NULL,
  receiver_phone          TEXT NULL,
  direction               TEXT NULL,
  delivered_at            TIMESTAMP WITH TIME ZONE NULL,
  read_at                 TIMESTAMP WITH TIME ZONE NULL,
  media_url               TEXT NULL,
  media_type              TEXT NULL,

  -- Metadata
  metadata                JSONB DEFAULT '{}'::jsonb
) TABLESPACE pg_default;

-- Indexes for naples_activity
CREATE INDEX IF NOT EXISTS idx_na_channel_created          ON public.naples_activity USING btree (channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_na_channel_vapi_account     ON public.naples_activity USING btree (channel, vapi_account);
CREATE INDEX IF NOT EXISTS idx_na_channel_status           ON public.naples_activity USING btree (channel, status);
CREATE INDEX IF NOT EXISTS idx_na_channel_created_account ON public.naples_activity USING btree (channel, created_at DESC, vapi_account);
CREATE INDEX IF NOT EXISTS idx_na_lead_phone               ON public.naples_activity USING btree (lead_phone);
CREATE INDEX IF NOT EXISTS idx_na_lead_name                ON public.naples_activity USING btree (lead_name);
CREATE INDEX IF NOT EXISTS idx_na_vapi_call_id            ON public.naples_activity USING btree (vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_na_channel_assistant_id    ON public.naples_activity USING btree (channel, assistant_id);
CREATE INDEX IF NOT EXISTS idx_na_channel_cost_created     ON public.naples_activity USING btree (channel, created_at, cost_usd);
CREATE INDEX IF NOT EXISTS idx_na_channel_duration         ON public.naples_activity USING btree (channel, duration_seconds);
CREATE INDEX IF NOT EXISTS idx_naples_activity_lead_id     ON public.naples_activity USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_naples_activity_channel     ON public.naples_activity USING btree (channel);
CREATE INDEX IF NOT EXISTS idx_naples_activity_action_type ON public.naples_activity USING btree (action_type);
CREATE INDEX IF NOT EXISTS idx_naples_activity_created_at  ON public.naples_activity USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_na_lead_temp               ON public.naples_activity USING btree (lead_temp);
CREATE INDEX IF NOT EXISTS idx_na_campaign_id             ON public.naples_activity USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_na_whatsapp_msg_id         ON public.naples_activity USING btree (whatsapp_message_id);


-- =============================================================================
-- 4. TABLE: public.old_activity
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.old_activity (
  id                      BIGSERIAL PRIMARY KEY,
  lead_id                 BIGINT NOT NULL,
  lead_name               TEXT NULL,
  lead_phone              TEXT NULL,
  lead_email              TEXT NULL,
  channel                 TEXT NOT NULL,               -- 'voice' | 'whatsapp' | 'email' | 'sms' | 'form'
  action_type             TEXT NOT NULL,
  status                  TEXT NULL,
  sentiment               TEXT NULL,
  lead_temp               TEXT NULL,
  note                    TEXT NULL,
  summary                 TEXT NULL,
  content                 TEXT NULL,
  transcript              TEXT NULL,
  duration_seconds        INTEGER NULL,
  appointment_datetime    TIMESTAMP WITH TIME ZONE NULL,
  workflow_name           TEXT NULL,
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recording_url           TEXT NULL,
  cost_usd                DOUBLE PRECISION NULL,
  telephony_cost          DOUBLE PRECISION NULL,
  vapi_call_id            TEXT NULL,
  assistant_id            TEXT NULL,
  vapi_account            TEXT NULL,
  call_ended_reason       TEXT NULL,
  crm_updated             TEXT NULL,
  replied_at              TIMESTAMP WITH TIME ZONE NULL,

  -- Email Marketing Columns
  email_subject           TEXT NULL,
  campaign_id             TEXT NULL,
  campaign_name           TEXT NULL,
  message_id              TEXT NULL,
  opened_at               TIMESTAMP WITH TIME ZONE NULL,
  clicked_at              TIMESTAMP WITH TIME ZONE NULL,
  bounced_at              TIMESTAMP WITH TIME ZONE NULL,
  unsubscribed_at         TIMESTAMP WITH TIME ZONE NULL,

  -- WhatsApp & SMS Columns
  whatsapp_message_id     TEXT NULL,
  sender_phone            TEXT NULL,
  receiver_phone          TEXT NULL,
  direction               TEXT NULL,
  delivered_at            TIMESTAMP WITH TIME ZONE NULL,
  read_at                 TIMESTAMP WITH TIME ZONE NULL,
  media_url               TEXT NULL,
  media_type              TEXT NULL,

  -- Metadata
  metadata                JSONB DEFAULT '{}'::jsonb
) TABLESPACE pg_default;

-- Indexes for old_activity
CREATE INDEX IF NOT EXISTS idx_oa_channel_created          ON public.old_activity USING btree (channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oa_channel_vapi_account     ON public.old_activity USING btree (channel, vapi_account);
CREATE INDEX IF NOT EXISTS idx_oa_channel_status           ON public.old_activity USING btree (channel, status);
CREATE INDEX IF NOT EXISTS idx_oa_channel_created_account ON public.old_activity USING btree (channel, created_at DESC, vapi_account);
CREATE INDEX IF NOT EXISTS idx_oa_lead_phone               ON public.old_activity USING btree (lead_phone);
CREATE INDEX IF NOT EXISTS idx_oa_lead_name                ON public.old_activity USING btree (lead_name);
CREATE INDEX IF NOT EXISTS idx_oa_vapi_call_id            ON public.old_activity USING btree (vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_oa_channel_assistant_id    ON public.old_activity USING btree (channel, assistant_id);
CREATE INDEX IF NOT EXISTS idx_oa_channel_cost_created     ON public.old_activity USING btree (channel, created_at, cost_usd);
CREATE INDEX IF NOT EXISTS idx_oa_channel_duration         ON public.old_activity USING btree (channel, duration_seconds);
CREATE INDEX IF NOT EXISTS idx_old_activity_lead_id     ON public.old_activity USING btree (lead_id);
CREATE INDEX IF NOT EXISTS idx_old_activity_channel     ON public.old_activity USING btree (channel);
CREATE INDEX IF NOT EXISTS idx_old_activity_action_type ON public.old_activity USING btree (action_type);
CREATE INDEX IF NOT EXISTS idx_old_activity_created_at  ON public.old_activity USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oa_lead_temp               ON public.old_activity USING btree (lead_temp);
CREATE INDEX IF NOT EXISTS idx_oa_campaign_id             ON public.old_activity USING btree (campaign_id);
CREATE INDEX IF NOT EXISTS idx_oa_whatsapp_msg_id         ON public.old_activity USING btree (whatsapp_message_id);

-- Grants
GRANT ALL ON TABLE public.aspen_activity  TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.fello_activity  TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.naples_activity TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.old_activity    TO anon, authenticated, service_role;
