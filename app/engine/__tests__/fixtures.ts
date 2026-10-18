import { reduce, testContext } from "~/engine/reducer";
import { emptyWorkspace } from "~/engine/empty";
import type { Command, Workspace } from "~/engine/types";

export const ctx = testContext();
export const run = (cmds: Command[], ws = emptyWorkspace()) => cmds.reduce((w, c) => reduce(w, c, ctx), ws);

export function team() {   // A1 B2 C2 D3 via 4 sections
  let ws = run([..."ABCD"].map(n => ({ type: "addTA", name: n }) as Command));
  const id = (n: string) => ws.tas.find(t => t.name === n)!.id;
  const pairs: [string, string][] = [["A", "B"], ["B", "C"], ["C", "D"], ["D", "D"]];
  pairs.forEach((p, i) => {
    ws = reduce(ws, { type: "addSection", name: `S${i + 1}` }, ctx);
    const sec = ws.sections[i];
    ws = reduce(ws, { type: "setSectionSlot", sectionId: sec.id, slot: 0, taId: id(p[0]) }, ctx);
    ws = reduce(ws, { type: "setSectionSlot", sectionId: sec.id, slot: 1, taId: id(p[1]) }, ctx);
  });
  return { ws, id };
}

/** team() plus a fifth TA "E" with no sections. */
export function teamWithE() {
  const ws = reduce(team().ws, { type: "addTA", name: "E" }, ctx);
  const id = (n: string) => ws.tas.find(t => t.name === n)!.id;
  return { ws, id };
}

/** An Equal task dealt daily from 2026-10-01 over `days` dates. */
export function equalDaily(ws: Workspace, order: string[], days: number, title = "Duty", taCount = 1): Workspace {
  const end = `2026-10-${String(days).padStart(2, "0")}`;
  return reduce(ws, { type: "createTask", kind: "equal", title, taCount, taOrder: order, schedule: { type: "daily", start: "2026-10-01", end } }, ctx);
}
