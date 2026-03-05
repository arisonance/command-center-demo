"use client";
import { useState } from "react";

interface EODSummaryProps {
  isOpen: boolean;
  onClose: () => void;
}

function generateSummary(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
  const weather = "San Clemente, CA \u2014 82\u00B0F / 55\u00B0F, Sunny";

  return `\u2550\u2550\u2550 END-OF-DAY SUMMARY \u2550\u2550\u2550
${dateStr}
${weather}

\u2500\u2500\u2500 MEETINGS ATTENDED \u2500\u2500\u2500
  \u2022 8:30 \u2013 9:00 AM \u2014 Day 2 Kick-Off
    (No debrief notes captured)
  \u2022 9:00 AM \u2013 12:00 PM \u2014 Services Leader Working Session
    (No debrief notes captured)
  \u2022 12:00 \u2013 2:00 PM \u2014 Working Lunch & Revised Plan Presentation
    (No debrief notes captured)
  \u2022 2:00 \u2013 3:00 PM \u2014 SLT Closeout Session
    (No debrief notes captured)

\u2500\u2500\u2500 ITEMS COMPLETED \u2500\u2500\u2500
  (None marked as done today)

\u2500\u2500\u2500 FOLLOW-UPS (7 tracked) \u2500\u2500\u2500
  \u2022 Nelson (Weeks Nelson LLP) \u2014 NPI litigation ruling
  \u2022 MThornton (EP Wealth) \u2014 Tax Season prep
  \u2022 Locauto Rent \u2014 Rental damage claim
  \u2022 Scott (WRV) \u2014 AI Article reply
  \u2022 Christine Crain \u2014 Patron decision
  \u2022 David Stark \u2014 QNAP install Monday
  \u2022 Travis Leo \u2014 Claude Excel/PPT auth issue

\u2500\u2500\u2500 DECISIONS MADE \u2500\u2500\u2500
  No decisions logged yet

\u2500\u2500\u2500 OPEN ITEMS CARRIED FORWARD (Top 5) \u2500\u2500\u2500
  1. [100] Compensation decisions finalization (asana)
  2. [100] EP Wealth Tax Season \u2014 MThornton (email)
  3. [100] NPI v. Dana Claim Construction Ruling (email)
  4. [100] Trey Bot iMessage on Mac Mini (asana)
  5. [85] Locauto Rental Damage \u20AC330 (email)

\u2500\u2500\u2500
Generated ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Los_Angeles" })} PT`;
}

export function EODSummary({ isOpen, onClose }: EODSummaryProps) {
  const [summary, setSummary] = useState(() => generateSummary());

  if (!isOpen) return null;

  function handleCopy() {
    navigator.clipboard?.writeText(summary);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-card w-full max-w-2xl mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-text-heading">End-of-Day Summary</h3>
          <button
            className="text-text-muted hover:text-text-heading transition-colors cursor-pointer"
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <textarea
          className="w-full h-80 bg-[var(--draft-bg)] border border-[rgba(212,164,76,0.1)] rounded-lg p-4 text-xs text-text-body font-mono resize-none focus:outline-none focus:border-accent-amber/30"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          spellCheck={false}
        />
        <div className="flex gap-2 mt-3">
          <button
            className="text-xs px-3 py-1.5 rounded-lg bg-accent-amber text-[#0d0d0d] font-medium cursor-pointer hover:bg-accent-amber/90 transition-colors"
            onClick={handleCopy}
          >
            Copy to Clipboard
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--bg-card-border)] text-text-muted hover:text-text-body transition-colors cursor-pointer"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
