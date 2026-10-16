// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { useRetained } from "~/lib/retain";

test("useRetained returns the value, then the last non-null value once it goes null", () => {
  const { result, rerender } = renderHook(({ v }: { v: string | null }) => useRetained(v), { initialProps: { v: null as string | null } });
  expect(result.current).toBeNull();
  rerender({ v: "a" });
  expect(result.current).toBe("a");
  rerender({ v: null });
  expect(result.current).toBe("a");
  rerender({ v: "b" });
  expect(result.current).toBe("b");
  rerender({ v: undefined as unknown as null });
  expect(result.current).toBe("b");
});
