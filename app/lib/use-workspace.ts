import { useMemo } from "react";
import { useRouteLoaderData } from "react-router";
import { capacities as computeCapacities } from "~/engine/capacity";
import type { ISODate, TA, Workspace } from "~/engine/types";

export type RootLoaderData = { workspace: Workspace; version: number; today: ISODate };

export function useWorkspace(): {
  workspace: Workspace;
  version: number;
  today: ISODate;
  capacities: Record<string, number>;
  taById: Map<string, TA>;
} {
  const data = useRouteLoaderData("root") as RootLoaderData | undefined;
  if (!data) throw new Error("useWorkspace must be used under the root route.");
  const { workspace, version, today } = data;
  const capacities = useMemo(() => computeCapacities(workspace), [workspace]);
  const taById = useMemo(() => new Map(workspace.tas.map((t) => [t.id, t])), [workspace]);
  return { workspace, version, today, capacities, taById };
}
