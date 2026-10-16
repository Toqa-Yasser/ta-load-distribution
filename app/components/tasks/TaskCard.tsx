import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { Button } from "~/components/ui/Button";
import { Card } from "~/components/ui/Card";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import type { Task } from "~/engine/types";
import { fmtScheduleSummary, plural } from "~/lib/format";
import { EASE_OUT, usePressMotion } from "~/lib/motion";
import { useWorkspace } from "~/lib/use-workspace";
import { KindBadge } from "./KindBadge";
import { SplitBar } from "./SplitBar";

type TaskCardProps = { task: Task; onRedistribute: () => void; onDelete: () => void };

const MENU_ITEM =
  "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-accent";

/** Task summary card; the whole card links to the task, the kebab menu (role=menu) offers Redistribute / Delete. */
export function TaskCard({ task, onRedistribute, onDelete }: TaskCardProps) {
  const { workspace } = useWorkspace();
  const press = usePressMotion();
  const reduced = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState<"redistribute" | "delete" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close the menu on an outside press.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [menuOpen]);

  // Opening moves focus to the first item.
  useEffect(() => {
    if (menuOpen) listRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [menuOpen]);

  const closeMenu = (refocus: boolean) => {
    setMenuOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  // WAI-ARIA menu keys: arrows wrap, Home/End jump, Escape closes back to the trigger, Tab leaves.
  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const to = (n: number) => {
      e.preventDefault();
      items[(n + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") to(i + 1);
    else if (e.key === "ArrowUp") to(i < 0 ? items.length - 1 : i - 1);
    else if (e.key === "Home") to(0);
    else if (e.key === "End") to(items.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeMenu(true);
    } else if (e.key === "Tab") setMenuOpen(false);
  };

  // Picking an item hands focus to the trigger first, so the dialog it opens returns focus there.
  const pick = (what: "redistribute" | "delete") => {
    closeMenu(true);
    setConfirming(what);
  };

  return (
    // Raised while the menu is open so it paints over the neighbouring cards.
    <div className={`relative h-full ${menuOpen ? "z-20" : ""}`}>
      <Card interactive className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 pt-1">
            {/* Stretched link: its ::after covers the card, so the whole card navigates. */}
            <Link
              to={`/tasks/${task.id}`}
              className="block truncate font-display text-lg font-semibold after:absolute after:inset-0 after:rounded-[20px] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-accent"
            >
              {task.title}
            </Link>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <KindBadge kind={task.kind} size="sm" />
              <p className="truncate text-sm text-muted">{fmtScheduleSummary(task.schedule)}</p>
            </div>
          </div>
          <div ref={menuRef} className="relative z-10">
            <Button
              ref={triggerRef}
              variant="ghost"
              icon
              aria-label={`Actions for ${task.title}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setMenuOpen(true);
                }
              }}
            >
              <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
                <circle cx="12" cy="5" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="12" cy="19" r="1.8" />
              </svg>
            </Button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  ref={listRef}
                  role="menu"
                  aria-label={`Actions for ${task.title}`}
                  onKeyDown={onMenuKeyDown}
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: reduced ? 0 : 0.15, ease: EASE_OUT }}
                  className="absolute right-0 top-12 w-44 origin-top-right rounded-xl border border-line bg-bg p-1 shadow-xl"
                >
                  <motion.button
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    whileTap={press.whileTap}
                    className={MENU_ITEM}
                    onClick={() => pick("redistribute")}
                  >
                    Redistribute
                  </motion.button>
                  <motion.button
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    whileTap={press.whileTap}
                    className={`${MENU_ITEM} text-danger-ink`}
                    onClick={() => pick("delete")}
                  >
                    Delete
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <p className="text-sm font-medium">{plural(task.occurrences.length, "occurrence", "occurrences")}</p>
          <SplitBar occurrences={task.occurrences} tas={workspace.tas} />
        </div>

        <ConfirmDialog
          open={confirming === "redistribute"}
          title="Redistribute task?"
          body="Deal this task out again? Its current assignments will change."
          confirmLabel="Redistribute"
          onConfirm={() => {
            setConfirming(null);
            onRedistribute();
          }}
          onClose={() => setConfirming(null)}
        />
        <ConfirmDialog
          open={confirming === "delete"}
          title="Delete task?"
          body={`"${task.title}" and its ${plural(task.occurrences.length, "occurrence", "occurrences")} will be removed.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            setConfirming(null);
            onDelete();
          }}
          onClose={() => setConfirming(null)}
        />
      </Card>
    </div>
  );
}
