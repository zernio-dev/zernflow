// Prints a complete set of secrets for docker/.env, including the anon and
// service_role JWTs that must be signed with the same JWT_SECRET the Supabase
// services use.
//
//   node docker/generate-keys.mjs >> docker/.env
import crypto from "node:crypto";

const b64u = (b) => Buffer.from(b).toString("base64url");
const sign = (payload, secret) => {
  const header = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
};

const jwtSecret = crypto.randomBytes(32).toString("hex");
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 10 * 365 * 24 * 3600;

console.log(`JWT_SECRET=${jwtSecret}`);
console.log(`ANON_KEY=${sign({ role: "anon", iss: "supabase", iat, exp }, jwtSecret)}`);
console.log(`SERVICE_ROLE_KEY=${sign({ role: "service_role", iss: "supabase", iat, exp }, jwtSecret)}`);
console.log(`POSTGRES_PASSWORD=${crypto.randomBytes(16).toString("hex")}`);
console.log(`CRON_SECRET=${crypto.randomBytes(16).toString("hex")}`);
console.log(`REALTIME_SECRET_KEY_BASE=${crypto.randomBytes(32).toString("hex")}`);
console.log(`REALTIME_ENC_KEY=${crypto.randomBytes(8).toString("hex")}`); // must be exactly 16 chars
