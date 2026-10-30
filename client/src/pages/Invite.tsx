import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { apiGet, apiPost } from "../lib/api";
import { getVisitorId } from "../lib/visitor";
import { DATE_WEEK, SURPRISE, describeChoice, weekSummary } from "../lib/dateWeek";
import FloatingHearts from "../components/FloatingHearts";

type InviteConfig = { to: string; from: string; kicker: string; question: string; message: string; };
const FALLBACK: InviteConfig = {
  to: "Huslen", from: "Myngaa",
  kicker: "Чамтай өнгөрүүлэх долоон өдрийн бяцхан төлөвлөгөө байна 💛",
  question: "Долоон өдөр, долоон болзоо. Хамт уу?",
  message: "11-р сарын 15–21 • Өдөр бүр хоёуланд зориулсан нэг жижигхэн дурсамж.",
};
const NO_LABELS = [
  "Үгүй",
  "Барих гээд үз 😌",
  "Арай удаан байна",
  "Дахиад алдчихлаа",
  "Баригдахгүй ээ",
  "Дахиад оролдоорой",
  "Бараг л барилаа",
  "Амжихгүй дээ",
  "Зүгээр л тэгье гэчих 💛",
];

const fade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 },
  transition: { duration: 0.35 },
};

type Stage = "ask" | "details" | "done";

export default function Invite() {
  const [cfg, setCfg] = useState<InviteConfig | null>(null);
  const [stage, setStage] = useState<Stage>("ask");
  const [dodges, setDodges] = useState(0);
  const [presses, setPresses] = useState(0);
  const [noPos, setNoPos] = useState({ x: 0, y: 0 });
  const [choices, setChoices] = useState<Record<string, string>>({});
  const selectedCount = DATE_WEEK.filter((day) => choices[day.date]).length;
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const noRef = useRef<HTMLButtonElement>(null);
  const homeTimer = useRef<number | null>(null);
  const lastDodge = useRef(0);
  const initialResponse = useRef<Promise<unknown> | null>(null);
  const visitorId = useMemo(getVisitorId, []);

  useEffect(() => {
    apiGet<InviteConfig>("/config")
      .then(setCfg)
      .catch(() => setCfg(FALLBACK));
    return () => {
      if (homeTimer.current) window.clearTimeout(homeTimer.current);
    };
  }, []);

  // While asking: the pointer anywhere on the page drives the "No" button.
  // Near it -> dodge away. Away from it -> snap back to its original spot.
  useEffect(() => {
    if (stage !== "ask") return;
    function onMove(e: PointerEvent) {
      const btn = noRef.current;
      const area = areaRef.current;
      if (!btn || !area) return;
      const b = btn.getBoundingClientRect();
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);

      if (dist > 130) {
        setNoPos((p) => (p.x === 0 && p.y === 0 ? p : { x: 0, y: 0 }));
        return;
      }
      const now = performance.now();
      if (now - lastDodge.current < 55) return;
      lastDodge.current = now;

      const a = area.getBoundingClientRect();
      let dx = cx - e.clientX;
      let dy = cy - e.clientY;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      const maxX = Math.max(40, a.width / 2 - b.width / 2 - 6);
      setNoPos((prev) => ({
        x: clamp(prev.x + dx * 140 + (Math.random() - 0.5) * 24, -maxX, maxX),
        y: clamp(prev.y + dy * 96, -80, 60),
      }));
      setDodges((v) => v + 1);
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [stage]);

  function goHome() {
    setNoPos((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }));
  }

  function scheduleHome() {
    if (homeTimer.current) window.clearTimeout(homeTimer.current);
    homeTimer.current = window.setTimeout(goHome, 650);
  }

  // Touch / keyboard: shove away from a point, then drift home.
  function shove(fromX: number, fromY: number) {
    const btn = noRef.current;
    const area = areaRef.current;
    if (!btn || !area) return;
    const b = btn.getBoundingClientRect();
    const a = area.getBoundingClientRect();
    let dx = b.left + b.width / 2 - fromX;
    let dy = b.top + b.height / 2 - fromY;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    const maxX = Math.max(40, a.width / 2 - b.width / 2 - 6);
    setNoPos((prev) => ({
      x: clamp(prev.x + dx * 140 + (Math.random() - 0.5) * 24, -maxX, maxX),
      y: clamp(prev.y + dy * 96, -80, 60),
    }));
    setDodges((v) => v + 1);
  }

  function burst() {
    confetti({ particleCount: 130, spread: 95, origin: { y: 0.6 }, scalar: 0.9 });
  }

  function sayYes() {
    burst();
    setStage("details");
    initialResponse.current = apiPost("/response", {
      answer: "yes", dodgeCount: dodges, visitorId,
    }).catch(() => {});
  }

  async function submitDetails() {
    if (saving || selectedCount !== 7) return;
    setSaveError(null);
    setSaving(true);
    try {
      // Finish the initial answer before saving details so it cannot overwrite them.
      await initialResponse.current;
      await apiPost("/response", {
        answer: "yes",
        chosenSlot: "2026.11.15–11.21 · 7 өдрийн болзоо",
        message: weekSummary(choices) + (note.trim() ? "\n\nЗурвас: " + note.trim() : ""),
        dodgeCount: dodges,
        visitorId,
      });
      burst();
      setStage("done");
    } catch {
      setSaveError("Төлөвлөгөөг илгээж чадсангүй. Дахин оролдоорой.");
    } finally {
      setSaving(false);
    }
  }

  if (!cfg) return <div className="bg" />;

  // Label stays "No" until an actual press attempt; dodging on cursor
  // approach does not change it.
  const noLabel = NO_LABELS[Math.min(presses, NO_LABELS.length - 1)];

  return (
    <div className="bg">
      <FloatingHearts />

      <motion.main
        className={"card" + (stage !== "ask" ? " week-card" : "")}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <AnimatePresence mode="wait">
          {stage === "ask" && (
            <motion.section key="ask" {...fade}>
              <h1 className="question">{cfg.question}</h1>
              <p className="message">{cfg.message}</p>

              <div className="btnArea" ref={areaRef} onMouseLeave={goHome}>
                <motion.button
                  type="button"
                  className="btn btn-yes"
                  whileTap={{ scale: 0.96 }}
                  onClick={sayYes}
                >
                  Тэгье 💛
                </motion.button>

                <motion.button
                  ref={noRef}
                  type="button"
                  className="btn btn-no"
                  animate={{ x: noPos.x, y: noPos.y }}
                  transition={{ type: "spring", stiffness: 420, damping: 18 }}
                  onFocus={() => shove(-9999, 0)}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setPresses((p) => p + 1);
                    shove(e.clientX, e.clientY);
                    scheduleHome();
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    setPresses((p) => p + 1);
                    const t = e.touches[0];
                    if (t) shove(t.clientX, t.clientY);
                    scheduleHome();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    setPresses((p) => p + 1);
                    shove(-9999, 0);
                  }}
                >
                  {noLabel}
                </motion.button>
              </div>

              {dodges > 2 && (
                <p className="hint">“Үгүй” дарах гэж оролдоод үзэхгүй юу 😌</p>
              )}
            </motion.section>
          )}

          {stage === "details" && (
            <motion.section key="details" {...fade}>
              <p className="kicker">2026 · 11 сарын 15–21</p>
              <h1 className="question">Бидний 7 хоног 💛</h1>
              <p className="message week-intro">Өдөр бүр юу хийхээ сонгоорой. “Өөрөө мэд” гэвэл {cfg.from} тэр өдрийн болзоог санаачлаад, бүгдийг төлөвлөнө 😌</p>
              <p className="week-progress" role="status">{selectedCount} / 7 өдрийн сонголт бэлэн</p>
              <div className="week-days">
                {DATE_WEEK.map((day, index) => (
                  <fieldset className="date-day" key={day.date} disabled={saving}>
                    <legend><time dateTime={day.date}>{day.label}</time> · {day.day}</legend>
                    <div className="day-heading"><span className="day-emoji" aria-hidden="true">{day.emoji}</span><div><span className="day-number">Өдөр {index + 1}</span><h2>{day.title}</h2></div></div>
                    <p className="day-description">{day.description}</p>
                    <div className="day-options">
                      {[...day.options, SURPRISE].map((option) => (
                        <label className={"date-option" + (choices[day.date] === option ? " selected" : "")} key={option}>
                          <input type="radio" name={day.date} value={option} checked={choices[day.date] === option} onChange={() => setChoices((previous) => ({ ...previous, [day.date]: option }))} />
                          <span>{option}{option === SURPRISE && <small>Чи санаачлаад төлөвлөөрэй 💛</small>}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
              <label className="note-label" htmlFor="week-note">Надад хэлэх зүйл байна уу? <span>(заавал биш)</span></label>
              <textarea
                className="note"
                id="week-note"
                disabled={saving}
                rows={3}
                placeholder="Цаг, хүсэл, эсвэл нэг хөөрхөн зурвас…"
                value={note}
                maxLength={400}
                onChange={(e) => setNote(e.target.value)}
              />

              <button
                type="button"
                className="btn btn-yes wide"
                disabled={saving || selectedCount !== 7}
                onClick={submitDetails}
              >
                {saving ? "Илгээж байна…" : "Бидний төлөвлөгөөг илгээх 💌"}
              </button>
              {saveError && <p className="err" role="alert">{saveError}</p>}
            </motion.section>
          )}

          {stage === "done" && (
            <motion.section key="done" {...fade}>
              <p className="kicker">11.15–11.21 · Хоёулангийн цаг</p>
              <h1 className="question">Тохирлоо, хамтдаа 💛</h1>
              <p className="message">Сонголтуудыг чинь авлаа. “Өөрөө мэд” гэсэн өдрүүдийг {cfg.from} төлөвлөнө.</p>
              <ul className="week-recap">{DATE_WEEK.map((day) => <li key={day.date}><time dateTime={day.date}>{day.label}</time><span>{describeChoice(choices[day.date])}</span></li>)}</ul>
            </motion.section>
          )}
        </AnimatePresence>
      </motion.main>

      <a className="peek" href="/dashboard" title="Хариунууд">
        ·
      </a>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
