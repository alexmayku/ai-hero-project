// Throwaway live Knock drawer. Isolated development recipients; never production auth.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Bell, X } from "lucide-react";

type Auth = { recipient: string; publicKey: string; channelId: string; token: string };
type Item = { id: string; read_at: string | null; seen_at: string | null; inserted_at: string; data: { title?: string; body?: string; url?: string }; blocks?: { type: string; rendered?: string; content?: string }[] };
type Feed = { entries: Item[]; meta: { unread_count: number; unseen_count: number }; page_info?: { after: string | null } };

export function LiveNotificationFeedPrototype({ userId }: { userId: number | null }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const navigate = useNavigate();
  const auth = useRef<Auth | null>(null);
  const getAuth = async () => {
    // Fresh short-lived token on each action avoids stale expiry during review.
    const response = await fetch("/api/knock-prototype", { cache: "no-store" });
    if (!response.ok) throw new Error(response.status === 401 ? "Select a user in DevUI." : "Could not authenticate the feed.");
    const next: Auth = await response.json();
    if (next.recipient !== `cadence-prototype-${userId}`) throw new Error("User changed. Reload this preview.");
    auth.current = next;
    return next;
  };
  const knock = async (credentials: Auth, path: string, body?: unknown) => {
    const response = await fetch(`https://api.knock.app/v1${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${credentials.publicKey}`, "X-Knock-User-Token": credentials.token, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`Knock returned ${response.status}.`);
    return response.json();
  };
  const refresh = async () => {
    try {
      const credentials = await getAuth();
      if (!mounted.current) return;
      const next = await knock(credentials, `/users/${credentials.recipient}/feeds/${credentials.channelId}`);
      if (mounted.current) { setFeed(next); setError(""); }
    } catch (e) { if (mounted.current) setError((e as Error).message); }
  };
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; auth.current = null; };
  }, []);
  const mutate = async (status: "read" | "unread" | "seen", ids: string[]) => {
    if (!ids.length) return true;
    setBusy(true);
    try {
      const credentials = await getAuth();
      if (!mounted.current) return false;
      await knock(credentials, `/messages/batch/${status}`, { message_ids: ids });
      await refresh();
      return mounted.current;
    } catch (e) { if (mounted.current) setError((e as Error).message); return false; }
    finally { if (mounted.current) setBusy(false); }
  };
  const items = (feed?.entries ?? []).filter(item => !onlyUnread || !item.read_at);
  useEffect(() => {
    if (open && !busy) {
      const unseen = items.filter(item => !item.seen_at).map(item => item.id);
      if (unseen.length && !error) void mutate("seen", unseen);
    }
  }, [open, feed, onlyUnread]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  return <>
    <div className="m-4 rounded border border-amber-400 bg-amber-50 p-3 text-xs text-amber-950">
      <strong>Prototype B · live Knock development feed</strong>
      <p>Isolated test recipient: {userId ? `cadence-prototype-${userId}` : "select a user"}. Read/seen changes are saved in Knock.</p>
      <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify({ unread: feed?.meta.unread_count, unseen: feed?.meta.unseen_count, loaded: feed?.entries.length, open, selectedUser: userId }, null, 2)}</pre>
      <button className="mt-2 underline" onClick={() => void refresh()}>Refresh feed</button>
      {error && <p role="alert">{error}</p>}
    </div>
    <div className="mx-4 flex justify-end"><button className="flex items-center gap-2 rounded-full border px-4 py-2" aria-expanded={open} aria-label={`Notifications, ${feed?.meta.unread_count ?? 0} unread`} onClick={() => setOpen(!open)}><Bell size={18} />{feed?.meta.unread_count ?? 0}</button></div>
    {open && <aside aria-label="Notification Feed" className="fixed right-0 top-0 z-30 h-screen w-[min(440px,90vw)] overflow-y-auto border-l bg-background p-4 shadow-2xl">
      <header className="flex items-center justify-between border-b pb-4"><h2 className="text-lg font-semibold">Notifications</h2><button aria-label="Close notifications" onClick={() => setOpen(false)}><X size={20} /></button></header>
      <div className="flex justify-between py-4 text-sm"><button onClick={() => setOnlyUnread(!onlyUnread)}>{onlyUnread ? "Show all" : "Show unread"}</button><button disabled={busy} onClick={() => void mutate("read", (feed?.entries ?? []).filter(i => !i.read_at).map(i => i.id))}>Mark loaded read</button></div>
      {!feed ? <p>Loading feed…</p> : items.length === 0 ? <p className="py-8 text-center text-muted-foreground">{onlyUnread ? "You’re all caught up." : "No notifications yet."}</p> : <ul>{items.map(item => <li key={item.id} className={`border-b p-4 ${item.read_at ? "" : "bg-primary/5"}`}>
        <button disabled={busy} className="w-full text-left" onClick={async () => {
          const url = item.data.url;
          if (await mutate("read", [item.id])) {
            if (url?.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) { setOpen(false); navigate(url); }
          }
        }}><span className="block font-semibold">{!item.read_at && "● "}{item.data.title ?? "Notification"}</span><span className="block text-sm">{item.data.body ?? "Open the relevant course for details."}</span><span className="mt-2 block text-xs text-muted-foreground">{new Date(item.inserted_at).toLocaleString()}</span></button>
        <button disabled={busy} className="mt-2 text-xs underline" onClick={() => void mutate(item.read_at ? "unread" : "read", [item.id])}>{item.read_at ? "Mark unread" : "Mark read"}</button>
      </li>)}</ul>}
      {feed?.page_info?.after && <p className="mt-4 text-xs">Prototype shows the first page only.</p>}
    </aside>}
  </>;
}
