import { useDraggable } from "@dnd-kit/core";
import { motion } from "motion/react";
import type { TA } from "~/engine/types";
import { usePressMotion } from "~/lib/motion";

type TAChipProps = {
  ta: TA;
  capacity: number;
  /** Defaults to true. False renders a static chip (used for the DragOverlay clone). */
  draggable?: boolean;
  /** Tap without dragging (a drag suppresses the click). */
  onClick?: () => void;
};

const CHIP =
  "flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-left text-ink";

function ChipFace({ ta, capacity }: { ta: TA; capacity: number }) {
  return (
    <>
      <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: ta.color }} />
      <span className="min-w-0 flex-1 truncate font-medium">{ta.name}</span>
      <span
        title={`Capacity ${capacity}`}
        className="grid min-w-7 place-items-center rounded-lg bg-ink/5 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-muted"
      >
        <span className="sr-only">capacity </span>
        {capacity}
      </span>
    </>
  );
}

function DraggableChip({ ta, capacity, onClick }: Omit<TAChipProps, "draggable">) {
  const press = usePressMotion();
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: ta.id });
  return (
    <motion.button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      whileHover={press.whileHover}
      whileTap={press.whileTap}
      onClick={onClick}
      // The DragOverlay follows the pointer; the source stays put (dimmed) so the list doesn't jump.
      className={`${CHIP} cursor-grab touch-manipulation transition-[opacity,box-shadow] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <ChipFace ta={ta} capacity={capacity} />
    </motion.button>
  );
}

export function TAChip({ ta, capacity, draggable = true, onClick }: TAChipProps) {
  if (draggable) return <DraggableChip ta={ta} capacity={capacity} onClick={onClick} />;
  return (
    <div className={`${CHIP} cursor-grabbing shadow-xl ring-2 ring-accent/40`}>
      <ChipFace ta={ta} capacity={capacity} />
    </div>
  );
}
