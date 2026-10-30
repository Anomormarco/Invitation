import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { apiGet, ApiError, getAdminKey, setAdminKey, API_BASE } from "../lib/api";

type ResponseRow = {
  id: string;
  answer: "yes" | "no" | string;
  message: string | null;
  chosenSlot: string | null;
  dodgeCount: number;
  createdAt: string;
  updatedAt: string;
  userAgent: string | null;
};

type VisitRow = {
  id: string;
  visitorId: string | null;
  userAgent: string | null;
  referrer: string | null;
  createdAt: string;
};

type Stats = {
  visits: number;
  yes: number;
  no: number;
  maxDodges: number;
  latestAt: string | null;
};

type Notif = {
  id: string;
  answer: string;
  chosenSlot: string | null;
  message: string | null;
  at: string;
  read: boolean;
};

type View = "overview" | "responses" | "visits";

const NAV: { id: View; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "◍" },
  { id: "responses", label: "Responses", icon: "✉" },
  { id: "visits", label: "Visits", icon: "◦" },
];

function fmt(iso: string | null): string {
  if (!iso) return "—";
  // Browser-local time — matches the viewer's own clock (day / month / hour).
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function shortUA(ua: string | null): string {
  if (!ua) return "—";
  const m =
    /(Firefox|Edg|OPR|Chrome|Safari)\/[\d.]+/.exec(ua) ??
    /(curl)\/[\d.]+/.exec(ua);
  return m ? m[0].replace("Edg", "Edge").replace("OPR", "Opera") : ua.slice(0, 32);
}

export default function Dashboard() {
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [view, setView] = useState<View>("overview");
  const [locked, setLocked] = useState(!getAdminKey());
  const [keyInput, setKeyInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // --- realtime notifications ---
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [live, setLive] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [desktopPerm, setDesktopPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );
  const toastTimer = useRef<number | null>(null);
  const unread = notifs.filter((n) => !n.read).length;

  useEffect(() => {
    const url = new URL(window.location.href);
    const k = url.searchParams.get("key");
    if (k) {
      setAdminKey(k);
      setLocked(false);
      url.searchParams.delete("key");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  const load = useCallback(async () => {
    if (!getAdminKey()) {
      setLocked(true);
      return;
    }
    setLoading(true);
    try {
      const [r, v, s] = await Promise.all([
        apiGet<ResponseRow[]>("/responses", { admin: true }),
        apiGet<VisitRow[]>("/visits", { admin: true }),
        apiGet<Stats>("/stats", { admin: true }),
      ]);
      setRows(r);
      setVisits(v);
      setStats(s);
      setLocked(false);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setLocked(true);
        setError("That key was not accepted.");
      } else {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (locked) return;
    void load();
    const t = window.setInterval(load, 10_000);
    return () => window.clearInterval(t);
  }, [locked, load]);

  // Live push channel (Socket.IO). New responses arrive here instantly.
  useEffect(() => {
    if (locked) return;
    const key = getAdminKey();
    if (!key) return;

    const socket: Socket = io(API_BASE || "/", {
      path: "/socket.io",
      auth: { key },
    });
    socket.on("connect", () => setLive(true));
    socket.on("disconnect", () => setLive(false));
    socket.on("connect_error", () => setLive(false));

    socket.on("response:new", (r: ResponseRow) => {
      const n: Notif = {
        id: r.id,
        answer: r.answer,
        chosenSlot: r.chosenSlot,
        message: r.message,
        at: r.updatedAt ?? r.createdAt ?? new Date().toISOString(),
        read: false,
      };
      setNotifs((list) => [n, ...list.filter((x) => x.id !== n.id)].slice(0, 40));
      flashToast(
        r.answer === "yes"
          ? `New yes${r.chosenSlot ? ` · ${r.chosenSlot}` : ""} 💌`
          : "New response",
      );
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        new Notification("INVITE — new response 💌", {
          body:
            r.answer === "yes"
              ? `Yes${r.chosenSlot ? ` · ${r.chosenSlot}` : ""}${
                  r.message ? ` — “${r.message}”` : ""
                }`
              : "Someone answered",
        });
      }
      void load();
    });

    return () => {
      socket.disconnect();
      setLive(false);
    };
  }, [locked, load]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  function flashToast(text: string) {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4500);
  }

  function askDesktop() {
    if (typeof Notification === "undefined") return;
    void Notification.requestPermission().then(setDesktopPerm);
  }

  function markAllRead() {
    setNotifs((list) => list.map((n) => ({ ...n, read: true })));
  }

  function unlock(e: React.FormEvent) {
    e.preventDefault();
    setAdminKey(keyInput.trim());
    setKeyInput("");
    setLocked(false);
    void load();
  }

  function lock() {
    setAdminKey("");
    setRows([]);
    setVisits([]);
    setStats(null);
    setNotifs([]);
    setPanelOpen(false);
    setLocked(true);
  }

  if (locked) {
    return (
      <div className="dash-lock">
        <form className="lockcard" onSubmit={unlock}>
          <h1>Dashboard</h1>
          <p className="muted">Admin role required. Enter the key.</p>
          <input
            type="password"
            autoFocus
            placeholder="admin key"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
          />
          <button type="submit" className="btn btn-yes wide">
            Unlock
          </button>
          {error && <p className="err">{error}</p>}
        </form>
      </div>
    );
  }

  const title = NAV.find((n) => n.id === view)?.label ?? "";

  return (
    <div className="dash">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-dot">💛</span> INVITE
        </div>
        <nav className="sidenav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={"sidenav-item" + (view === n.id ? " active" : "")}
              onClick={() => setView(n.id)}
            >
              <span className="sidenav-icon">{n.icon}</span>
              {n.label}
              {n.id === "responses" && rows.length > 0 && (
                <span className="pill">{rows.length}</span>
              )}
              {n.id === "visits" && visits.length > 0 && (
                <span className="pill">{visits.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button className="ghost" onClick={load}>
            Refresh
          </button>
          <button className="ghost" onClick={lock}>
            Lock
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="main-head">
          <div>
            <h1>{title}</h1>
            <p className="muted">
              {loading ? "refreshing…" : "auto-refreshes every 10s"}
              {" · "}
              <span className={"live-dot" + (live ? " on" : "")} />
              {live ? "live" : "offline"}
            </p>
          </div>

          <div className="bell-wrap">
            <button
              className="bell"
              aria-label="notifications"
              onClick={() => {
                setPanelOpen((o) => {
                  const next = !o;
                  if (next) markAllRead();
                  return next;
                });
              }}
            >
              <span aria-hidden="true">🔔</span>
              {unread > 0 && (
                <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>
              )}
            </button>

            {panelOpen && (
              <div className="notif-panel">
                <div className="notif-head">
                  <strong>Notifications</strong>
                  <button className="linkish" onClick={() => setNotifs([])}>
                    clear
                  </button>
                </div>

                {desktopPerm !== "granted" && (
                  <button className="notif-enable" onClick={askDesktop}>
                    {desktopPerm === "denied"
                      ? "Desktop alerts blocked in browser"
                      : "Enable desktop alerts"}
                  </button>
                )}

                {notifs.length === 0 ? (
                  <p className="notif-empty">
                    Nothing yet — new responses show up here instantly.
                  </p>
                ) : (
                  <ul className="notif-list">
                    {notifs.map((n) => (
                      <li key={n.id + n.at}>
                        <span
                          className={
                            "badge badge-" + (n.answer === "yes" ? "yes" : "no")
                          }
                        >
                          {n.answer}
                        </span>
                        <span className="notif-slot">
                          {n.chosenSlot ?? n.message ?? "—"}
                        </span>
                        <span className="notif-time">{fmt(n.at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </header>

        {error && <p className="err">{error}</p>}

        {view === "overview" && (
          <>
            <section className="tiles">
              <Tile label="Opened the link" value={stats?.visits ?? "—"} />
              <Tile label="Said yes" value={stats?.yes ?? "—"} accent="yes" />
              <Tile label="Said no" value={stats?.no ?? "—"} accent="no" />
              <Tile label="Most “no” dodges" value={stats?.maxDodges ?? "—"} />
              <Tile
                label="Latest reply"
                value={fmt(stats?.latestAt ?? null)}
                small
              />
            </section>

            <h2 className="sub">Latest responses</h2>
            {rows.length === 0 ? (
              <p className="empty">No responses yet. Share the link 💌</p>
            ) : (
              <ResponsesTable rows={rows.slice(0, 6)} />
            )}
          </>
        )}

        {view === "responses" &&
          (rows.length === 0 ? (
            <p className="empty">No responses yet. Share the link 💌</p>
          ) : (
            <ResponsesTable rows={rows} />
          ))}

        {view === "visits" &&
          (visits.length === 0 ? (
            <p className="empty">No visits recorded yet.</p>
          ) : (
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Visitor</th>
                    <th>Browser</th>
                    <th>Referrer</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <tr key={v.id}>
                      <td className="nowrap">{fmt(v.createdAt)}</td>
                      <td className="mono">{v.visitorId?.slice(0, 8) ?? "—"}</td>
                      <td>{shortUA(v.userAgent)}</td>
                      <td>{v.referrer ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function ResponsesTable({ rows }: { rows: ResponseRow[] }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Answer</th>
            <th>Date week</th>
            <th>Note</th>
            <th>Dodges</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="nowrap">{fmt(r.updatedAt ?? r.createdAt)}</td>
              <td>
                <span
                  className={"badge badge-" + (r.answer === "yes" ? "yes" : "no")}
                >
                  {r.answer}
                </span>
              </td>
              <td>{r.chosenSlot ?? "—"}</td>
              <td className="note-cell">{r.message ?? "—"}</td>
              <td>{r.dodgeCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tile({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string | number;
  accent?: "yes" | "no";
  small?: boolean;
}) {
  return (
    <div className={"tile" + (accent ? " tile-" + accent : "")}>
      <div className={"tile-num" + (small ? " tile-num-sm" : "")}>{value}</div>
      <div className="tile-label">{label}</div>
    </div>
  );
}
