import { action } from "~/routes/api.preview";
import { getStore } from "~/server/store.server";
import { loadWorkspace } from "~/server/workspace.server";

const post = (body: unknown) =>
  action({ request: new Request("http://x/api/preview", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }), params: {}, context: {} } as any);

test("api.preview returns the resulting workspace without saving it", async () => {
  const before = await loadWorkspace(getStore());
  const snapshots = (await getStore().listSnapshots()).length;
  const res = await post({ command: { type: "addTA", name: "Preview Only" } });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.workspace.tas.map((t: { name: string }) => t.name)).toContain("Preview Only");
  const after = await loadWorkspace(getStore());
  expect(after.version).toBe(before.version);
  expect(after.data.tas.map((t) => t.name)).not.toContain("Preview Only");
  expect((await getStore().listSnapshots()).length).toBe(snapshots);
});

test("api.preview rejects a malformed command with 400", async () => {
  const res = await post({ command: { type: 7 } });
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ ok: false, message: "Invalid command." });
});
