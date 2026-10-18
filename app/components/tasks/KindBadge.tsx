import { Badge } from "~/components/ui/Badge";
import { KIND_LABEL, type TaskKind } from "~/engine/types";

/** Kind marker colour (a Tailwind background class), shared by the calendar dot and the dashboard strip. */
export const KIND_DOT: Record<TaskKind, string> = { light: "bg-light", heavy: "bg-heavy", equal: "bg-equal" };

/** "Light" / "Heavy" / "Equal" pill for a task's kind. */
export function KindBadge({ kind, size = "md" }: { kind: TaskKind; size?: "sm" | "md" }) {
  return (
    <Badge tone={kind} size={size}>
      {KIND_LABEL[kind]}
    </Badge>
  );
}
