import { describe, it, expect } from "vitest";
import { isPrivateAddress, requestPublicUrl } from "./request-public-url";

const request = (url: string) =>
  requestPublicUrl({ method: "GET", url, headers: {} });

describe("isPrivateAddress", () => {
  it.each([
    ["treats loopback 127.0.0.1 as private", "127.0.0.1"],
    ["treats RFC1918 10.0.0.0/8 as private", "10.1.2.3"],
    ["treats RFC1918 172.16.0.0/12 as private", "172.16.0.1"],
    ["treats RFC1918 192.168.0.0/16 as private", "192.168.1.1"],
    ["treats cloud metadata 169.254.169.254 as private", "169.254.169.254"],
    ["treats carrier-grade NAT 100.64.0.0/10 as private", "100.64.0.1"],
    ["treats the unspecified address 0.0.0.0 as private", "0.0.0.0"],
    ["treats IPv6 loopback ::1 as private", "::1"],
    ["treats IPv6 unique-local fc00::/7 as private", "fd00::1"],
    ["treats IPv6 link-local fe80::/10 as private", "fe80::1"],
    ["treats IPv4-compatible ::7f00:1 as private", "::7f00:1"],
    ["treats NAT64 64:ff9b::/96 as private", "64:ff9b::a9fe:a9fe"],
    ["treats IPv4-mapped loopback ::ffff:127.0.0.1 as private", "::ffff:127.0.0.1"],
    ["treats IPv4-mapped metadata in hex form as private", "::ffff:a9fe:a9fe"],
    ["treats unparseable input as private", "not-an-ip"],
  ])("%s", (_rule, ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    ["allows public IPv4 8.8.8.8", "8.8.8.8"],
    ["allows public IPv4 1.1.1.1", "1.1.1.1"],
    ["allows public IPv6 2606:4700::1111", "2606:4700::1111"],
    ["allows IPv4-mapped public ::ffff:8.8.8.8", "::ffff:8.8.8.8"],
  ])("%s", (_rule, ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("requestPublicUrl", () => {
  it.each([
    ["blocks an IPv4 loopback literal", "http://127.0.0.1:9/"],
    ["blocks an IPv6 loopback literal", "http://[::1]:9/"],
    ["blocks a numeric host that normalizes to loopback", "http://2130706433/"],
    ["blocks a hostname that resolves to loopback at connect time", "http://localhost:9/"],
  ])("%s", async (_rule, url) => {
    await expect(request(url)).rejects.toThrow(/blocked private address/);
  });

  it("rejects non-http schemes", async () => {
    await expect(request("file:///etc/passwd")).rejects.toThrow(
      /unsupported protocol/
    );
  });
});
