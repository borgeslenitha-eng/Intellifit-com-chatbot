-- Aditiva: preserva users e foods existentes. Não execute DROP TABLE.
CREATE TABLE IF NOT EXISTS chat_sessions (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 state JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS chat_messages (
 id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role VARCHAR(12) NOT NULL CHECK(role IN ('user','assistant')), content TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON chat_messages(user_id,id);
CREATE INDEX IF NOT EXISTS foods_user_id_idx ON foods(user_id);

-- v2: validade não informada é NULL. Datas existentes permanecem intactas.
ALTER TABLE foods ALTER COLUMN expiration_date DROP NOT NULL;
