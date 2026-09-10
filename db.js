const { createClient } = require('@libsql/client');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

let db;

if (TURSO_DATABASE_URL && TURSO_AUTH_TOKEN) {
  // Menggunakan Turso Cloud SQLite jika Environment Variable tersedia (Online/Vercel)
  const client = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN,
  });

  db = {
    all: async (sql, params = []) => {
      const res = await client.execute({ sql, args: params });
      return res.rows;
    },
    get: async (sql, params = []) => {
      const res = await client.execute({ sql, args: params });
      return res.rows[0] || null;
    },
    run: async (sql, params = []) => {
      const res = await client.execute({ sql, args: params });
      return { lastID: Number(res.lastInsertRowid), changes: res.rowsAffected };
    }
  };
  console.log('Terhubung ke Turso Cloud Database');
} else {
  // Menggunakan SQLite lokal untuk pengujian di laptop
  const dbPath = path.join(__dirname, 'portal-ujian.db');
  const localDb = new sqlite3.Database(dbPath);

  db = {
    all: (sql, params = []) => new Promise((resolve, reject) => {
      localDb.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    }),
    get: (sql, params = []) => new Promise((resolve, reject) => {
      localDb.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    }),
    run: (sql, params = []) => new Promise((resolve, reject) => {
      localDb.run(sql, params, function (err) {
        err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes });
      });
    })
  };
  console.log('Terhubung ke Database SQLite Lokal:', dbPath);
}

module.exports = db;