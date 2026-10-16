import type { Route } from "./+types/history";

export function meta({}: Route.MetaArgs) {
  return [{ title: "History · TA Load Distribution" }];
}

export default function History() {
  return <h1 className="text-3xl font-semibold md:text-4xl">History</h1>;
}
