import { resolveDrop } from "~/components/team/resolveDrop";
import type { Section } from "~/engine/types";
const sections: Section[] = [
  { id: "sec_a:b", name: "S1", taIds: [null, "T1"] },
  { id: "s2", name: "S2", taIds: [null, null] },
];
test("parses `${sectionId}:${slot}` (section ids may contain colons)", () => {
  expect(resolveDrop("sec_a:b:0", "T1", sections)).toEqual({ sectionId: "sec_a:b", slot: 0, taId: "T1" });
  expect(resolveDrop("s2:1", "T2", sections)).toEqual({ sectionId: "s2", slot: 1, taId: "T2" });
});
test("rejects bad ids and slots", () => {
  expect(resolveDrop("s2", "T1", sections)).toBeNull();
  expect(resolveDrop("s2:2", "T1", sections)).toBeNull();
  expect(resolveDrop("s2:", "T1", sections)).toBeNull();
  expect(resolveDrop("missing:0", "T1", sections)).toBeNull();
});
test("returns null when the slot already holds the TA", () => {
  expect(resolveDrop("sec_a:b:1", "T1", sections)).toBeNull();
});
