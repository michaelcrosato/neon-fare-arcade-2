import type { Camera, Game, NavigationPlan, WorldView } from "@/game/model";
import { isDriving, isInterior } from "@/game/player";
import { shouldRenderPlayerAvatar, shouldRenderTaxi } from "@/game/render/camera";
import { cabInteriorBoxes, dynamicBoxes, playerAvatarBoxes, taxiBoxes, taxiGroundShadow } from "@/game/render/scene";
import { navigationArrowBoxes } from "@/game/render/navigation-glyph";

/** The fallback draws the same actors, cockpit, road pose and GPS as WebGPU. */
export function compatibilityScene(game: Game, camera: Camera, seconds: number, world: WorldView, navigation: NavigationPlan) {
  const playerMode = isInterior(game) ? "interior" : isDriving(game) ? "driving" : "walking";
  const showTaxi = shouldRenderTaxi(playerMode, camera.mode);
  const shadow = showTaxi ? taxiGroundShadow(game) : null;
  return {
    actors: [
      ...dynamicBoxes(game, seconds, navigation.route, world, { showPlayerAvatar: false }),
      ...(playerMode === "driving" && camera.mode === "cab" ? cabInteriorBoxes(game) : []),
      ...(shadow ? [shadow] : []),
    ],
    focus: [
      ...(showTaxi ? taxiBoxes(game, { includeGroundShadow: false }) : []),
      ...(shouldRenderPlayerAvatar(playerMode, camera.mode) ? playerAvatarBoxes(game, seconds) : []),
    ],
    navigation: navigationArrowBoxes(game, seconds, navigation, camera.mode),
  };
}

export type CompatibilityScene = ReturnType<typeof compatibilityScene>;
