"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface PowerBIEmbedProps {
  reportId: string;
  workspaceId: string;
  datasetIds?: string[];
  className?: string;
  height?: string;
}

interface EmbedTokenResponse {
  token: string;
  expiration: string;
  embedUrl: string;
}

export function PowerBIEmbed({
  reportId,
  workspaceId,
  datasetIds = [],
  className = "",
  height = "500px",
}: PowerBIEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<unknown>(null);

  const fetchEmbedToken = useCallback(async (): Promise<EmbedTokenResponse> => {
    const res = await fetch("/api/powerbi/embed-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, workspaceId, datasetIds }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to get embed token");
    }

    return res.json();
  }, [reportId, workspaceId, datasetIds]);

  useEffect(() => {
    let mounted = true;
    let refreshTimer: NodeJS.Timeout;

    async function embed() {
      try {
        // Dynamic import — powerbi-client is a large library
        const pbi = await import("powerbi-client");
        const tokenData = await fetchEmbedToken();

        if (!mounted || !containerRef.current) return;

        const powerbiService = new pbi.service.Service(
          pbi.factories.hpmFactory,
          pbi.factories.wpmpFactory,
          pbi.factories.routerFactory
        );

        const config = {
          type: "report",
          tokenType: pbi.models.TokenType.Embed,
          accessToken: tokenData.token,
          embedUrl: tokenData.embedUrl,
          id: reportId,
          settings: {
            panes: {
              filters: { visible: false },
              pageNavigation: { visible: true },
            },
            background: pbi.models.BackgroundType.Transparent,
          },
        };

        const report = powerbiService.embed(containerRef.current, config);
        reportRef.current = report;

        report.on("loaded", () => {
          if (mounted) setLoading(false);
        });

        report.on("error", (event: { detail: { message: string } }) => {
          if (mounted) setError(event.detail.message);
        });

        // Schedule token refresh at 50% of token lifetime
        const expiry = new Date(tokenData.expiration).getTime();
        const now = Date.now();
        const refreshIn = (expiry - now) * 0.5;

        if (refreshIn > 0) {
          refreshTimer = setTimeout(async () => {
            try {
              const newToken = await fetchEmbedToken();
              if (mounted && reportRef.current) {
                (reportRef.current as { setAccessToken: (t: string) => void }).setAccessToken(
                  newToken.token
                );
              }
            } catch {
              // Token refresh failed — report will show auth error naturally
            }
          }, refreshIn);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to embed report");
          setLoading(false);
        }
      }
    }

    embed();

    const container = containerRef.current;
    return () => {
      mounted = false;
      clearTimeout(refreshTimer);
      if (container) {
        container.innerHTML = "";
      }
    };
  }, [reportId, fetchEmbedToken]);

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-sm text-text-muted animate-pulse">
            Loading Power BI report...
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-sm text-accent-red">{error}</div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden" />
    </div>
  );
}
