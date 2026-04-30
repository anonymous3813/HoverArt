import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
export async function query(text, params) {
    const client = await pool.connect();
    try {
        return await client.query(text, params);
    }
    finally {
        client.release();
    }
}
export async function initDb() {
    await query(`
    CREATE TABLE IF NOT EXISTS users (
      id        SERIAL PRIMARY KEY,
      username  VARCHAR(50)  NOT NULL,
      email     VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await query(`
    CREATE TABLE IF NOT EXISTS omni_summaries (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title         VARCHAR(500),
      source_url    TEXT,
      body_text     TEXT NOT NULL,
      ai_summary    TEXT,
      status        VARCHAR(32) NOT NULL DEFAULT 'pending',
      error_detail  TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await query(`
    CREATE INDEX IF NOT EXISTS idx_omni_summaries_user_created
    ON omni_summaries(user_id, created_at DESC)
  `);
    await query(`
    CREATE TABLE IF NOT EXISTS omni_projects (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title         VARCHAR(500) NOT NULL,
      source_kind   VARCHAR(64),
      source_url    TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await query(`
    CREATE INDEX IF NOT EXISTS idx_omni_projects_user_created
    ON omni_projects(user_id, created_at DESC)
  `);
    await query(`
    CREATE TABLE IF NOT EXISTS omni_project_artifacts (
      id            SERIAL PRIMARY KEY,
      project_id    INTEGER NOT NULL REFERENCES omni_projects(id) ON DELETE CASCADE,
      kind          VARCHAR(48) NOT NULL,
      title         VARCHAR(500),
      body_text     TEXT NOT NULL,
      source_url    TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await query(`
    CREATE INDEX IF NOT EXISTS idx_omni_artifacts_project
    ON omni_project_artifacts(project_id, created_at DESC)
  `);
    await query(`
    ALTER TABLE omni_summaries
    ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES omni_projects(id) ON DELETE SET NULL
  `);
    await query(`
    CREATE INDEX IF NOT EXISTS idx_omni_summaries_project
    ON omni_summaries(project_id)
    WHERE project_id IS NOT NULL
  `);
    await query(`
    ALTER TABLE omni_summaries
    ADD COLUMN IF NOT EXISTS source_channel VARCHAR(32)
  `);
    await query(`
    CREATE INDEX IF NOT EXISTS idx_omni_summaries_source
    ON omni_summaries(user_id, source_channel, created_at DESC)
  `);
}
