import { Badge } from "~/components/ui/Badge";
import { KIND_LABEL, type TaskKind } from "~/engine/types";

/** "Light" / "Heavy" pill for a task's kind. */
export function KindBadge({ kind, size = "md" }: { kind: TaskKind; size?: "sm" | "md" }) {
  return (
    <Badge tone={kind} size={size}>
      {KIND_LABEL[kind]}
    </Badge>
  );
}
