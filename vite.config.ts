import { createMpaPlugin, createPages } from "vite-plugin-virtual-mpa";
import { defineConfig, loadEnv } from "vite";
import type { Plugin, ViteDevServer } from "vite";
import { readFileSync, readdirSync, statSync } from "fs";
import type { IncomingMessage, ServerResponse } from "http";
import path from "path";

const pages = createPages([
  {
    name: "botw",
    filename: "botw/index.html",
    entry: "/src/botw.ts",
    data: {
      title: "Breath of the Wild Interactive Map",
      description:
        "Interactive, searchable map of Hyrule with locations, descriptions, guides, and more.",
    },
  },
  {
    name: "la",
    filename: "la/index.html",
    entry: "/src/la.ts",
    data: {
      title: "Link's Awakening Interactive Map (Nintendo Switch)",
      description:
        "Interactive, searchable map of Koholint with locations, descriptions, guides, and more.",
    },
  },
  {
    name: "totk",
    filename: "totk/index.html",
    entry: "/src/totk.ts",
    data: {
      title: "Tears of the Kingdom Interactive Map",
      description:
        "Interactive, searchable map of Hyrule with locations, descriptions, guides, and more.",
    },
  },
  {
    name: "eow",
    filename: "eow/index.html",
    entry: "/src/eow.ts",
    data: {
      title: "Echoes of Wisdom Interactive Map",
      description:
        "Interactive, searchable map of Hyrule with locations, descriptions, guides, and more.",
    },
  },
  {
    name: "ss",
    filename: "ss/index.html",
    entry: "/src/ss.ts",
    data: {
      title: "Skyward Sword Interactive Map",
      description:
        "Interactive, searchable map of Hyrule with locations, descriptions, guides, and more.",
    },
  },
]);

/**
 * Dev-server-only endpoint that mirrors a BotW save file onto the map.
 * Set BOTW_SAVE_DIR to the directory that holds your save slots (the one
 * containing numbered folders like 0, 1, 2 … with a game_data.sav each,
 * e.g. ~/.local/state/savagewind/save/save_0). The newest slot by mtime is
 * read, every request is served fresh from disk (no caching), and nothing is
 * ever written to the save.
 */
function botwSaveStatePlugin(saveDir: string): Plugin {
  // Derived save-flag hash -> map marker id table (see tools/save-sync.md)
  const parsed = JSON.parse(
    readFileSync(path.resolve(__dirname, "tools/savesync-data.json"), "utf8")
  ) as Record<string, Record<string, string>>;

  const lookup = new Map<number, { category: string; markerId: string }>();
  const categoryIds: Record<string, string[]> = {};
  for (const category of Object.keys(parsed)) {
    if (category === "_comment") continue;
    const table = parsed[category];
    categoryIds[category] = Object.values(table);
    for (const [hash, markerId] of Object.entries(table)) {
      lookup.set(Number(hash), { category, markerId });
    }
  }

  const resolvedSaveDir = saveDir.replace(
    /^~(?=$|\/)/,
    process.env.HOME ?? "~"
  );

  function newestSlot():
    | { file: string; slot: string; mtimeMs: number }
    | null {
    if (!resolvedSaveDir) return null;
    let entries;
    try {
      entries = readdirSync(resolvedSaveDir, { withFileTypes: true });
    } catch {
      return null;
    }
    let best: { file: string; slot: string; mtimeMs: number } | null = null;
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
      const file = path.join(resolvedSaveDir, entry.name, "game_data.sav");
      try {
        const st = statSync(file);
        if (!best || st.mtimeMs > best.mtimeMs) {
          best = { file, slot: entry.name, mtimeMs: st.mtimeMs };
        }
      } catch {
        // slot without a game_data.sav
      }
    }
    return best;
  }

  function scan(buf: Buffer) {
    const found: Record<string, Set<string>> = {};
    for (const category of Object.keys(categoryIds)) found[category] = new Set();
    let matched = 0;
    for (let off = 0x0c; off + 8 <= buf.length; off += 8) {
      const entry = lookup.get(buf.readUInt32LE(off));
      if (entry) {
        matched++;
        if (buf.readUInt32LE(off + 4) !== 0) {
          found[entry.category].add(entry.markerId);
        }
      }
    }
    return { found, matched };
  }

  function sendJson(res: ServerResponse, status: number, body: unknown): void {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(body));
  }

  function handle(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Use GET." });
      return;
    }
    if (!resolvedSaveDir) {
      sendJson(res, 200, {
        ok: false,
        error:
          "BOTW_SAVE_DIR is not set. Set it to your save's numbered-slot directory.",
      });
      return;
    }
    const target = newestSlot();
    if (!target) {
      sendJson(res, 200, {
        ok: false,
        error: `No numbered slot with game_data.sav found under ${resolvedSaveDir}`,
      });
      return;
    }
    let buf: Buffer;
    try {
      buf = readFileSync(target.file);
    } catch (ex) {
      sendJson(res, 200, {
        ok: false,
        error: `Could not read ${target.file}: ${String(ex)}`,
      });
      return;
    }
    const { found, matched } = scan(buf);
    // A complete save contains every known flag record exactly once
    if (matched < lookup.size / 2) {
      sendJson(res, 200, {
        ok: false,
        error:
          "Save file looks incomplete (possibly mid-write). Try again once the save has finished.",
      });
      return;
    }
    const categories: Record<string, { all: string[]; found: string[] }> = {};
    for (const category of Object.keys(categoryIds)) {
      categories[category] = {
        all: categoryIds[category],
        found: [...found[category]],
      };
    }
    sendJson(res, 200, {
      ok: true,
      slot: target.slot,
      mtime: new Date(target.mtimeMs).toISOString(),
      matchedRecords: matched,
      categories,
    });
  }

  return {
    name: "botw-save-state",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/save-state", handle);
    },
  };
}

// tslint:disable-next-line:no-default-export vite convention
export default defineConfig(({ command, mode, ssrBuild }) => {
  const localEnv = loadEnv(mode, __dirname, "");
  const saveDir = process.env.BOTW_SAVE_DIR ?? localEnv.BOTW_SAVE_DIR ?? "";
  return {
    base: mode === "production" ? "/maps/" : "/maps-beta/",
    plugins: [
      createMpaPlugin({
        template: "src/template.html",
        pages,
      }),
      botwSaveStatePlugin(saveDir),
    ],
    resolve: {
      alias: {
        "@fonts": path.resolve(__dirname, "src", "fonts"),
      },
    },
  };
});
