import { describe, expect, it } from "vitest";
import { handleMatches } from "./branch-handle";

describe("handleMatches", () => {
  it("matches the builder's yes/no against the engine's true/false", () => {
    expect(handleMatches("yes", "true")).toBe(true);
    expect(handleMatches("no", "false")).toBe(true);
    expect(handleMatches("true", "yes")).toBe(true);
  });

  it("keeps the two branches apart", () => {
    expect(handleMatches("yes", "false")).toBe(false);
    expect(handleMatches("no", "true")).toBe(false);
  });

  it("matches named handles exactly (A/B split paths)", () => {
    expect(handleMatches("Variant A", "Variant A")).toBe(true);
    expect(handleMatches("Variant A", "Variant B")).toBe(false);
  });

  it("never matches an edge with no handle", () => {
    expect(handleMatches(undefined, "true")).toBe(false);
    expect(handleMatches(null, "no")).toBe(false);
  });
});
