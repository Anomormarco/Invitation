import "dotenv/config";

export type EventOption = {
  id: string;
  title: string;
  subtitle?: string;
  date?: string;
  venue?: string;
  accent?: string;
  imageUrl?: string;
};

const DEFAULT_EVENTS: EventOption[] = [
  {
    id: "the-lemons",
    title: "The Lemons",
    subtitle: "XXII — live show",
    date: "Sep 4, 2026",
    venue: "Ulaanbaatar",
    accent: "#e11d2e",
    imageUrl: "/posters/the-lemons.jpg",
  },
  {
    id: "mc-collection",
    title: "MC Collection",
    subtitle: "Түүндээ — Live Show · 20th anniversary",
    date: "Sep 5, 2026",
    venue: "Төв Цэнгэлдэх Хүрээлэн",
    accent: "#c99733",
    imageUrl: "/posters/mc-collection.webp",
  },
];

/** INVITE_EVENTS_JSON is a JSON array of EventOption; falls back to DEFAULT_EVENTS. */
function parseEvents(raw: string | undefined): EventOption[] {
  if (!raw) return DEFAULT_EVENTS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((e) => e && typeof e === "object" && "id" in e && "title" in e)
    ) {
      return parsed as EventOption[];
    }
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_EVENTS;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  // One origin, or a comma-separated list (e.g. the Vercel URL + localhost).
  clientOrigin: (process.env.CLIENT_ORIGIN ?? "http://localhost:5174")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  isProd: process.env.NODE_ENV === "production",
  adminKey: process.env.ADMIN_KEY ?? "let-me-in",
  invite: {
    to: process.env.INVITE_TO ?? "you",
    from: process.env.INVITE_FROM ?? "me",
    kicker:
      process.env.INVITE_KICKER ??
      "Чамтай өнгөрүүлэх долоон өдрийн бяцхан төлөвлөгөө байна 💛",
    question:
      process.env.INVITE_QUESTION ?? "Долоон өдөр, долоон болзоо. Хамт уу?",
    message:
      process.env.INVITE_MESSAGE ??
      "11-р сарын 15–21 • Өдөр бүр хоёуланд зориулсан нэг жижигхэн дурсамж.",
    events: parseEvents(process.env.INVITE_EVENTS_JSON),
  },
};

export type InviteConfig = typeof config.invite;







