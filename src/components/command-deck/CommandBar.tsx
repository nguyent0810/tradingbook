"use client";

import { Activity, Shield, TrendingUp } from "lucide-react";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import type { CommandBarData } from "./types";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

type Props = {
  data: CommandBarData;
  loading?: boolean;
};

function toneClass(tone?: string): string {
  if (tone === "danger") return "cd-tone-danger";
  if (tone === "warning") return "cd-tone-warning";
  if (tone === "success") return "cd-tone-success";
  return "";
}

export function CommandBar({ data, loading = false }: Props) {
  return (
    <Card className="cd-card--glass cd-span-12" data-testid="command-deck-bar">
      <div className="cd-command-bar">
        <div>
          <label>
            <Activity className="inline h-3 w-3 mr-1 opacity-50" aria-hidden />
            Session
          </label>
          {loading ? (
            <LoadingSkeleton height="1.25rem" width="10rem" />
          ) : (
            <span className="cd-command-bar__value cd-mono text-sm">{data.session}</span>
          )}
        </div>

        <div>
          <label>
            <TrendingUp className="inline h-3 w-3 mr-1 opacity-50" aria-hidden />
            VNINDEX
          </label>
          {loading ? (
            <LoadingSkeleton height="1.5rem" width="6rem" />
          ) : (
            <span className="cd-command-bar__value cd-mono text-lg">{data.vnindex}</span>
          )}
        </div>

        <div>
          <label>Freshness</label>
          {loading ? (
            <LoadingSkeleton height="1.25rem" width="7rem" />
          ) : (
            <span className="cd-command-bar__value">{data.freshness}</span>
          )}
        </div>

        <div>
          <label>Regime</label>
          {loading ? (
            <LoadingSkeleton height="1.25rem" width="5rem" />
          ) : (
            <>
              <span className="cd-command-bar__value">{data.regime}</span>
              {data.regimeNote ? (
                <span className="cd-command-bar__note">{data.regimeNote}</span>
              ) : null}
            </>
          )}
        </div>

        <div>
          <label>Breadth</label>
          <span className="cd-command-bar__value cd-mono">{loading ? "—" : data.breadth}</span>
        </div>

        <div>
          <label>Volatility</label>
          <span className="cd-command-bar__value">{loading ? "—" : data.volatility}</span>
        </div>

        <div>
          <label>
            <Shield className="inline h-3 w-3 mr-1 opacity-50" aria-hidden />
            Watch state
          </label>
          {loading ? (
            <LoadingSkeleton height="1.5rem" width="8rem" />
          ) : (
            <Badge tone="danger" pulse>
              {data.watchState}
            </Badge>
          )}
        </div>

        {data.stats.map((stat) => (
          <div key={stat.label}>
            <label>{stat.label}</label>
            {loading ? (
              <LoadingSkeleton height="1.25rem" width="5rem" />
            ) : (
              <span className={`cd-command-bar__value cd-mono ${toneClass(stat.tone)}`}>
                {stat.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
