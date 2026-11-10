import { BlockList, isIP, type LookupFunction } from "node:net";
import { lookup } from "node:dns";
import http from "node:http";
import https from "node:https";

const blockList = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockList.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockList.addSubnet(network, prefix, "ipv6");
}

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 0) return true;
  // BlockList also matches IPv4-mapped IPv6 (::ffff:a.b.c.d) against the v4 ranges.
  return blockList.check(ip, version === 4 ? "ipv4" : "ipv6");
}

// Checking at connect time defeats DNS rebinding.
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const blocked = addresses.find(({ address }) => isPrivateAddress(address));
    if (blocked) {
      return callback(
        new Error(`blocked private address ${blocked.address} for ${hostname}`),
        "",
        0
      );
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

export async function requestPublicUrl({
  method,
  url,
  headers,
  body,
}: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}): Promise<string> {
  const target = new URL(url);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error(`unsupported protocol ${target.protocol}`);
  }

  const host = target.hostname.replace(/^\[|\]$/g, "");
  // IP-literal hosts skip the lookup hook, so they are checked here.
  if (isIP(host) && isPrivateAddress(host)) {
    throw new Error(`blocked private address ${host}`);
  }

  const transport = target.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = transport.request(
      target,
      {
        method,
        headers,
        lookup: publicOnlyLookup,
        signal: AbortSignal.timeout(10_000),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.end(body);
  });
}
