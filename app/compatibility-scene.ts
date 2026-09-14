import type { Camera, Game, NavigationPlan, WorldView } from "@/game/model";
import { isDriving, isInterior } from "@/game/player";
import { shouldRenderPlayerAvatar, shouldRenderTaxi } from "@/game/render/camera";
import { dynamicBoxes, playerAvatarBoxes, taxiBoxes, taxiGroundShadow } from "@/game/render/scene";
import { navigationArrowBoxes } from "@/game/render/navigation-glyph";
import { detailedTaxiSurfaces } from "@/game/render/detailed-vehicles";

/** The fallback draws the same actors, road pose and GPS as WebGPU. */
export function compatibilityScene(game: Game, camera: Camera, seconds: number, world: WorldView, navigation: NavigationPlan) {
  const playerMode = isInterior(game) ? "interior" : isDriving(game) ? "driving" : "walking";
  const showTaxi = shouldRenderTaxi(playerMode, camera.mode);
  const shadow = showTaxi ? taxiGroundShadow(game, camera.vehicleDetail === "detailed") : null;
  return {
    actors: [
      ...dynamicBoxes(game, seconds, navigation.route, world, { showPlayerAvatar: false }),
      ...(shadow ? [shadow] : []),
    ],
    focus: [
      ...(showTaxi ? taxiBoxes(game, { includeGroundShadow: false, includeBody: camera.vehicleDetail !== "detailed" }) : []),
      ...(shouldRenderPlayerAvatar(playerMode, camera.mode) ? playerAvatarBoxes(game, seconds) : []),
    ],
    focusSurfaces: showTaxi && camera.vehicleDetail === "detailed" ? detailedTaxiSurfaces(game) : [],
    navigation: navigationArrowBoxes(game, seconds, navigation, camera.mode),
  };
}

export type CompatibilityScene = ReturnType<typeof compatibilityScene>;
