import { describe, expect, it } from "vitest";
import { toPickerPosts } from "./instagram-posts";

describe("toPickerPosts", () => {
  it("keeps the id the webhook uses and fills missing fields", () => {
    expect(toPickerPosts([{ id: "123", content: " Spiti  ", commentCount: 4 }])).toEqual([
      { id: "123", caption: "Spiti", picture: null, permalink: null, commentCount: 4, createdTime: null, account: null },
    ]);
  });

  it("drops entries without an id", () => {
    expect(toPickerPosts([{ content: "no id" }, { id: "" }, { id: "9" }]).map((p) => p.id)).toEqual(["9"]);
  });
});
