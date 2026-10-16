import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [{ title: "TA Load Distribution" }];
}

export default function Home() {
  return <main className="p-8 font-sans">TA Load Distribution</main>;
}
