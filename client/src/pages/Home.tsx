import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Landing from "./Landing";
import Invite from "./Invite";

/**
 * Single route. Every page load / refresh starts on the intro (Landing);
 * pressing the button reveals the invitation (Invite) — no URL change, so a
 * refresh always brings you back to the "Hi Huslen" screen.
 */
export default function Home() {
  const [opened, setOpened] = useState(false);

  return (
    <AnimatePresence mode="wait">
      {opened ? (
        <motion.div
          key="invite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{ minHeight: "100dvh" }}
        >
          <Invite />
        </motion.div>
      ) : (
        <motion.div
          key="landing"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{ minHeight: "100dvh" }}
        >
          <Landing onOpen={() => setOpened(true)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
