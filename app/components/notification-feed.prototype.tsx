// Throwaway: three Notification Feed layouts in the existing app via ?variant=A|B|C.
// Sample mode is explicitly labelled; local read/seen state is not vendor validation.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Bell, ArrowLeft, ArrowRight, X } from "lucide-react";

const names = { A: "Bell popover", B: "Side drawer", C: "Inline inbox" };
type Variant = keyof typeof names;
const initialItems = [
  { id: "reply", title: "Your instructor replied", body: "There’s a reply to your lesson question.", category: "Conversations", time: "5 minutes ago" },
  { id: "lesson", title: "A new lesson is ready", body: "Your instructor announced a new lesson in your course.", category: "Learning", time: "1 hour ago" },
  { id: "purchase", title: "Your course purchase is confirmed", body: "Your course is ready to start.", category: "Purchases", time: "Yesterday" },
];

export function NotificationFeedPrototype({ userId }: { userId: number | null }) {
  const [params, setParams] = useSearchParams();
  const raw = params.get("variant");
  const variant: Variant = raw === "B" || raw === "C" ? raw : "A";
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<string[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const items = empty ? [] : initialItems;
  const unread = items.filter(i => !read.includes(i.id)).length;
  const visible = items.filter(i => !onlyUnread || !read.includes(i.id));
  const expanded = variant === "C" || open;
  const cycle = (direction: number) => {
    const keys: Variant[] = ["A", "B", "C"];
    const next = new URLSearchParams(params);
    next.set("variant", keys[(keys.indexOf(variant) + direction + 3) % 3]);
    setParams(next, { replace: true });
  };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]')) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault(); cycle(event.key === "ArrowLeft" ? -1 : 1);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });
  useEffect(() => {
    if (expanded) setSeen(visible.map(i => i.id));
  }, [expanded, onlyUnread, empty]);

  const feed = <section aria-label="Notification Feed" className="rounded-xl border bg-background shadow-xl">
    <header className="flex items-center justify-between border-b p-4">
      <div><h2 className="font-semibold">Notifications</h2><p className="text-xs text-muted-foreground">{unread} unread</p></div>
      {variant !== "C" && <button aria-label="Close notifications" onClick={() => setOpen(false)}><X size={18} /></button>}
    </header>
    <div className="flex justify-between border-b p-3 text-sm">
      <button onClick={() => setOnlyUnread(!onlyUnread)} className="rounded border px-3 py-1">{onlyUnread ? "Show all" : "Show unread"}</button>
      <button onClick={() => setRead(items.map(i => i.id))} className="text-primary">Mark all read</button>
    </div>
    {visible.length === 0 ? <p className="p-8 text-center text-muted-foreground">{onlyUnread && items.length ? "You’re all caught up." : "No notifications yet."}</p> : <ul>
      {visible.map(item => <li key={item.id} className={`border-b p-4 last:border-0 ${read.includes(item.id) ? "" : "bg-primary/5"}`}>
        <button className="w-full text-left" onClick={() => { setRead(previous => [...new Set([...previous, item.id])]); setSelected(item.id); }}>
          <span className="mb-1 flex items-center gap-2 text-sm font-semibold">{!read.includes(item.id) && <span aria-label="Unread" className="size-2 rounded-full bg-primary" />}{item.title}</span>
          <span className="block text-sm text-muted-foreground">{item.body}</span>
          <span className="mt-2 block text-xs text-muted-foreground">{item.category} · {item.time}</span>
        </button>
        <button className="mt-2 text-xs underline" onClick={() => setRead(previous => previous.includes(item.id) ? previous.filter(id => id !== item.id) : [...previous, item.id])}>{read.includes(item.id) ? "Mark unread" : "Mark read"}</button>
      </li>)}
    </ul>}
  </section>;

  return <>
    <div className="m-4 rounded-lg border border-amber-400 bg-amber-50 p-3 text-xs text-amber-950">
      <strong>Throwaway UI prototype · sample data</strong> · Recipient {userId ?? "not selected"}. Knock feed not connected yet.
      <div className="mt-2 flex gap-4"><button className="underline" onClick={() => setEmpty(!empty)}>{empty ? "Restore examples" : "Show empty state"}</button><button className="underline" onClick={() => {setRead([]); setSeen([]); setSelected(null);}}>Reset state</button></div>
      <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify({ variant, recipient: userId, unread, seen, read, selected }, null, 2)}</pre>
      {selected && <p className="mt-2">Proposed click: mark read, then open the relevant {selected === "reply" ? "lesson conversation" : selected === "lesson" ? "lesson" : "course"}. Destination is simulated in this preview.</p>}
    </div>
    {variant === "C" ? <div className="mx-4 mb-6 max-w-3xl">{feed}</div> : <div className="relative mx-4 flex justify-end">
      <button aria-label={`Notifications, ${unread} unread`} aria-expanded={open} className="flex items-center gap-2 rounded-full border bg-background px-4 py-2" onClick={() => setOpen(!open)}><Bell size={18} />{unread > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{unread}</span>}</button>
      {open && variant === "A" && <div className="absolute right-0 top-12 z-30 w-[min(380px,85vw)]">{feed}</div>}
    </div>}
    {open && variant === "B" && <aside className="fixed right-0 top-0 z-30 h-screen w-[min(440px,90vw)] overflow-y-auto border-l bg-background p-4 shadow-2xl">{feed}</aside>}
    <nav aria-label="Prototype variants" className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-5 rounded-full bg-slate-950 px-5 py-3 text-sm text-white shadow-xl">
      <button aria-label="Previous variant" onClick={() => cycle(-1)}><ArrowLeft size={18} /></button><span className="whitespace-nowrap">{variant} · {names[variant]}</span><button aria-label="Next variant" onClick={() => cycle(1)}><ArrowRight size={18} /></button>
    </nav>
  </>;
}
