import { LocalStorage } from "./LocalStorage";
import { ZDMap } from "./ZDMap";

interface SaveStateCategory {
  all: string[];
  found: string[];
}

interface SaveStateResponse {
  ok: boolean;
  error?: string;
  slot?: string;
  mtime?: string;
  matchedRecords?: number;
  categories?: Record<string, SaveStateCategory>;
}

/**
 * Dev-server-side mirror of the locally running BotW save file.
 * The map acts as a read-only view of the save: on page load and whenever
 * the tab regains visibility/focus, `/save-state` (served by vite.config.ts)
 * is queried and the completion state of all save-synced categories is set
 * to exactly what the save reports. Any manual ticks in those categories are
 * discarded (the save is the single source of truth).
 */
export class SaveSync {
  private storage: LocalStorage;
  private lastSyncAt = 0;
  private lastCompletedCount = -1;

  public constructor(private map: ZDMap) {
    this.storage = LocalStorage.getStore("botw", "completion");
  }

  public attach(): void {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        void this.sync();
      }
    });
    window.addEventListener("focus", () => void this.sync());
  }

  public async sync(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSyncAt < 2000) {
      return;
    }
    this.lastSyncAt = now;

    let data: SaveStateResponse;
    try {
      const response = await fetch("/save-state", { cache: "no-store" });
      data = await response.json();
    } catch (ex) {
      console.info(
        "Save sync unavailable (only works with the dev server and a reachable save directory).",
        ex
      );
      return;
    }

    if (!data.ok || !data.categories) {
      console.warn("Save sync skipped:", data.error ?? "unknown error");
      return;
    }

    let completedCount = 0;
    for (const category of Object.values(data.categories)) {
      const found = new Set(category.found);
      for (const id of category.all) {
        this.storage.setItem(id, found.has(id));
        if (found.has(id)) {
          completedCount++;
        }
      }
    }

    this.map.applySaveCompletion(data.categories);

    console.info(
      `Save sync: ${completedCount} item(s) completed (slot ${data.slot}).`
    );
    if (
      this.lastCompletedCount !== -1 &&
      completedCount !== this.lastCompletedCount
    ) {
      this.map.showNotification(
        `Save synced (slot ${data.slot}): ${completedCount} item(s) completed.`
      );
    }
    this.lastCompletedCount = completedCount;
  }
}

/** Attach save sync and run it once immediately (page load). */
export function attachSaveSync(map: ZDMap): void {
  const sync = new SaveSync(map);
  sync.attach();
  void sync.sync();
}
