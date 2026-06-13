"use client";

import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase/client";
import { enqueue, dequeue, listQueue, getBlob, deleteBlob } from "./queue";
import type { OutboxItem } from "@/lib/schemas";

/**
 * Sync worker (§8): replays the IndexedDB outbox to Supabase whenever the
 * network is available. Triggered by the `online` event and a 10s interval.
 * Idempotence is guaranteed server-side (UNIQUE on messages.client_id);
 * a unique-violation on replay means "already delivered" → success.
 */

type SyncEvents = {
  /** fired once per item successfully delivered (drives the cascade badges) */
  synced: (item: OutboxItem) => void;
  /** fired whenever the queue size changes */
  pending: (count: number) => void;
  /** network status transitions */
  online: (isOnline: boolean) => void;
};

const UNIQUE_VIOLATION = "23505";

class SyncManager {
  private listeners: { [K in keyof SyncEvents]: Set<SyncEvents[K]> } = {
    synced: new Set(),
    pending: new Set(),
    online: new Set(),
  };
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private started = false;

  start(): void {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    window.addEventListener("online", () => {
      this.emitOnline(true);
      void this.flush();
    });
    window.addEventListener("offline", () => this.emitOnline(false));
    this.timer = setInterval(() => void this.flush(), 10_000);
    void this.refreshPending();
    void this.flush();
  }

  on<K extends keyof SyncEvents>(event: K, fn: SyncEvents[K]): () => void {
    this.listeners[event].add(fn);
    return () => {
      this.listeners[event].delete(fn);
    };
  }

  private emitOnline(value: boolean): void {
    this.listeners.online.forEach((fn) => fn(value));
  }

  async refreshPending(): Promise<number> {
    const queue = await listQueue();
    this.listeners.pending.forEach((fn) => fn(queue.length));
    return queue.length;
  }

  /** Queue an item and attempt immediate delivery. */
  async submit(item: OutboxItem): Promise<void> {
    await enqueue(item);
    await this.refreshPending();
    void this.flush();
  }

  async flush(): Promise<void> {
    if (this.running) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (!isSupabaseConfigured()) return;
    this.running = true;
    try {
      const queue = await listQueue();
      for (const item of queue) {
        const delivered = await this.deliver(item);
        if (!delivered) break; // network is down again - stop, retry later
        await dequeue(item.id);
        this.listeners.synced.forEach((fn) => fn(item));
        await this.refreshPending();
        // 120ms stagger so the resync cascade is visible (§2.5 moment 4)
        await new Promise((r) => setTimeout(r, 120));
      }
    } finally {
      this.running = false;
    }
  }

  private async deliver(item: OutboxItem): Promise<boolean> {
    const supabase = getSupabaseBrowser();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    if (item.kind === "message") {
      const { error } = await supabase.from("messages").insert({
        ...item.payload,
        user_id: user.id,
        ...(item.team_id ? { team_id: item.team_id } : {}),
      });
      if (!error || error.code === UNIQUE_VIOLATION) return true;
      return false;
    }

    // detection: upload the queued image first (if any), then insert the row
    let imagePath: string | null = item.payload.image_url;
    if (item.image_key) {
      const blob = await getBlob(item.image_key);
      if (blob) {
        const path = `${user.id}/${item.id}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("detections")
          .upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (uploadError) return false;
        imagePath = path;
        await deleteBlob(item.image_key);
      }
    }
    const { error } = await supabase.from("detections").insert({
      ...item.payload,
      image_url: imagePath,
      user_id: user.id,
      ...(item.team_id ? { team_id: item.team_id } : {}),
    });
    if (!error) return true;
    return false;
  }
}

export const syncManager = new SyncManager();
