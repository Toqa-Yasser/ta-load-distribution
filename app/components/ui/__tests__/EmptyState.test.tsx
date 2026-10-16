import { renderToString } from "react-dom/server";
import { EmptyState } from "~/components/ui/EmptyState";

test("server markup is visible: no opacity 0 and no pre-animation transform", () => {
  const html = renderToString(<EmptyState icon={<svg />} title="Nothing here" body="Add something" />);
  expect(html).toContain("Nothing here");
  expect(html).not.toMatch(/opacity:\s*0(?![.\d])/);
  expect(html).not.toMatch(/scale\(0\.8\)|translateY\(10px\)/);
});
