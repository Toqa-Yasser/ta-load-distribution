import { action } from "~/routes/api.history";
import { action as command } from "~/routes/api.command";
import { getStore } from "~/server/store.server";
import { loadWorkspace } from "~/server/workspace.server";

const req = (path: string, body: unknown) => ({
  request: new Request(`http://x${path}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
  params: {},
  context: {},
}) as any;
const post = (body: unknown) => action(req("/api/history", body));
const names = async () => (await loadWorkspace(getStore())).data.tas.map((t) => t.name);

test("deleteHistory with wrong password is 403", async () => {
  process.env.HISTORY_DELETE_PASSWORD = "secret";
  const res = await post({ intent: "deleteHistory", password: "nope" });
  expect(res.status).toBe(403);
  expect(await res.json()).toMatchObject({ ok: false, message: "Wrong password.", code: "FORBIDDEN" });
});

test("snapshot then rollback restores the snapshot's workspace", async () => {
  const s = await (await post({ intent: "snapshot", name: "Before exam" })).json();
  expect(s).toMatchObject({ ok: true, snapshotId: expect.any(Number) });
  const before = await names();
  const added = await command(req("/api/command", { command: { type: "addTA", name: "After snapshot" } }));
  expect(added.status).toBe(200);
  expect(await names()).toContain("After snapshot");

  const res = await post({ intent: "rollback", snapshotId: s.snapshotId });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, version: expect.any(Number), snapshotId: expect.any(Number) });
  expect(await names()).toEqual(before);
});

test("rollback to a missing snapshot is 404; a blank snapshot name is 400", async () => {
  expect((await post({ intent: "rollback", snapshotId: 999999 })).status).toBe(404);
  expect((await post({ intent: "snapshot", name: "  " })).status).toBe(400);
  expect((await post({ intent: "nope" })).status).toBe(400);
});
