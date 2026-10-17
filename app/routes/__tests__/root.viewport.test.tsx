import { renderToString } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { VIEWPORT_CONTENT } from "~/lib/viewport";
import { Layout } from "~/root";

test("viewport meta includes interactive-widget=resizes-content", () => {
  expect(VIEWPORT_CONTENT).toBe("width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content");
});

test("the root layout renders it", () => {
  const Stub = createRoutesStub([{ path: "/", Component: () => <Layout><p>app</p></Layout> }]);
  const html = renderToString(<Stub />);
  expect(html).toContain(`<meta name="viewport" content="${VIEWPORT_CONTENT}"/>`);
});
