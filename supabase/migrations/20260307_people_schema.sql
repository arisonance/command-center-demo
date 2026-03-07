-- ============================================
-- PEOPLE CONTACTS — auto-populated from Cortex
-- Stores scored contacts per user with urgency tiers
-- ============================================

CREATE TABLE IF NOT EXISTS people_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    urgency TEXT DEFAULT 'gray',
    urgency_score NUMERIC DEFAULT 0,
    touchpoint_count INTEGER DEFAULT 0,
    last_contact_at TIMESTAMPTZ,
    channels JSONB DEFAULT '{}',
    action_summary TEXT,
    teams_chat_id TEXT,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

ALTER TABLE people_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on people_contacts" ON people_contacts
    FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_people_contacts_updated_at ON people_contacts;
CREATE TRIGGER update_people_contacts_updated_at
    BEFORE UPDATE ON people_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_people_contacts_user_id ON people_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_people_contacts_urgency ON people_contacts(urgency);
CREATE INDEX IF NOT EXISTS idx_people_contacts_urgency_score ON people_contacts(user_id, urgency_score DESC);
CREATE INDEX IF NOT EXISTS idx_people_contacts_last_contact ON people_contacts(last_contact_at DESC);

-- ============================================
-- PINNED PEOPLE — user-pinned contacts
-- ============================================

CREATE TABLE IF NOT EXISTS pinned_people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    person_name TEXT NOT NULL,
    person_email TEXT,
    pinned_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, person_name)
);

ALTER TABLE pinned_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on pinned_people" ON pinned_people
    FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS update_pinned_people_updated_at ON pinned_people;
CREATE TRIGGER update_pinned_people_updated_at
    BEFORE UPDATE ON pinned_people
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_pinned_people_user_id ON pinned_people(user_id);
CREATE INDEX IF NOT EXISTS idx_pinned_people_lookup ON pinned_people(user_id, person_name);
