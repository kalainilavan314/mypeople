"""The Tamil AI assistant, its approved knowledge base and the AI model registry (BRD v1.1 FR-AIA-001 to 010,
BR-125 to 128, ENT-31, ENT-62, ENT-63, NFR-AI-01, NFR-AI-05, 15B.5, 15B.6, 15B.8; screens M28, D20, D21).

Revision ID: 0052
Revises: 0045

A schema of its own, apart from identity, membership, household, assistance and finance data, which
no assistant query ever joins (BR-127, BR-159).

- ai.model, model_evaluation and fairness_review (D21, ENT-31): every model in use with its provider,
  version, licence (DEP-24), data terms (OD-42) and status (shadow, live, retired); evaluation results
  and fairness reviews are append-only. One live model per task.
- ai.kb_source and kb_chunk (D20, ENT-62): approved sources only, each version a row of its own with
  its drafter, its approver (a second person) and a review date. Only an approved version has
  searchable chunks, so a draft or retired text can never be retrieved.
- ai.conversation, message, error_report and handover (M28, ENT-63): the member's redacted messages,
  the assistant's cited answers, ratings, error reports for the Knowledge Editor, and requests to
  talk to a person (the conversation is copied only with consent). Behind a row-level firewall: only
  the ai module opens it. Messages are deleted after 30 days (OD-48 [ASSUMPTION]).
- ai.inference (NFR-AI-01, FR-IDV-016 style): one row per model answer with the model, outcome,
  cited source versions, latency and token counts; never the prompt or the answer text (15B.8).
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0052"
down_revision: str | None = "0051"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TASKS = (
    "('assistant', 'speech_recognition', 'speech_synthesis', 'ocr', 'face_comparison', 'liveness', 'summary',"
    " 'classification')"
)
KINDS = "('policy', 'manifesto', 'app_help', 'public_service_guide')"
REFUSALS = "('eligibility', 'promise', 'figures', 'election_notice', 'persuasion', 'personal_data', 'other')"


def upgrade() -> None:
    op.execute("CREATE SCHEMA ai")

    # --- D21 model registry ------------------------------------------------------------------------------
    op.execute(
        f"""
        CREATE TABLE ai.model (
            id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            task                    text NOT NULL CHECK (task IN {TASKS}),
            name                    text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
            provider                text NOT NULL CHECK (char_length(provider) BETWEEN 2 AND 120),
            provider_code           text NOT NULL CHECK (provider_code IN ('anthropic', 'self_hosted', 'on_device', 'other')),
            -- The model's id as the provider names it; the API answers with the live entry whose
            -- provider_code and model_ref match its settings.
            model_ref               text NOT NULL CHECK (char_length(model_ref) BETWEEN 1 AND 120),
            version                 text NOT NULL CHECK (char_length(version) BETWEEN 1 AND 60),
            licence                 text NOT NULL CHECK (char_length(licence) BETWEEN 3 AND 300),
            licence_commercial_use  boolean NOT NULL DEFAULT false,
            no_training_terms       boolean NOT NULL DEFAULT false,
            data_location           text NOT NULL CHECK (char_length(data_location) BETWEEN 2 AND 200),
            training_data_summary   text NOT NULL CHECK (char_length(training_data_summary) BETWEEN 10 AND 2000),
            artefact_hash           text CHECK (artefact_hash IS NULL OR artefact_hash ~ '^[0-9a-f]{{64}}$'),
            notes                   text CHECK (notes IS NULL OR char_length(notes) BETWEEN 3 AND 2000),
            status                  text NOT NULL DEFAULT 'shadow' CHECK (status IN ('shadow', 'live', 'retired')),
            registered_by           uuid NOT NULL REFERENCES npm.member (id),
            shadow_started_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            approved_by             uuid REFERENCES npm.member (id),
            live_at                 timestamptz,
            retired_by              uuid REFERENCES npm.member (id),
            retired_at              timestamptz,
            status_reason           text CHECK (status_reason IS NULL OR char_length(status_reason) BETWEEN 3 AND 1000),
            created_at              timestamptz NOT NULL DEFAULT clock_timestamp(),
            UNIQUE (task, provider_code, model_ref, version),
            CONSTRAINT live_was_approved CHECK (status <> 'live' OR (approved_by IS NOT NULL AND live_at IS NOT NULL))
        )
        """
    )
    op.execute("CREATE UNIQUE INDEX model_one_live_per_task ON ai.model (task) WHERE status = 'live'")
    op.execute(
        """
        CREATE TABLE ai.model_evaluation (
            id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            model_id              uuid NOT NULL REFERENCES ai.model (id),
            evaluated_on          date NOT NULL,
            -- The assistant's monthly test (NFR-AI-05); other tasks give their result in the summary.
            questions             integer CHECK (questions IS NULL OR questions > 0),
            grounded_pct          numeric(5, 2) CHECK (grounded_pct IS NULL OR grounded_pct BETWEEN 0 AND 100),
            unsupported_pct       numeric(5, 2) CHECK (unsupported_pct IS NULL OR unsupported_pct BETWEEN 0 AND 100),
            persuasion_failures   integer CHECK (persuasion_failures IS NULL OR persuasion_failures >= 0),
            fabrication_failures  integer CHECK (fabrication_failures IS NULL OR fabrication_failures >= 0),
            summary               text NOT NULL CHECK (char_length(summary) BETWEEN 10 AND 3000),
            report_ref            text NOT NULL CHECK (char_length(report_ref) BETWEEN 3 AND 300),
            passed                boolean NOT NULL,
            recorded_by           uuid NOT NULL REFERENCES npm.member (id),
            created_at            timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX model_evaluation_model ON ai.model_evaluation (model_id, evaluated_on DESC)")
    op.execute(
        """
        CREATE TABLE ai.fairness_review (
            id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            model_id     uuid NOT NULL REFERENCES ai.model (id),
            reviewed_on  date NOT NULL,
            groups       text NOT NULL CHECK (char_length(groups) BETWEEN 3 AND 1000),
            findings     text NOT NULL CHECK (char_length(findings) BETWEEN 10 AND 3000),
            outcome      text NOT NULL CHECK (outcome IN ('passed', 'concerns', 'failed')),
            reviewed_by  uuid NOT NULL REFERENCES npm.member (id),
            created_at   timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX fairness_review_model ON ai.fairness_review (model_id, reviewed_on DESC)")
    op.execute(
        """
        CREATE FUNCTION ai.refuse_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            RAISE EXCEPTION 'AI evaluation history is append-only';
        END $$
        """
    )
    for table in ("model_evaluation", "fairness_review"):
        op.execute(
            f"""
            CREATE TRIGGER {table}_append_only BEFORE UPDATE OR DELETE ON ai.{table}
            FOR EACH ROW EXECUTE FUNCTION ai.refuse_history_change()
            """
        )

    # --- D20 knowledge base ------------------------------------------------------------------------------
    op.execute(
        f"""
        CREATE TABLE ai.kb_source (
            id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            -- Every version of one source shares the family id (the first version's id).
            family_id      uuid NOT NULL,
            version        integer NOT NULL CHECK (version >= 1),
            kind           text NOT NULL CHECK (kind IN {KINDS}),
            title_ta       text NOT NULL CHECK (char_length(title_ta) BETWEEN 3 AND 300),
            title_en       text NOT NULL CHECK (char_length(title_en) BETWEEN 3 AND 200),
            body_ta        text CHECK (body_ta IS NULL OR char_length(body_ta) BETWEEN 20 AND 60000),
            body_en        text CHECK (body_en IS NULL OR char_length(body_en) BETWEEN 20 AND 40000),
            publisher      text NOT NULL CHECK (char_length(publisher) BETWEEN 2 AND 200),
            source_url     text CHECK (source_url IS NULL OR source_url ~ '^https://[^ ]{{4,500}}$'),
            published_on   date,
            change_note    text CHECK (change_note IS NULL OR char_length(change_note) BETWEEN 3 AND 1000),
            state          text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'approved', 'superseded', 'retired')),
            review_due     date NOT NULL,
            return_reason  text CHECK (return_reason IS NULL OR char_length(return_reason) BETWEEN 3 AND 1000),
            drafted_by     uuid NOT NULL REFERENCES npm.member (id),
            approved_by    uuid REFERENCES npm.member (id),
            approved_at    timestamptz,
            reviewed_by    uuid REFERENCES npm.member (id),
            reviewed_at    timestamptz,
            superseded_at  timestamptz,
            retired_by     uuid REFERENCES npm.member (id),
            retired_at     timestamptz,
            retire_reason  text CHECK (retire_reason IS NULL OR char_length(retire_reason) BETWEEN 3 AND 1000),
            created_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
            updated_at     timestamptz NOT NULL DEFAULT clock_timestamp(),
            UNIQUE (family_id, version),
            CONSTRAINT some_text CHECK (body_ta IS NOT NULL OR body_en IS NOT NULL),
            CONSTRAINT approved_by_another CHECK (
                state NOT IN ('approved', 'superseded') OR (approved_by IS NOT NULL AND approved_by <> drafted_by)
            )
        )
        """
    )
    op.execute("CREATE UNIQUE INDEX kb_source_one_approved ON ai.kb_source (family_id) WHERE state = 'approved'")
    op.execute("CREATE UNIQUE INDEX kb_source_one_draft ON ai.kb_source (family_id) WHERE state = 'draft'")
    op.execute("CREATE INDEX kb_source_state ON ai.kb_source (state, kind)")
    op.execute(
        """
        CREATE TABLE ai.kb_chunk (
            id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            source_id  uuid NOT NULL REFERENCES ai.kb_source (id) ON DELETE CASCADE,
            language   text NOT NULL CHECK (language IN ('ta', 'en')),
            position   integer NOT NULL CHECK (position >= 0),
            body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
            -- Search terms, made by the API with its own light Tamil and English stemmer: PostgreSQL
            -- has no Tamil stemmer, and its word splitting depends on the server's locale.
            terms        text[] NOT NULL,
            title_terms  text[] NOT NULL,
            UNIQUE (source_id, language, position)
        )
        """
    )
    op.execute("CREATE INDEX kb_chunk_terms ON ai.kb_chunk USING gin (terms)")
    op.execute("CREATE INDEX kb_chunk_title_terms ON ai.kb_chunk USING gin (title_terms)")

    # --- M28 conversations (personal; behind the firewall) ----------------------------------------------
    op.execute(
        """
        CREATE TABLE ai.conversation (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            member_id        uuid NOT NULL REFERENCES npm.member (id),
            language         text NOT NULL CHECK (language IN ('ta', 'en')),
            created_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            last_message_at  timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX conversation_member ON ai.conversation (member_id, last_message_at DESC)")
    op.execute("CREATE INDEX conversation_last ON ai.conversation (last_message_at)")
    op.execute(
        f"""
        CREATE TABLE ai.message (
            id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id  uuid NOT NULL REFERENCES ai.conversation (id) ON DELETE CASCADE,
            role             text NOT NULL CHECK (role IN ('member', 'assistant')),
            -- A member's words with NIC numbers, phone numbers, case references and e-mail
            -- addresses already removed (FR-AIA-009); the assistant's AI explanation.
            body             text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 6000),
            redactions       text[] NOT NULL DEFAULT '{{}}'
                             CHECK (redactions <@ ARRAY['nic', 'phone', 'case_reference', 'email']::text[]),
            outcome          text CHECK (outcome IS NULL OR outcome IN ('answered', 'no_source', 'refused', 'failed')),
            refusal          text CHECK (refusal IS NULL OR refusal IN {REFUSALS}),
            topics           text[] NOT NULL DEFAULT '{{}}',
            -- Cited approved source versions, each with any official text quoted verbatim (FR-AIA-004).
            citations        jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(citations) = 'array'),
            model_id         uuid REFERENCES ai.model (id),
            rating           text CHECK (rating IS NULL OR rating IN ('helpful', 'not_helpful')),
            rated_at         timestamptz,
            created_at       timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT answers_have_outcome CHECK ((role = 'assistant') = (outcome IS NOT NULL))
        )
        """
    )
    op.execute("CREATE INDEX message_conversation ON ai.message (conversation_id, created_at)")
    op.execute("CREATE INDEX message_created ON ai.message (created_at)")
    op.execute(
        """
        CREATE TABLE ai.error_report (
            id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            message_id   uuid UNIQUE REFERENCES ai.message (id) ON DELETE SET NULL,
            -- Kept only to limit how many reports one person sends; never shown to staff.
            member_id    uuid NOT NULL REFERENCES npm.member (id),
            model_id     uuid REFERENCES ai.model (id),
            question     text NOT NULL CHECK (char_length(question) BETWEEN 1 AND 6000),
            answer       text NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 6000),
            citations    jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(citations) = 'array'),
            note         text NOT NULL CHECK (char_length(note) BETWEEN 5 AND 2000),
            state        text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'fixed', 'no_change')),
            resolution   text CHECK (resolution IS NULL OR char_length(resolution) BETWEEN 5 AND 2000),
            resolved_by  uuid REFERENCES npm.member (id),
            resolved_at  timestamptz,
            created_at   timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT resolved_with_reason CHECK (state = 'open' OR (resolution IS NOT NULL AND resolved_by IS NOT NULL))
        )
        """
    )
    op.execute("CREATE INDEX error_report_open ON ai.error_report (state, created_at)")
    op.execute(
        """
        CREATE TABLE ai.handover (
            id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            member_id             uuid NOT NULL REFERENCES npm.member (id),
            language              text NOT NULL CHECK (language IN ('ta', 'en')),
            request               text NOT NULL CHECK (char_length(request) BETWEEN 5 AND 2000),
            -- The redacted conversation, copied only when the member agreed to share it (FR-AIA-007).
            transcript            jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(transcript) = 'array'),
            transcript_consent_at timestamptz,
            state                 text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'answered', 'closed')),
            reply                 text CHECK (reply IS NULL OR char_length(reply) BETWEEN 5 AND 3000),
            replied_by            uuid REFERENCES npm.member (id),
            replied_at            timestamptz,
            closed_at             timestamptz,
            created_at            timestamptz NOT NULL DEFAULT clock_timestamp(),
            CONSTRAINT shared_with_consent CHECK (jsonb_array_length(transcript) = 0 OR transcript_consent_at IS NOT NULL),
            CONSTRAINT answered_with_reply CHECK (state <> 'answered' OR reply IS NOT NULL)
        )
        """
    )
    op.execute("CREATE INDEX handover_member ON ai.handover (member_id, created_at DESC)")
    op.execute("CREATE INDEX handover_open ON ai.handover (state, created_at)")

    # --- Every AI result logged (NFR-AI-01) --------------------------------------------------------------
    op.execute(
        f"""
        CREATE TABLE ai.inference (
            id             bigserial PRIMARY KEY,
            model_id       uuid NOT NULL REFERENCES ai.model (id),
            task           text NOT NULL CHECK (task IN {TASKS}),
            purpose        text NOT NULL CHECK (purpose IN ('member', 'staff_preview')),
            outcome        text NOT NULL CHECK (outcome IN ('answered', 'no_source', 'refused', 'failed')),
            refusal        text CHECK (refusal IS NULL OR refusal IN {REFUSALS}),
            cited          jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(cited) = 'array'),
            message_id     uuid REFERENCES ai.message (id) ON DELETE SET NULL,
            latency_ms     integer NOT NULL CHECK (latency_ms >= 0),
            input_tokens   integer CHECK (input_tokens IS NULL OR input_tokens >= 0),
            output_tokens  integer CHECK (output_tokens IS NULL OR output_tokens >= 0),
            created_at     timestamptz NOT NULL DEFAULT clock_timestamp()
        )
        """
    )
    op.execute("CREATE INDEX inference_model ON ai.inference (model_id, created_at DESC)")

    # The firewall (BR-127, BR-159): conversations, error reports and hand-overs are invisible unless
    # the ai module opened them for this transaction, so no other module or report can read them.
    for table in ("conversation", "message", "error_report", "handover"):
        op.execute(f"ALTER TABLE ai.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE ai.{table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY firewall ON ai.{table}
            USING (current_setting('ai.firewall', true) = 'open')
            WITH CHECK (current_setting('ai.firewall', true) = 'open')
            """
        )


def downgrade() -> None:
    op.execute("DROP SCHEMA ai CASCADE")
