"use client";

import { motion, useReducedMotion } from "framer-motion";

export function IntelligenceCore() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="ccd-core-node-wrap" data-ccd-core>
      <motion.svg
        viewBox="0 0 120 120"
        className="ccd-intel-core"
        aria-hidden
        animate={reducedMotion ? undefined : { rotate: 360 }}
        transition={
          reducedMotion
            ? undefined
            : { duration: 24, repeat: Infinity, ease: "linear" }
        }
      >
        <circle className="ccd-intel-core__ring" cx="60" cy="60" r="52" />
        <circle className="ccd-intel-core__ring ccd-intel-core__ring--inner" cx="60" cy="60" r="38" />
        <circle className="ccd-intel-core__ring" cx="60" cy="60" r="24" strokeDasharray="4 6" />
        <circle className="ccd-intel-core__hub" cx="60" cy="60" r="14" />
      </motion.svg>
    </div>
  );
}
