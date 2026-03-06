"use client";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface SyncIndicatorProps {
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  syncError?: string | null;
  className?: string;
}

export function SyncIndicator({
  isSyncing,
  lastSyncedAt,
  syncError,
  className,
}: SyncIndicatorProps) {
  // Re-render every 30s so "X mins ago" stays fresh
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (syncError && !isSyncing) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 text-xs text-accent-amber",
          className
        )}
      >
        <span>&#9888;&#65039;</span>
        <span>Using cached data</span>
      </div>
    );
  }

  if (isSyncing && !lastSyncedAt) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 text-xs text-text-muted",
          className
        )}
      >
        <svg
          className="h-3.5 w-3.5 animate-spin text-accent-amber"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
        <span>Loading live data&hellip;</span>
      </div>
    );
  }

  const minsAgo = lastSyncedAt
    ? Math.max(0, Math.round((now - lastSyncedAt.getTime()) / 60_000))
    : null;

  const timeLabel =
    minsAgo === null || minsAgo === 0
      ? "just now"
      : minsAgo === 1
        ? "1 min ago"
        : `${minsAgo} mins ago`;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-xs text-text-muted",
        className
      )}
    >
      <span className="h-2 w-2 rounded-full bg-accent-green" />
      <span>
        Live <span className="opacity-50">&middot;</span> Synced {timeLabel}
      </span>
    </div>
  );
}
