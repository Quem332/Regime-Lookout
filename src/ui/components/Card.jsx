import React from "react";

export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={
        "rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 " +
        className
      }
      {...props}
    >
      {children}
    </div>
  );
}
