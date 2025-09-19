// lib/annotationsStore.ts
// DB-backed annotations store with in-memory fallback for development.
//
// Usage:
//   import { AnnotationsStore } from "@/lib/annotationsStore";
//
// Methods:
//   - all(): Promise<AnnotationRow[]>
//   - findById(id): Promise<AnnotationRow | null>
//   - findByDocumentId(documentId): Promise<AnnotationRow[]>
//   - nextSequenceForDocument(documentId): Promise<number>
//   - create(partial): Promise<AnnotationRow>   // server assigns sequence_number if missing (DB-side)
//   - update(id, patch): Promise<AnnotationRow | null>
//   - delete(id): Promise<boolean>
//   - _reset(): Promise<void> (dev helper — clears in-memory or DB table)
//
// Notes:
//  - This file tries to use your DatabaseService (imported from '@/lib/database').
//    If DatabaseService is not present or throws on import, it falls back to a fast
//    in-memory store (non-persistent across restarts).
//  - The DB `create` uses an INSERT ... SELECT approach to compute `sequence_number` atomically
//    in most SQL engines (MySQL/MariaDB). If you use a different DB, you may prefer a transaction
//    or other DB-specific upsert/sequence technique for full concurrency safety.
//  - Replace JSON column handling (content) as appropriate for your DB (this code stores content as JSON string).
//

type Nullable<T> = T | null;

export type AnnotationRow = {
  id: string;
  document_id: string;
  user_id?: string | null;
  user_name?: string | null;
  page_number: number;
  annotation_type: string;
  content: any;
  sequence_number: number;
  position_x: number;
  position_y: number;
  created_at: string; // ISO
  updated_at?: string; // ISO
};

let USING_DB = false;
let DatabaseService: any = null;

/* Try to import DatabaseService (your project likely exposes this). If import fails,
   we fall back to in-memory store. */
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
  DatabaseService = require("@/lib/database").DatabaseService ?? require("@/lib/database");
  if (DatabaseService) USING_DB = true;
} catch (e) {
  // Not available — we'll use the in-memory store below
  USING_DB = false;
}

/* Helper to normalize rows returned by many DB clients which return [rows, fields] */
function normalizeRows(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result) && Array.isArray(result[0])) return result[0];
  if (Array.isArray(result)) return result;
  return [];
}

/* ---------------------------
   In-memory fallback store
   --------------------------- */
let MEM_STORE: AnnotationRow[] = [];
let MEM_NEXT_ID = 1;

const InMemoryStore = {
  async all(): Promise<AnnotationRow[]> {
    return MEM_STORE.slice().sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0));
  },

  async findById(id: string): Promise<Nullable<AnnotationRow>> {
    return MEM_STORE.find((r) => r.id === id) ?? null;
  },

  async findByDocumentId(documentId: string): Promise<AnnotationRow[]> {
    return MEM_STORE.filter((r) => r.document_id === documentId).sort((a, b) => (a.sequence_number || 0) - (b.sequence_number || 0));
  },

  async nextSequenceForDocument(documentId: string): Promise<number> {
    if (!documentId) return 1;
    const rows = MEM_STORE.filter((r) => r.document_id === documentId);
    if (!rows.length) return 1;
    const maxSeq = rows.reduce((acc, r) => Math.max(acc, r.sequence_number || 0), 0);
    return maxSeq + 1;
  },

  async create(partial: Partial<AnnotationRow>): Promise<AnnotationRow> {
    const id = partial.id ?? `annotation_${Date.now()}_${MEM_NEXT_ID++}`;
    const now = new Date().toISOString();
    const document_id = partial.document_id ?? "";
    const sequence_number = typeof partial.sequence_number === "number" ? partial.sequence_number : (await this.nextSequenceForDocument(document_id));
    const row: AnnotationRow = {
      id,
      document_id,
      user_id: partial.user_id ?? null,
      user_name: partial.user_name ?? null,
      page_number: Number(partial.page_number ?? 1),
      annotation_type: partial.annotation_type ?? "sticky_note",
      content: partial.content ?? {},
      sequence_number,
      position_x: Number(partial.position_x ?? 0),
      position_y: Number(partial.position_y ?? 0),
      created_at: partial.created_at ?? now,
      updated_at: partial.updated_at ?? now,
    };
    MEM_STORE.push(row);
    return row;
  },

  async update(id: string, patch: Partial<AnnotationRow>): Promise<Nullable<AnnotationRow>> {
    const idx = MEM_STORE.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const now = new Date().toISOString();
    MEM_STORE[idx] = { ...MEM_STORE[idx], ...patch, updated_at: now };
    return MEM_STORE[idx];
  },

  async delete(id: string): Promise<boolean> {
    const idx = MEM_STORE.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    MEM_STORE.splice(idx, 1);
    return true;
  },

  async _reset(): Promise<void> {
    MEM_STORE = [];
    MEM_NEXT_ID = 1;
  },
};

/* ---------------------------
   DB-backed store
   --------------------------- */
const DbStore = {
  async all(): Promise<AnnotationRow[]> {
    const sql = `SELECT * FROM annotations ORDER BY sequence_number ASC`;
    const res = await DatabaseService.query(sql, []);
    const rows = normalizeRows(res);
    return rows;
  },

  async findById(id: string): Promise<Nullable<AnnotationRow>> {
    const res = await DatabaseService.query(`SELECT * FROM annotations WHERE id = ? LIMIT 1`, [id]);
    const rows = normalizeRows(res);
    if (!rows || rows.length === 0) return null;
    return rows[0];
  },

  async findByDocumentId(documentId: string): Promise<AnnotationRow[]> {
    const res = await DatabaseService.query(`SELECT * FROM annotations WHERE document_id = ? ORDER BY sequence_number ASC`, [documentId]);
    return normalizeRows(res);
  },

  async nextSequenceForDocument(documentId: string): Promise<number> {
    // This is a read — in concurrent environments prefer an atomic DB-side insert with subquery (used in create()).
    const res = await DatabaseService.query(`SELECT COALESCE(MAX(sequence_number), 0) AS max_seq FROM annotations WHERE document_id = ?`, [documentId]);
    const rows = normalizeRows(res);
    const max = rows && rows[0] && typeof rows[0].max_seq !== 'undefined' ? Number(rows[0].max_seq) : 0;
    return max + 1;
  },

  async create(partial: Partial<AnnotationRow>): Promise<AnnotationRow> {
    const id = partial.id ?? `annotation_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const now = new Date().toISOString();
    const document_id = partial.document_id ?? "";
    const user_id = partial.user_id ?? null;
    const user_name = partial.user_name ?? null;
    const page_number = Number(partial.page_number ?? 1);
    const annotation_type = partial.annotation_type ?? "sticky_note";
    const content = partial.content ?? {};
    const position_x = Number(partial.position_x ?? 0);
    const position_y = Number(partial.position_y ?? 0);

    // Insert with sequence number computed from existing rows in the same statement.
    // This avoids a short race window compared to doing SELECT then INSERT separately.
    // Works on MySQL/MariaDB. If you use another DB, adjust accordingly (transactions, sequences, etc).
    const insertSql = `
      INSERT INTO annotations
        (id, document_id, user_id, user_name, page_number, annotation_type, content, sequence_number, position_x, position_y, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, COALESCE(MAX(sequence_number), 0) + 1, ?, ?, ?, ?
      FROM annotations
      WHERE document_id = ?
    `;
    const params = [
      id,
      document_id,
      user_id,
      user_name,
      page_number,
      annotation_type,
      JSON.stringify(content),
      position_x,
      position_y,
      now,
      now,
      document_id,
    ];

    await DatabaseService.query(insertSql, params);

    // Retrieve created row
    const createdRes = await DatabaseService.query(`SELECT * FROM annotations WHERE id = ? LIMIT 1`, [id]);
    const createdRows = normalizeRows(createdRes);
    if (!createdRows || createdRows.length === 0) {
      // As a fallback (rare), if insert didn't run via SELECT FROM (e.g. no rows matched WHERE),
      // perform a direct insert with sequence_number = 1.
      const fallbackInsert = `
        INSERT INTO annotations
          (id, document_id, user_id, user_name, page_number, annotation_type, content, sequence_number, position_x, position_y, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const fallbackParams = [id, document_id, user_id, user_name, page_number, annotation_type, JSON.stringify(content), 1, position_x, position_y, now, now];
      await DatabaseService.query(fallbackInsert, fallbackParams);
      const ok = await DatabaseService.query(`SELECT * FROM annotations WHERE id = ? LIMIT 1`, [id]);
      return normalizeRows(ok)[0];
    }

    return createdRows[0];
  },

  async update(id: string, patch: Partial<AnnotationRow>): Promise<Nullable<AnnotationRow>> {
    const sets: string[] = [];
    const params: any[] = [];

    if (patch.content !== undefined) {
      sets.push("content = ?");
      params.push(JSON.stringify(patch.content));
    }
    if (patch.position_x !== undefined) {
      sets.push("position_x = ?");
      params.push(patch.position_x);
    }
    if (patch.position_y !== undefined) {
      sets.push("position_y = ?");
      params.push(patch.position_y);
    }
    if (patch.sequence_number !== undefined) {
      sets.push("sequence_number = ?");
      params.push(Number(patch.sequence_number));
    }
    if (patch.user_name !== undefined) {
      sets.push("user_name = ?");
      params.push(patch.user_name);
    }
    if (patch.page_number !== undefined) {
      sets.push("page_number = ?");
      params.push(Number(patch.page_number));
    }
    if (patch.annotation_type !== undefined) {
      sets.push("annotation_type = ?");
      params.push(patch.annotation_type);
    }

    if (sets.length === 0) return this.findById(id);

    sets.push("updated_at = ?");
    params.push(new Date().toISOString());

    const sql = `UPDATE annotations SET ${sets.join(", ")} WHERE id = ?`;
    params.push(id);

    await DatabaseService.query(sql, params);

    const res = await DatabaseService.query(`SELECT * FROM annotations WHERE id = ? LIMIT 1`, [id]);
    const rows = normalizeRows(res);
    return rows && rows[0] ? rows[0] : null;
  },

  async delete(id: string): Promise<boolean> {
    const res = await DatabaseService.query(`DELETE FROM annotations WHERE id = ?`, [id]);
    // Most DB clients return an object with affectedRows; we conservatively return true/false based on no error.
    return true;
  },

  async _reset(): Promise<void> {
    // CAUTION: This truncates the production table. Only for dev/test!
    await DatabaseService.query(`DELETE FROM annotations`, []);
  },
};

/* ---------------------------
   Exported store (auto-select backend)
   --------------------------- */

export const AnnotationsStore = {
  async all(): Promise<AnnotationRow[]> {
    return USING_DB ? await DbStore.all() : await InMemoryStore.all();
  },

  async findById(id: string): Promise<Nullable<AnnotationRow>> {
    return USING_DB ? await DbStore.findById(id) : await InMemoryStore.findById(id);
  },

  async findByDocumentId(documentId: string): Promise<AnnotationRow[]> {
    return USING_DB ? await DbStore.findByDocumentId(documentId) : await InMemoryStore.findByDocumentId(documentId);
  },

  async nextSequenceForDocument(documentId: string): Promise<number> {
    return USING_DB ? await DbStore.nextSequenceForDocument(documentId) : await InMemoryStore.nextSequenceForDocument(documentId);
  },

  async create(partial: Partial<AnnotationRow>): Promise<AnnotationRow> {
    return USING_DB ? await DbStore.create(partial) : await InMemoryStore.create(partial);
  },

  async update(id: string, patch: Partial<AnnotationRow>): Promise<Nullable<AnnotationRow>> {
    return USING_DB ? await DbStore.update(id, patch) : await InMemoryStore.update(id, patch);
  },

  async delete(id: string): Promise<boolean> {
    return USING_DB ? await DbStore.delete(id) : await InMemoryStore.delete(id);
  },

  async _reset(): Promise<void> {
    return USING_DB ? await DbStore._reset() : await InMemoryStore._reset();
  },
};

/* eslint-enable */
