import { useFetchers, useNavigation } from "react-router";

/** True while a navigation is in flight or any fetcher (command, undo, preview) is not idle. */
export function usePendingGlobal(): boolean {
  const navigation = useNavigation();
  const fetchers = useFetchers();
  return navigation.state !== "idle" || fetchers.some((f) => f.state !== "idle");
}
