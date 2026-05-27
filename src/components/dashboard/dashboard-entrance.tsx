"use client";

import { motion, useReducedMotion } from "framer-motion";
import React from "react";

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 90,
      damping: 15,
    },
  },
};

export function DashboardEntrance({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();

  const items = React.Children.toArray(children).filter(Boolean);

  if (reduceMotion) {
    return (
      <div className="dash-cockpit-v11__entrance" data-testid="dashboard-entrance-static">
        {items}
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="dash-cockpit-v11__entrance"
      data-testid="dashboard-entrance-motion"
    >
      {items.map((child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
