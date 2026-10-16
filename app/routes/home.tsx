import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Dashboard · TA Load Distribution" }];
}

export default function Home() {
  return <h1 className="text-3xl font-semibold md:text-4xl">Dashboard</h1>;
}
