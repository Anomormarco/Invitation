const KEY = "invite:visitorId";
let memoryId: string | undefined;

function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `v_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** A stable per-browser id so repeat opens map to one response row. */
export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = createId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return (memoryId ??= createId());
  }
}
