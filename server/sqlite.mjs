import { DatabaseSync } from 'node:sqlite';
import { schema } from './api.mjs';
export function openDatabase(filename = ':memory:') {
 const sqlite = new DatabaseSync(filename); sqlite.exec('PRAGMA journal_mode=WAL;'); sqlite.exec(schema);
 return {
  prepare(sql) {
   let bindings = [];
   const statement = { bind(...args) { bindings = args; return statement; },
    async first() { return sqlite.prepare(sql).get(...bindings) ?? null; },
    async all() { return { results: sqlite.prepare(sql).all(...bindings) }; },
    async run() { const result = sqlite.prepare(sql).run(...bindings); return { meta: { changes: Number(result.changes) } }; },
   }; return statement;
  },
  close() { sqlite.close(); },
 };
}
