// Throwaway development-only authentication for the Notification Feed prototype.
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { sign } from "node:crypto";

export function prototypeKnockAuth(userId: number) {
  const env = parseEnv(readFileSync(".env", "utf8"));
  if (!env.KNOCK_SIGNING_KEY || !env.KNOCK_PUBLIC_API_KEY || !env.KNOCK_FEED_CHANNEL_ID) throw new Error("Knock prototype configuration is incomplete");
  const recipient = `cadence-prototype-${userId}`;
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = encode({ alg: "RS256", typ: "JWT" }) + "." + encode({
    sub: recipient, iat: now, exp: now + 300,
    explicit_grants: true,
    grants: { [`https://api.knock.app/v1/users/${recipient}`]: { "user/feed_read": [{}], "user/feed_write": [{}] } },
  });
  const key = Buffer.from(env.KNOCK_SIGNING_KEY, "base64").toString("utf8");
  return {
    recipient,
    publicKey: env.KNOCK_PUBLIC_API_KEY,
    channelId: env.KNOCK_FEED_CHANNEL_ID,
    token: payload + "." + sign("RSA-SHA256", Buffer.from(payload), key).toString("base64url"),
  };
}
