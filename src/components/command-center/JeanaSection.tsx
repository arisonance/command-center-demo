"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";

interface JeanaItem {
  title: string;
  context: string;
  url: string;
}


function buildJeanaDraft(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("buying group accruals")) return "Jeana, checking in on buying group accruals \u2014 any update on the reconciliation status?\n\nThanks\nAri";
  if (t.includes("primary suite")) return "Jeana, where are we on Primary Suite Construction? Just want to make sure nothing is stuck.\n\nThanks\nAri";
  if (t.includes("sharepoint") && t.includes("dbv")) return "Jeana, any progress on getting the SharePoint docs set up for DBV Investment AI? Let me know if you need anything from my end.\n\nThanks\nAri";
  if (t.includes("cloudflare")) return "Jeana, checking in \u2014 did we get the Cloudflare API token into 1Password?\n\nThanks\nAri";
  if (t.includes("chair automation") || t.includes("nas issues")) return "Jeana, now that ISE is done, can we get the chair automation scheduled? David Stark is coming Monday for the QNAP \u2014 might be a good time.\n\nThanks\nAri";
  if (t.includes("slt self eval")) return "Jeana, SLT self evals are still on hold until after March bonuses, right? Just confirming we're on the same page.\n\nThanks\nAri";
  if (t.includes("trey bot")) return "Jeana, any update on the Trey Bot iMessage setup on the Mac Mini? This one's getting urgent.\n\nThanks\nAri";
  if (t.includes("compensation")) return "Jeana, checking in on compensation decisions \u2014 are we set to finalize on Monday?\n\nThanks\nAri";
  return `Jeana, checking in on ${title} \u2014 where are we on this?\n\nThanks\nAri`;
}

interface JeanaSectionProps {
  items?: JeanaItem[];
}

export function JeanaSection({ items = [] }: JeanaSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDraft, setModalDraft] = useState("");

  function openModal(title: string) {
    setModalDraft(buildJeanaDraft(title));
    setModalOpen(true);
  }

  function handleCopy() {
    navigator.clipboard?.writeText(modalDraft);
  }

  return (
    <>
      <section className="glass-card anim-card" style={{ animationDelay: "240ms" }}>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold text-text-heading">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Jeana Ceglia
            <span className="inline-flex items-center rounded-full bg-accent-amber/15 text-accent-amber px-2 py-0.5 text-xs font-medium">
              {items.length} items
            </span>
          </h2>
          <svg
            className={cn("w-4 h-4 text-text-muted transition-transform", isOpen && "rotate-180")}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {isOpen && items.length === 0 && <EmptyState />}

        {isOpen && items.length > 0 && (
          <div className="mt-4 space-y-2">
            {items.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-[var(--tab-bg)] transition-colors"
              >
                <a className="hot-link text-sm text-text-body" href={item.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  {item.title}
                </a>
                <button
                  className="text-xs text-text-muted hover:text-accent-amber transition-colors shrink-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal(item.title);
                  }}
                >
                  Delegate
                </button>
              </div>
            ))}
            <div className="pt-3 border-t border-[var(--bg-card-border)]">
              <button
                className="text-xs px-3 py-1.5 rounded-lg bg-accent-amber/15 text-accent-amber hover:bg-accent-amber/25 transition-colors cursor-pointer"
                onClick={() => openModal("Daily check-in")}
              >
                Message Jeana
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Jeana Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="glass-card w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-heading">Delegate to Jeana Ceglia</h3>
              <button
                className="text-text-muted hover:text-text-heading transition-colors cursor-pointer"
                onClick={() => setModalOpen(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <textarea
              className="w-full h-32 bg-[var(--draft-bg)] border border-[rgba(212,164,76,0.1)] rounded-lg p-3 text-sm text-text-body resize-none focus:outline-none focus:border-accent-amber/30"
              value={modalDraft}
              onChange={(e) => setModalDraft(e.target.value)}
            />
            <div className="flex gap-2 mt-3">
              <button
                className="text-xs px-3 py-1.5 rounded-lg bg-accent-amber text-[#0d0d0d] font-medium cursor-pointer hover:bg-accent-amber/90 transition-colors"
                onClick={handleCopy}
              >
                Copy to Clipboard
              </button>
              <a
                className="text-xs px-3 py-1.5 rounded-lg border border-[var(--bg-card-border)] text-text-muted hover:text-text-body transition-colors"
                href="https://teams.microsoft.com/l/chat/0/0?users=jeanac@sonance.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Jeana&apos;s Chat in Teams
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
