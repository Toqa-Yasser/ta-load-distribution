import type { Route } from "./+types/team";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Team · TA Load Distribution" }];
}

export default function Team() {
  return <h1 className="text-3xl font-semibold md:text-4xl">Team</h1>;
}
