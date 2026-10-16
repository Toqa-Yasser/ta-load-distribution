import { action } from "~/routes/api.history";
const post = (body: unknown) => action({ request: new Request("http://x/api/history", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), params: {}, context: {} } as any);
test("deleteHistory with wrong password is 403", async () => {
  process.env.HISTORY_DELETE_PASSWORD = "secret";
  const res = await post({ intent: "deleteHistory", password: "nope" });
  expect(res.status).toBe(403);
});
test("snapshot then rollback", async () => {
  const s = await (await post({ intent: "snapshot", name: "Before exam" })).json();
  const r = await (await post({ intent: "rollback", snapshotId: s.snapshotId })).json();
  expect(r.ok).toBe(true);
});
