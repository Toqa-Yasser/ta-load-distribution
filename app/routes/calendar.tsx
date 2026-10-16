import type { Route } from "./+types/calendar";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Calendar · TA Load Distribution" }];
}

export default function Calendar() {
  return <h1 className="text-3xl font-semibold md:text-4xl">Calendar</h1>;
}
