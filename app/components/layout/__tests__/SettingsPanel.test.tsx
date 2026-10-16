// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { createRoutesStub } from "react-router";
import { CommandToasts } from "~/components/layout/CommandToasts";
import { SettingsPanel } from "~/components/layout/SettingsPanel";
import { Toaster } from "~/components/ui/Toast";
import { emptyWorkspace } from "~/engine/empty";
import type { Workspace } from "~/engine/types";
import { ThemeProvider } from "~/lib/theme";
import { ToastProvider } from "~/lib/toast";

vi.mock("motion/react", async (orig) => ({
  ...(await orig<typeof import("motion/react")>()),
  useReducedMotion: () => true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

let ws: Workspace = emptyWorkspace();
vi.mock("~/lib/use-workspace", () => ({ useWorkspace: () => ({ workspace: ws, today: "2026-10-17", taById: new Map() }) }));

beforeEach(() => {
  ws = emptyWorkspace();
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});

function Harness({ initiallyOpen = true, onClose }: { initiallyOpen?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [, tick] = useState(0);
  return (
    <CommandToasts>
      <button type="button" onClick={() => setOpen(true)}>open settings</button>
      <button type="button" onClick={() => tick((n) => n + 1)}>rerender</button>
      <SettingsPanel open={open} onClose={() => { onClose?.(); setOpen(false); }} />
    </CommandToasts>
  );
}

function setup(action: () => Promise<unknown> = async () => ({ ok: true, version: 2, snapshotId: 1, label: "Done" }), props = {}) {
  const spy = vi.fn(action);
  const Stub = createRoutesStub([
    { path: "/", Component: () => <Harness {...props} /> },
    { path: "/api/command", action: spy },
  ]);
  render(
    <ThemeProvider>
      <ToastProvider>
        <Stub initialEntries={["/"]} />
        <Toaster />
      </ToastProvider>
    </ThemeProvider>,
  );
  return spy;
}

test("Appearance is a group of native radio inputs", async () => {
  setup();
  const group = await screen.findByRole("radiogroup", { name: "Theme" });
  const radios = within(group).getAllByRole("radio") as HTMLInputElement[];
  expect(radios.map((r) => r.tagName)).toEqual(["INPUT", "INPUT", "INPUT"]);
  expect(radios.every((r) => r.type === "radio" && r.name === radios[0].name)).toBe(true);
  expect(within(group).getByRole("radio", { name: "System" })).toBeChecked();
  // One tab stop for the group: the labels themselves are not focusable.
  expect(group.querySelectorAll("label[tabindex]")).toHaveLength(0);
  fireEvent.click(within(group).getByRole("radio", { name: "Dark" }));
  expect(within(group).getByRole("radio", { name: "Dark" })).toBeChecked();
  expect(document.documentElement.dataset.theme).toBe("dark");
});

test("an end date before the start is flagged and blocks Save", async () => {
  setup();
  const end = await screen.findByLabelText("End");
  fireEvent.change(end, { target: { value: "2026-08-01" } });
  expect(screen.getByText("The end date must be on or after the start date.")).toBeInTheDocument();
  expect(end).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("button", { name: "Save semester" })).toBeDisabled();
});

test("a blank name or an unchanged semester cannot be saved", async () => {
  setup();
  const save = await screen.findByRole("button", { name: "Save semester" });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "   " } });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Fall" } });
  expect(save).toBeEnabled();
});

test("the draft is not overwritten by new data while the panel is open", async () => {
  setup();
  fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "My draft" } });
  ws = { ...ws, semester: { ...ws.semester, name: "Changed elsewhere" } };
  fireEvent.click(screen.getByRole("button", { name: "rerender", hidden: true }));
  expect(screen.getByLabelText("Name")).toHaveValue("My draft");
});

test("reopening the panel re-seeds the draft from the saved semester", async () => {
  setup();
  fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Discarded" } });
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  ws = { ...ws, semester: { ...ws.semester, name: "Saved" } };
  fireEvent.click(screen.getByRole("button", { name: "open settings" }));
  expect(await screen.findByLabelText("Name")).toHaveValue("Saved");
});

test("the Save spinner belongs to the semester form, not to the danger actions", async () => {
  let resolve!: (v: unknown) => void;
  setup(() => new Promise((r) => (resolve = r)));
  fireEvent.click(await screen.findByRole("button", { name: "Redistribute everything" }));
  fireEvent.click(await screen.findByRole("button", { name: "Redistribute" }));
  await act(() => new Promise((r) => setTimeout(r, 20)));
  fireEvent.click(screen.getByRole("button", { name: "open settings", hidden: true }));
  fireEvent.change(await screen.findByLabelText("Name"), { target: { value: "Fall" } });
  expect(screen.getByRole("button", { name: "Save semester" })).not.toHaveAttribute("aria-busy");
  await act(async () => resolve({ ok: true, version: 2, snapshotId: 1, label: "Done" }));
});

test.each([
  ["Redistribute everything", "Redistribute", "redistributeAll"],
  ["Reset everything", "Reset everything", "reset"],
])("%s: confirming submits the command and closes the panel", async (row, confirmLabel, type) => {
  const onClose = vi.fn();
  let body: { command?: { type: string } } = {};
  const spy = setup(async () => ({ ok: true, version: 2, snapshotId: 1, label: "Done" }), { onClose });
  spy.mockImplementation((async ({ request }: { request: Request }) => {
    body = await request.json();
    return { ok: true, version: 2, snapshotId: 1, label: "Done" };
  }) as never);
  fireEvent.click(await screen.findByRole("button", { name: row }));
  const dialog = await screen.findByRole("dialog", { name: `${row}?` });
  fireEvent.click(within(dialog).getByRole("button", { name: confirmLabel }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(body.command?.type).toBe(type));
  expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
});
