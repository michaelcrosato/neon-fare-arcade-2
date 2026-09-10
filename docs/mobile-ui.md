# Mobile interface

The mobile layout applies at widths up to 820px and on devices whose primary
pointer is touch, including phone landscape. `app/use-mobile-layout.ts` and the mobile
section of `80-accessibility-motion-responsive.css` share that breakpoint.

During play, the canvas fills the dynamic viewport. A narrow status bar shows
the shift timer (or Free Run), destination distance, earned fare, and Menu.
The full regional map opens from Menu. The compact map is not mounted on mobile.

The steering thumb can start anywhere on the playfield; its initial point is
neutral and a floating indicator follows proportional horizontal movement.
Releasing it centers steering. Gas and brake/reverse stay on the right, stacked
in portrait and side by side in phone landscape. Pedal drags never steer,
including when dragged off their buttons. Steering and pedals work together.
The left-thumb guide and pedal labels appear during countdown, before input
unlocks, and stay visible in play. The guide fades during nonzero thumb steering
and returns at center or release. Double-tap and hold gas for arcade boost, or
brake for the simulation parking brake. Below 10 km/h, a yellow EXIT TAXI action
tracks the driver’s door using the shared world projection. Cab View keeps it
on the driver’s side because the exterior door is behind the camera.
On foot, a direction
pad replaces steering and the right controls become run, crouch, and jump. The
nearby interaction appears above the controls in portrait and between them in
landscape. Touch targets are at least 44px and account for display safe areas.
Pointer cancellation/lost capture and resizing release held controls; opening a panel
clears game input through the existing pause lifecycle.

Camera selection, audio, score, dispatch, and fare history live in the pause
screen. Fare history and driver handling details expand when requested.
Passenger and courier milestones use small notices instead of full-screen
impact cards. The passenger's rating bubble remains attached to their position.

Maps and service dialogs use the full mobile viewport. The route planner keeps
its map and confirmation visible together: vertically in portrait, side by side
in landscape. Dispatch can be changed from Menu rather than another control in
the mobile map. Desktop panels and keyboard shortcuts keep their existing flow.

`tests/browser/mobile-ui.spec.ts` checks narrow/portrait/landscape play, map
selection, camera and sound settings, walking controls, simultaneous touch and
cancellation, and long/urgent fare, courier, and simulation HUD states. Regional
renderer tests continue to cover the world and camera paths independently.
