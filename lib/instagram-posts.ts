/** A post or reel on a connected Instagram account, as the reel picker shows it. */
export interface PickerPost {
  /** The id the comment webhook reports, so it can be used directly as a trigger's postIds entry. */
  id: string;
  caption: string;
  picture: string | null;
  permalink: string | null;
  commentCount: number;
  createdTime: string | null;
  account: string | null;
}

interface ZernioInboxPost {
  id?: string;
  content?: string;
  picture?: string | null;
  permalink?: string | null;
  commentCount?: number;
  createdTime?: string;
  accountUsername?: string;
}

export function toPickerPosts(posts: ZernioInboxPost[]): PickerPost[] {
  return posts
    .filter((p): p is ZernioInboxPost & { id: string } => typeof p.id === "string" && p.id.length > 0)
    .map((p) => ({
      id: p.id,
      caption: (p.content ?? "").trim(),
      picture: p.picture ?? null,
      permalink: p.permalink ?? null,
      commentCount: p.commentCount ?? 0,
      createdTime: p.createdTime ?? null,
      account: p.accountUsername ?? null,
    }));
}
