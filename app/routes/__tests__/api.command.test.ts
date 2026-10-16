import { action } from "~/routes/api.command";
const post = (body: unknown) => action({ request: new Request("http://x/api/command", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), params: {}, context: {} } as any);
test("applies a command and returns the snapshot id and label", async () => {
  const res = await post({ command: { type: "addTA", name: "Ahmed" } });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, label: 'Added TA "Ahmed"', snapshotId: expect.any(Number) });
});
test("api.command returns 400 with the error message", async () => {
  const res = await post({ command: { type: "createTask", kind: "light", title: "X", schedule: { type: "one-time", date: "2026-10-01" } } });
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ ok: false, message: "Assign sections to at least one TA first." });
});
test("rejects a malformed command with 400", async () => {
  for (const body of [{}, { command: null }, { command: "addTA" }, { command: { name: "x" } }, { command: { type: 7 } }]) {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, message: "Invalid command." });
  }
  // A known type with malformed fields: describe() hits `undefined.trim()` (a TypeError).
  const res = await post({ command: { type: "renameTA", taId: "nope" } });
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ ok: false, message: "Invalid command." });
});
test("api.command returns 500 JSON on unexpected errors", async () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const store = await import("~/server/store.server");
  const get = vi.spyOn(store, "getStore").mockImplementation(() => { throw new Error("db down"); });
  const res = await post({ command: { type: "addTA", name: "B" } });
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ ok: false, message: "Something went wrong on the server. Please try again." });
  expect(spy).toHaveBeenCalled();
  get.mockRestore();
  spy.mockRestore();
});
test("api.command rejects createTask without a valid kind (400)", async () => {
  const schedule = { type: "one-time", date: "2026-10-01" };
  for (const kind of [undefined, null, "medium", 1]) {
    const res = await post({ command: { type: "createTask", title: "X", schedule, ...(kind === undefined ? {} : { kind }) } });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, message: "Invalid command.", code: "BAD_REQUEST" });
  }
});
