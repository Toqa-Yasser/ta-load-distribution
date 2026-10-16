// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SnapshotList } from "~/components/history/SnapshotList";

test("renders labels and marks manual snapshots", () => {
  render(<SnapshotList currentVersion={3} onRollback={() => {}} snapshots={[
    { id: 2, name: "Before exam", label: 'Snapshot "Before exam"', kind: "manual", version: 2, createdAt: new Date().toISOString() },
    { id: 1, name: null, label: 'Added TA "A"', kind: "auto", version: 1, createdAt: new Date().toISOString() }]} />);
  expect(screen.getByText('Added TA "A"')).toBeInTheDocument();
  expect(screen.getByText("Before exam")).toBeInTheDocument();
});

const snaps = () => [
  { id: 2, name: "Before exam", label: 'Snapshot "Before exam"', kind: "manual" as const, version: 2, createdAt: new Date().toISOString() },
  { id: 1, name: null, label: 'Added TA "A"', kind: "auto" as const, version: 1, createdAt: new Date().toISOString() },
];

test("auto rows read as the state before their change", () => {
  render(<SnapshotList currentVersion={3} onRollback={() => {}} snapshots={snaps()} />);
  const items = screen.getAllByRole("listitem");
  expect(items[2]).toHaveTextContent('Before: Added TA "A"');
  expect(items[1]).not.toHaveTextContent("Before:");
});

test("rollback confirmation explains what is restored", async () => {
  render(<SnapshotList currentVersion={3} onRollback={() => {}} snapshots={snaps()} />);
  const [manualBtn, autoBtn] = screen.getAllByRole("button", { name: "Roll back" });
  fireEvent.click(autoBtn);
  expect(await screen.findByText('Restores the state from just before "Added TA "A"". The current state is saved first, so you can undo this.')).toBeInTheDocument();
  cleanup();
  render(<SnapshotList currentVersion={3} onRollback={() => {}} snapshots={snaps()} />);
  fireEvent.click(screen.getAllByRole("button", { name: "Roll back" })[0]);
  expect(await screen.findByText('Restores the snapshot "Before exam". The current state is saved first, so you can undo this.')).toBeInTheDocument();
  void manualBtn;
});
