import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { apiPost } from "../lib/api";
import { getVisitorId } from "../lib/visitor";
import FloatingHearts from "../components/FloatingHearts";

const PHOTO_URL = "/photos/photo_6278458110867346736_y.jpg";

export default function Landing({ onOpen }: { onOpen: () => void }) {
  const [photoBroken, setPhotoBroken] = useState(false);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const visitorId = useMemo(getVisitorId, []);

  useEffect(() => {
    apiPost("/visit", { visitorId }).catch(() => {});
    ctaRef.current?.focus();
  }, [visitorId]);

  return (
    <div className="bg">
      <FloatingHearts />

      <motion.main
        className="card"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <motion.p
          className="lead"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
        >
          Бэйби, чи над руу очиж байна 😄
          <br />
          Хувцас, чемоданаа бэлдээрэй. Биднийг урт өдрүүд хүлээж байна. Юүүвэээйёоо! 🧳💛
        </motion.p>

        {!photoBroken && (
          <motion.img
            className="lead-photo"
            src={PHOTO_URL}
            alt=""
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            onError={() => setPhotoBroken(true)}
          />
        )}

        <motion.button
          ref={ctaRef}
          type="button"
          className="btn btn-yes wide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          whileTap={{ scale: 0.97 }}
          onClick={onOpen}
        >
          Саналыг хүлээж ав 💌
        </motion.button>
      </motion.main>

      <a className="peek" href="/dashboard" title="Хариунууд">
        ·
      </a>
    </div>
  );
}
