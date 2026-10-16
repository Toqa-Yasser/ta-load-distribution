import type { Route } from "./+types/tasks";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Tasks · TA Load Distribution" }];
}

export default function Tasks() {
  return <h1 className="text-3xl font-semibold md:text-4xl">Tasks</h1>;
}
