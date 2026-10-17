import routes from "~/routes";
import { loader } from "~/routes/well-known.devtools";

test("the Chrome DevTools probe gets an empty 204 instead of a 404", async () => {
  const res = await loader();
  expect(res.status).toBe(204);
  expect(await res.text()).toBe("");
});

test("the route is registered for the exact probe path", () => {
  expect(routes).toContainEqual(
    expect.objectContaining({ path: ".well-known/appspecific/com.chrome.devtools.json", file: "routes/well-known.devtools.tsx" }),
  );
});
