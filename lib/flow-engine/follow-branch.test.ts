import { describe, expect, it } from "vitest";
import { clampMaxChecks, decideFollowBranch, followCheckVariable } from "./follow-branch";

describe("decideFollowBranch", () => {
  it("lets a confirmed follower through without counting a miss", () => {
    expect(decideFollowBranch(true, 0, 3)).toEqual({ branch: "followed", misses: 0 });
    expect(decideFollowBranch(true, 2, 3)).toEqual({ branch: "followed", misses: 2 });
  });

  it("treats not following and unknown the same: ask again", () => {
    expect(decideFollowBranch(false, 0, 3)).toEqual({ branch: "notFollowed", misses: 1 });
    expect(decideFollowBranch(null, 0, 3)).toEqual({ branch: "notFollowed", misses: 1 });
    expect(decideFollowBranch(undefined, 1, 3)).toEqual({ branch: "notFollowed", misses: 2 });
  });

  it("gives up on the last allowed miss", () => {
    expect(decideFollowBranch(false, 2, 3)).toEqual({ branch: "gaveUp", misses: 3 });
    expect(decideFollowBranch(null, 0, 1)).toEqual({ branch: "gaveUp", misses: 1 });
  });

  it("still lets someone through who follows on the very last try", () => {
    expect(decideFollowBranch(true, 2, 3).branch).toBe("followed");
  });
});

describe("clampMaxChecks", () => {
  it("defaults bad input to 3 and caps at 10", () => {
    expect(clampMaxChecks(undefined)).toBe(3);
    expect(clampMaxChecks("abc")).toBe(3);
    expect(clampMaxChecks(0)).toBe(3);
    expect(clampMaxChecks(5)).toBe(5);
    expect(clampMaxChecks(99)).toBe(10);
  });
});

describe("followCheckVariable", () => {
  it("is per node, so two follow checks keep separate counts", () => {
    expect(followCheckVariable("a")).not.toBe(followCheckVariable("b"));
  });
});
