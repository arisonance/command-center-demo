"use client";
import { PowerBIReports } from "@/components/command-center/PowerBIReports";
import { PowerBIKPIs } from "@/components/command-center/PowerBIKPIs";

export function MetricsView() {
  return (
    <div className="space-y-5">
      <PowerBIKPIs />
      <PowerBIReports />
    </div>
  );
}
