import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { setImmediate as yieldTurn } from 'node:timers/promises';
import { eventProse, dialogueRowOf } from './dialogue.js';

const VERSION = 2;

/** Derived prose only. No full session, tool result, replay state or credentials config. */
export class DialogueIndex {
  constructor(ctx, cacheDir, sourceTimeoutMs = 10000) {
    this.sourceTimeoutMs = sourceTimeoutMs;
    this.lifetime = new AbortController();
    this.ctx = ctx;
    this.cacheDir = cacheDir;
    this.entries = new Map();
    this.pending = null;
    this.generation = 0;
    this.completedGeneration = 0;
    this.stopped = false;
    this.progress = { indexed: 0, total: 0, failed: 0 };
    this.errors = [];
  }
  async sourceCall(operation) {
    const controller = new AbortController();
    const cancel = () => controller.abort(new Error('Index stopped'));
    this.lifetime.signal.addEventListener('abort', cancel, { once: true });
    let timer, aborted;
    try {
      const failure = new Promise((resolve, reject) => {
        aborted = () => reject(controller.signal.reason);
        controller.signal.addEventListener('abort', aborted, { once: true });
      });
      timer = setTimeout(() => controller.abort(new Error('Session storage timed out')), this.sourceTimeoutMs);
      if (this.lifetime.signal.aborted) cancel();
      return await Promise.race([failure, Promise.resolve().then(() => operation(controller.signal))]);
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', aborted);
      this.lifetime.signal.removeEventListener('abort', cancel);
    }
  }
  async readEvents(persistence, id, offset) {
    return this.sourceCall(async signal => {
      const handle = await persistence.open(id, 'read', { signal });
      try {
        signal.throwIfAborted();
        return (await handle.read(offset, Number.MAX_SAFE_INTEGER, { signal })).events;
      } finally { await handle.close(); }
    });
  }
  path(id) { return join(this.cacheDir, createHash('sha256').update(id).digest('hex') + '.json'); }
  async hydrate(id) {
    if (!this.cacheDir) return;
    try {
      const value = JSON.parse(await readFile(this.path(id), 'utf8'));
      if (value.version === VERSION && value.id === id && Array.isArray(value.rows) && Number.isInteger(value.count)) return value;
    } catch { /* A missing/corrupt derived cache is rebuilt from the authoritative source. */ }
  }
  async save(id, value) {
    if (!this.cacheDir || this.stopped) return;
    await mkdir(this.cacheDir, { recursive: true, mode: 0o700 });
    const path = this.path(id), temporary = path + '.tmp';
    await writeFile(temporary, JSON.stringify({ ...value, id, version: VERSION }), { mode: 0o600 });
    await rename(temporary, path);
  }
  refresh() {
    if (this.pending) return this.pending;
    if (this.stopped) return Promise.resolve();
    const generation = ++this.generation;
    this.pending = this.reconcile().then(() => { this.completedGeneration = generation; }).finally(() => { this.pending = null; });
    return this.pending;
  }
  async reconcile() {
    const persistence = this.ctx.get('sessionPersistence');
    const sessions = this.ctx.get('sessions');
    const live = new Map((sessions?.list() ?? []).map(s => [s.id, s]));
    if (!persistence && !sessions) throw new Error('Session storage is unavailable');
    const snapshots = persistence ? await this.sourceCall(signal => persistence.list({ signal })) : [];
    if (this.stopped) return;
    const sources = new Map(snapshots.map(s => [s.header.id, s]));
    for (const [id, session] of live) if (!sources.has(id)) sources.set(id, { header: session.header });
    for (const [id, source] of sources) if (source.header.origin === 'subagent') sources.delete(id);
    for (const id of this.entries.keys()) if (!sources.has(id)) {
      this.entries.delete(id);
      if (this.cacheDir) await unlink(this.path(id)).catch(() => {});
    }
    this.progress = { indexed: 0, total: sources.size, failed: 0 };
    this.errors = [];
    // Small logs first improves first-build progress, without omitting large logs.
    const ordered = [...sources].sort((a,b)=>(a[1].sizeBytes ?? 0)-(b[1].sizeBytes ?? 0));
    for (const [id, source] of ordered) {
      if (this.stopped) return;
      try {
        let previous = this.entries.get(id) ?? await this.hydrate(id);
        const session = live.get(id);
        const liveEvents = session?.snapshotEvents();
        const revision = session ? `live:${liveEvents.length}` : source.revision;
        if (previous && revision !== undefined && previous.revision === revision) {
          this.entries.set(id, previous);
        } else {
          // Durable logs are append-only, but a changed opaque revision with no
          // growth is rebuilt (migration, replacement, or restored backup).
          const count = liveEvents?.length ?? source.eventCount;
          const append = previous && Number.isInteger(count) && count > previous.count;
          const offset = append ? previous.count : 0;
          {
            const events = session ? liveEvents.slice(offset) : await this.readEvents(persistence, id, offset);
            const rows = append ? [...previous.rows] : [];
            for (let i=0; i<events.length; i++) {
              if (this.stopped) return;
              const prose = eventProse(events[i]);
              if (prose) {
                const row = dialogueRowOf(events[i]);
                if (row) rows.push({ ...row, prose });
              }
              if (i % 256 === 255) await yieldTurn();
            }
            const entry = { revision, count: offset + events.length, rows };
            if (this.stopped) return;
            this.entries.set(id, entry);
            // Cache I/O failure does not hide a successfully indexed session.
            await this.save(id, entry).catch(error => { this.cacheError = error.message; });
          }
        }
        this.progress.indexed++;
      } catch (error) {
        this.entries.delete(id); // Never show stale data after a source read fails.
        this.progress.failed++;
        this.errors.push({ sessionId: id, message: error.message });
      }
      await yieldTurn();
    }
  }
  async close() {
    this.stopped = true;
    this.lifetime.abort();
    await this.pending?.catch(() => {});
    this.entries.clear();
  }
}
