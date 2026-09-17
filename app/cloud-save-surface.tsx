"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { useCareer } from "./use-career";
import { CloudSavePanel } from "./cloud-save-panel";
import { useCloudCareer, type CloudCareerApi } from "./use-cloud-career";

/**
 * The account session has to outlive the menu. Owning the hook inside the menu
 * would tear it down the moment a run starts, so a banked run would never reach
 * the account and the player would have to reconnect after every shift. The
 * provider sits above every mode; only the panel moves with the screen.
 */
const CloudCareerContext = createContext<CloudCareerApi | null>(null);

export function CloudCareerProvider({ career, children }: Readonly<{
  career: ReturnType<typeof useCareer>;
  children: ReactNode;
}>) {
  const cloud = useCloudCareer({
    career: career.career,
    careerRef: career.careerRef,
    ready: career.ready,
    replaceCareer: career.replaceCareer,
  });
  return <CloudCareerContext.Provider value={cloud}>{children}</CloudCareerContext.Provider>;
}

/** Draws the panel where a screen wants it, without owning the session. */
export function CloudSaveSurface() {
  const cloud = useContext(CloudCareerContext);
  return cloud ? <CloudSavePanel cloud={cloud} /> : null;
}
