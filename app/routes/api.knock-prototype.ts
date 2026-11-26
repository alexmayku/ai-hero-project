import { data } from "react-router";
import type { Route } from "./+types/api.knock-prototype";
import { getCurrentUserId } from "~/lib/session";
import { prototypeKnockAuth } from "~/lib/knock.prototype.server";
import { db } from "~/db";
import { users } from "~/db/schema";
import { eq } from "drizzle-orm";

export async function loader({ request }: Route.LoaderArgs) {
  if (!import.meta.env.DEV) throw new Response("Not found", { status: 404 });
  const userId = await getCurrentUserId(request);
  if (!userId || !db.select({ id: users.id }).from(users).where(eq(users.id, userId)).get()) {
    throw new Response("Select a user from the DevUI panel", { status: 401 });
  }
  return data(prototypeKnockAuth(userId), { headers: { "Cache-Control": "no-store" } });
}
