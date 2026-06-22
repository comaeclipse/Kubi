import { asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  channelLabels,
  labels,
  videoLabels,
} from "@/db/schema";

export type LabelKind = "category" | "tag";

export interface Label {
  id: number;
  slug: string;
  name: string;
  kind: LabelKind;
}

const VALID_KINDS = new Set<LabelKind>(["category", "tag"]);

export function isLabelKind(value: unknown): value is LabelKind {
  return typeof value === "string" && VALID_KINDS.has(value as LabelKind);
}

export function normalizeLabelSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function getAllLabels(): Promise<Label[]> {
  const rows = await db.select().from(labels).orderBy(asc(labels.kind), asc(labels.name));
  return rows as Label[];
}

export async function getChannelLabelMap(
  channelIds: number[]
): Promise<Map<number, Label[]>> {
  const result = new Map<number, Label[]>();
  if (channelIds.length === 0) return result;

  const rows = await db
    .select({
      channelId: channelLabels.channelId,
      id: labels.id,
      slug: labels.slug,
      name: labels.name,
      kind: labels.kind,
    })
    .from(channelLabels)
    .innerJoin(labels, eq(channelLabels.labelId, labels.id))
    .where(inArray(channelLabels.channelId, channelIds))
    .orderBy(asc(labels.kind), asc(labels.name));

  for (const row of rows) {
    const assigned = result.get(row.channelId) ?? [];
    assigned.push({
      id: row.id,
      slug: row.slug,
      name: row.name,
      kind: row.kind as LabelKind,
    });
    result.set(row.channelId, assigned);
  }
  return result;
}

export async function getVideoLabelMap(
  videoIds: number[]
): Promise<Map<number, Label[]>> {
  const result = new Map<number, Label[]>();
  if (videoIds.length === 0) return result;

  const rows = await db
    .select({
      videoId: videoLabels.videoId,
      id: labels.id,
      slug: labels.slug,
      name: labels.name,
      kind: labels.kind,
    })
    .from(videoLabels)
    .innerJoin(labels, eq(videoLabels.labelId, labels.id))
    .where(inArray(videoLabels.videoId, videoIds))
    .orderBy(asc(labels.kind), asc(labels.name));

  for (const row of rows) {
    const assigned = result.get(row.videoId) ?? [];
    assigned.push({
      id: row.id,
      slug: row.slug,
      name: row.name,
      kind: row.kind as LabelKind,
    });
    result.set(row.videoId, assigned);
  }
  return result;
}
