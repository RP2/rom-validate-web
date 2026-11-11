// Verifies the IndexedDB DAT cache and legacy localStorage migration using
// the real datLoader module against a minimal in-memory IndexedDB shim.
import assert from "node:assert/strict";

const CMP_DAT = `clrmamepro (
 name "Test"
)
game (
 name "Test Game (USA)"
 rom ( name "Test Game (USA).nds" size 4 md5 abc sha1 def crc 12345678 )
)
`;

// --- minimal IndexedDB shim ------------------------------------------------
const stores = new Map<string, Map<string, unknown>>();

class FakeTransaction {
  private pending = 1;
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor(private data: Map<string, unknown>) {}

  private finish() {
    this.pending--;
    if (this.pending === 0) queueMicrotask(() => this.oncomplete?.());
  }

  objectStore() {
    const tx = this;
    return {
      get(key: string) {
        const request: any = {};
        queueMicrotask(() => {
          request.result = tx.data.get(key);
          request.onsuccess?.();
          tx.finish();
        });
        return request;
      },
      put(value: { key: string }) {
        const request: any = {};
        queueMicrotask(() => {
          tx.data.set(value.key, value);
          request.result = value.key;
          request.onsuccess?.();
          tx.finish();
        });
        return request;
      },
      delete(key: string) {
        const request: any = {};
        queueMicrotask(() => {
          tx.data.delete(key);
          request.result = undefined;
          request.onsuccess?.();
          tx.finish();
        });
        return request;
      },
      clear() {
        const request: any = {};
        queueMicrotask(() => {
          tx.data.clear();
          request.result = undefined;
          request.onsuccess?.();
          tx.finish();
        });
        return request;
      },
      getAll() {
        const request: any = {};
        queueMicrotask(() => {
          request.result = [...tx.data.values()];
          request.onsuccess?.();
          tx.finish();
        });
        return request;
      },
    };
  }
}

const fakeIndexedDB = {
  open() {
    const request: any = { result: null };
    queueMicrotask(() => {
      const db = {
        objectStoreNames: { contains: (name: string) => stores.has(name) },
        createObjectStore(name: string) {
          stores.set(name, new Map());
        },
        transaction(name: string) {
          return new FakeTransaction(stores.get(name)!);
        },
        close() {},
        onversionchange: null as (() => void) | null,
      };
      request.result = db;
      request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  },
};

(globalThis as any).indexedDB = fakeIndexedDB;

// --- localStorage shim -----------------------------------------------------
const legacyData = new Map<string, string>();
(globalThis as any).localStorage = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "getItem") return (key: string) => legacyData.get(key) ?? null;
      if (prop === "setItem")
        return (key: string, value: string) => legacyData.set(key, value);
      if (prop === "removeItem") return (key: string) => legacyData.delete(key);
      if (prop === "length") return legacyData.size;
      if (typeof prop === "string") return legacyData.get(prop);
      return undefined;
    },
    set(_target, prop, value) {
      legacyData.set(String(prop), String(value));
      return true;
    },
    deleteProperty(_target, prop) {
      legacyData.delete(String(prop));
      return true;
    },
    ownKeys() {
      return [...legacyData.keys()];
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (!legacyData.has(String(prop))) return undefined;
      return {
        enumerable: true,
        configurable: true,
        value: legacyData.get(String(prop)),
      };
    },
  },
);

// --- fetch shim ------------------------------------------------------------
let fetchCount = 0;
(globalThis as any).fetch = async () => {
  fetchCount++;
  return { ok: true, status: 200, statusText: "OK", text: async () => CMP_DAT };
};

const base = new URL("../src/utils/datLoader.ts", import.meta.url).href;

let passed = 0;
function check(condition: boolean, name: string) {
  assert.ok(condition, name);
  passed++;
  console.log(`ok ${name}`);
}

// A. Fresh load fetches and writes IndexedDB.
{
  const loader = await import(`${base}?run=a`);
  const entries = await loader.loadBundledDAT("Nintendo DS Encrypted (Bundled)");
  check(entries.length === 1, "bundled load parses CMP entries");
  check(fetchCount === 1, "bundled load fetched once");
  check(stores.get("dat-cache")?.size === 1, "bundled load wrote one IDB record");
}

// B. New module instance reads the same record without fetching.
{
  const loader = await import(`${base}?run=b`);
  const entries = await loader.loadBundledDAT("Nintendo DS Encrypted (Bundled)");
  check(entries.length === 1, "second module reads persisted entries");
  check(fetchCount === 1, "second module did not refetch");
  const listed = await loader.getCachedDATs();
  check(
    listed.some((d: any) => d.source === "bundled" && d.entryCount === 1),
    "cache listing shows persisted bundled DAT",
  );
}

// C. Legacy localStorage entry migrates without a fetch.
{
  const legacyKey = "dat-cache-libretro-Game Boy";
  legacyData.set(
    legacyKey,
    JSON.stringify({
      entries: [{ name: "Legacy (USA).gb", size: 4, md5: "abc" }],
      timestamp: Date.now(),
      version: "1.0",
    }),
  );

  const loader = await import(`${base}?run=c`);
  const entries = await loader.loadLibretroDAT("Game Boy");
  check(entries.length === 1, "legacy entry loaded without fetch");
  check(fetchCount === 1, "legacy migration did not fetch");
  check(!legacyData.has(legacyKey), "legacy key removed after successful put");
  check(
    stores.get("dat-cache")?.has("dat-cache-libretro-Game Boy") === true,
    "legacy entry written to IndexedDB",
  );

  const listed = await loader.getCachedDATs();
  check(
    listed.some((d: any) => d.source === "libretro" && d.platform === "Game Boy"),
    "cache listing shows migrated entry",
  );
}

// D. clearDATCache removes IndexedDB records and legacy keys.
{
  const loader = await import(`${base}?run=d`);
  legacyData.set("dat-cache-old-junk", "{}");
  await loader.clearDATCache();
  check(stores.get("dat-cache")?.size === 0, "clear empties IndexedDB store");
  check(legacyData.size === 0, "clear removes legacy keys");
}

console.log(`\n${passed} checks passed`);
