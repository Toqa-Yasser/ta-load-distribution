import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("team", "routes/team.tsx"),
  route("tasks", "routes/tasks.tsx"),
  route("tasks/:taskId", "routes/task-detail.tsx"),
  route("calendar", "routes/calendar.tsx"),
  route("history", "routes/history.tsx"),
  route("api/command", "routes/api.command.tsx"),
  route("api/preview", "routes/api.preview.tsx"),
  route("api/history", "routes/api.history.tsx"),
] satisfies RouteConfig;
