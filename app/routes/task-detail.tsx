import type { Route } from "./+types/task-detail";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Task · TA Load Distribution" }];
}

export default function TaskDetail() {
  return <h1 className="text-3xl font-semibold md:text-4xl">Task</h1>;
}
