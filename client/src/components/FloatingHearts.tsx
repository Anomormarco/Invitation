const HEARTS = Array.from({ length: 14 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280;
  const rnd = seed / 233280;
  return {
    left: `${(rnd * 100).toFixed(1)}%`,
    size: `${12 + Math.round(rnd * 22)}px`,
    delay: `${(rnd * 12).toFixed(1)}s`,
    duration: `${14 + Math.round(rnd * 12)}s`,
    char: rnd > 0.5 ? "♥" : "✿",
  };
});

export default function FloatingHearts() {
  return (
    <div className="hearts" aria-hidden="true">
      {HEARTS.map((h, i) => (
        <span
          key={i}
          className="heart"
          style={{
            left: h.left,
            fontSize: h.size,
            animationDelay: h.delay,
            animationDuration: h.duration,
          }}
        >
          {h.char}
        </span>
      ))}
    </div>
  );
}
