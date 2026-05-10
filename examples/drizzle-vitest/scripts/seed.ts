import Database from "better-sqlite3";

const db = new Database("dev.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
  );

  INSERT OR REPLACE INTO users (email, name)
  VALUES ('demo@example.com', 'Demo User');
`);

db.close();
