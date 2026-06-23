import { or, isNull, eq, type SQL } from "drizzle-orm";
import { channels } from "@/db/schema";

// A channel is visible to a user when it's in the master library
// (ownerUserId IS NULL) or privately owned by that user. Private channels must
// never leak to operators or other accounts, so this predicate is applied to
// every place channels (or their videos) are listed or enabled.
export function visibleChannel(userId: number): SQL {
  return or(isNull(channels.ownerUserId), eq(channels.ownerUserId, userId))!;
}
