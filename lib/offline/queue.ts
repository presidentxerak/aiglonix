"use client";

import { get, set, del, keys, createStore } from "idb-keyval";
import { OutboxItemSchema, type OutboxItem } from "@/lib/schemas";

/**
 * Outbox pattern (§8): every offline write lands here first, immediately,
 * with a client-generated UUID. The sync worker replays it when the network
 * is back; the UNIQUE constraint on client_id in Postgres makes replays
 * idempotent.
 */

const store = createStore("aiglonix", "outbox");
const blobStore = createStore("aiglonix-blobs", "images");

const ITEM_PREFIX = "item:";

export async function enqueue(item: OutboxItem): Promise<void> {
  await set(ITEM_PREFIX + item.id, item, store);
}

export async function dequeue(id: string): Promise<void> {
  await del(ITEM_PREFIX + id, store);
}

export async function listQueue(): Promise<OutboxItem[]> {
  const allKeys = await keys(store);
  const items: OutboxItem[] = [];
  for (const key of allKeys) {
    if (typeof key !== "string" || !key.startsWith(ITEM_PREFIX)) continue;
    const raw: unknown = await get(key, store);
    const parsed = OutboxItemSchema.safeParse(raw);
    if (parsed.success) {
      items.push(parsed.data);
    } else {
      // Corrupted entry - drop it rather than poisoning the sync loop.
      await del(key, store);
    }
  }
  return items.sort((a, b) => a.queued_at.localeCompare(b.queued_at));
}

export async function saveBlob(key: string, blob: Blob): Promise<void> {
  await set(key, blob, blobStore);
}

export async function getBlob(key: string): Promise<Blob | null> {
  const value: unknown = await get(key, blobStore);
  return value instanceof Blob ? value : null;
}

export async function deleteBlob(key: string): Promise<void> {
  await del(key, blobStore);
}
