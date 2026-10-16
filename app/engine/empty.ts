import type { Workspace } from "~/engine/types";

export function emptyWorkspace(): Workspace {
  return {
    semester: { name: "Semester", start: "2026-09-01", end: "2027-01-31" },
    tas: [],
    sections: [],
    tasks: [],
    ledger: { turn: 1, used: {} },
  };
}
