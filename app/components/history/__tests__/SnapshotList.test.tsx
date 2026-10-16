// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { SnapshotList } from "~/components/history/SnapshotList";

test("renders labels and marks manual snapshots", () => {
  render(<SnapshotList currentVersion={3} onRollback={() => {}} snapshots={[
    { id: 2, name: "Before exam", label: 'Snapshot "Before exam"', kind: "manual", version: 2, createdAt: new Date().toISOString() },
    { id: 1, name: null, label: 'Added TA "A"', kind: "auto", version: 1, createdAt: new Date().toISOString() }]} />);
  expect(screen.getByText('Added TA "A"')).toBeInTheDocument();
  expect(screen.getByText("Before exam")).toBeInTheDocument();
});
