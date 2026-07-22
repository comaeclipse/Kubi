import { or, isNull, eq, sql, type SQL } from "drizzle-orm";
import { channels, userChannels } from "@/db/schema";

// A channel is visible to a user when it's in the master library
// (ownerUserId IS NULL), privately owned by that user, or already enabled for
// that account.
//
// That last clause is what lets one real YouTube channel exist as exactly one
// row with one ingestion. The first household to add a channel owns the row;
// when a second household finds the same channel through search, they don't
// re-import it — they get their own `user_channels` enablement of the existing
// row, and this predicate then admits it. Ownership only decides whether the
// channel appears in the shared "Popular channels" library, never whether its
// videos get stored twice.
//
// Private channels still never leak: an account that has not enabled a channel
// (and doesn't own it) cannot see it, so operators and other households are
// unaffected.
export function visibleChannel(userId: number): SQL {
  return or(
    isNull(channels.ownerUserId),
    eq(channels.ownerUserId, userId),
    sql`EXISTS (SELECT 1 FROM ${userChannels} WHERE ${userChannels.channelId} = ${channels.id} AND ${userChannels.userId} = ${userId})`
  )!;
}
