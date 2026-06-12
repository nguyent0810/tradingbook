"use client";

import type { ReactNode } from "react";
import type { DashboardV3ViewModel } from "@/lib/dashboard/dashboard-v3-view-model";
import { ErrorStateWithEvidence } from "@/components/ui/error-state-with-evidence";
import { DashboardLayout } from "./DashboardLayout";

type Props = {
  viewModel: DashboardV3ViewModel;
  header?: ReactNode;
  loading?: boolean;
};

export function CommandDeckDashboard({ viewModel, header, loading = false }: Props) {
  return (
    <DashboardLayout
      viewModel={viewModel}
      header={
        <>
          {header}
          {viewModel.partialError ? (
            <div className="mb-4">
              <ErrorStateWithEvidence
                title="Partial dashboard data unavailable"
                message={viewModel.partialError}
                evidence="Some sections may be empty until the database is reachable."
                data-testid="dashboard-cyber-db-load-error"
              />
            </div>
          ) : null}
        </>
      }
      loading={loading}
    />
  );
}
