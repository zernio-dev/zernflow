import { describe, expect, it } from "vitest";
import { toActivity } from "./comment-activity";

const log = (over = {}) => ({
  id: "l1",
  channel_id: "ch",
  author_id: "ig1",
  author_name: "Priti",
  author_username: "priti.explores",
  comment_text: "trip",
  dm_sent: true,
  reply_sent: false,
  error: null,
  created_at: "2026-11-21T10:00:00Z",
  ...over,
});

describe("toActivity", () => {
  it("links a commenter to their inbox conversation", () => {
    const [item] = toActivity(
      [log()],
      [{ channel_id: "ch", platform_sender_id: "ig1", contact_id: "k1" }],
      [{ id: "conv1", channel_id: "ch", contact_id: "k1" }]
    );
    expect(item).toMatchObject({ who: "@priti.explores", conversationId: "conv1", dmSent: true });
  });

  it("does not cross channels", () => {
    const [item] = toActivity(
      [log()],
      [{ channel_id: "other", platform_sender_id: "ig1", contact_id: "k1" }],
      [{ id: "conv1", channel_id: "other", contact_id: "k1" }]
    );
    expect(item.conversationId).toBeNull();
  });

  it("falls back to the display name, then to Someone", () => {
    expect(toActivity([log({ author_username: null })], [], [])[0].who).toBe("Priti");
    expect(toActivity([log({ author_username: null, author_name: null, author_id: null })], [], [])[0].who).toBe("Someone");
  });
});
