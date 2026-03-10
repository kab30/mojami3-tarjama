import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS novels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    novel_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    translated_content TEXT,
    status TEXT DEFAULT 'IDLE',
    error TEXT,
    order_index INTEGER DEFAULT 0,
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    is_working INTEGER DEFAULT 1,
    error_count INTEGER DEFAULT 0,
    token_usage INTEGER DEFAULT 0,
    quota_reached INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    prompt TEXT,
    target_language TEXT,
    source_language TEXT,
    selected_models TEXT -- Store as JSON string
  );
`);

export default db;
