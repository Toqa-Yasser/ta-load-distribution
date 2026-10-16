import { action } from "~/routes/api.command";
const post = (body: unknown) => action({ request: new Request("http://x/api/command", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), params: {}, context: {} } as any);
test("applies a command and returns the snapshot id and label", async () => {
  const res = await post({ command: { type: "addTA", name: "Ahmed" } });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, label: 'Added TA "Ahmed"', snapshotId: expect.any(Number) });
});
test("api.command returns 400 with the error message", async () => {
  const res = await post({ command: { type: "createTask", title: "X", schedule: { type: "one-time", date: "2026-10-01" } } });
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ ok: false, message: "Assign sections to at least one TA first." });
});
