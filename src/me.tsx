import { createContext, useContext, type ReactNode } from "react";
import type { Me } from "../shared/types";
import { useApi } from "./api";

type Ctx = { me: Me | null; reloadMe: () => Promise<void> };
const MeContext = createContext<Ctx>({ me: null, reloadMe: async () => {} });

export function MeProvider({ children }: { children: ReactNode }) {
  const { data, reload } = useApi<Me>("/me");
  return <MeContext.Provider value={{ me: data, reloadMe: reload }}>{children}</MeContext.Provider>;
}

export const useMe = () => useContext(MeContext);
