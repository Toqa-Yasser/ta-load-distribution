import { createContext, useContext } from "react";

/** Opens the settings panel; provided by AppShell so the header (or any page) can open it. */
export const OpenSettingsContext = createContext<() => void>(() => {});

export const useOpenSettings = () => useContext(OpenSettingsContext);
