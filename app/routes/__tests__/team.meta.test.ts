import { meta } from "~/routes/team";

test("/team meta has its title, description and canonical from the root appUrl", () => {
  const matches = [{ id: "root", pathname: "/", params: {}, meta: [{ title: "TA Load Distribution" }], loaderData: { appUrl: "https://load.example.edu" } }];
  const tags = meta({ matches, params: {}, location: { pathname: "/team" }, loaderData: undefined } as never);
  expect(tags.filter((t) => "title" in t)).toEqual([{ title: "Team · TA Load Distribution" }]);
  expect(tags).toContainEqual({ name: "description", content: "Teaching assistants and the sections they teach." });
  expect(tags).toContainEqual({ tagName: "link", rel: "canonical", href: "https://load.example.edu/team" });
  expect(tags).toContainEqual({ property: "og:image", content: "https://load.example.edu/og.png" });
});
