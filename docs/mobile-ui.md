# Mobile interface

The mobile layout applies at widths up to 820px and on devices whose primary
pointer is touch, including phone landscape. `app/use-mobile-layout.ts` and the mobile
section of `80-accessibility-motion-responsive.css` share that breakpoint.

During play, the canvas fills the dynamic viewport. A narrow status bar shows
the shift timer (or Free Run), earned fare, and Menu. One route strip shows the
next instruction and destination; tapping it pauses play and opens the full
regional map. The compact map is not mounted on mobile.

The steering thumb can start anywhere on the playfield and keeps control when
the other thumb presses a pedal. Gas and brake/reverse sit at opposite bottom
corners. Pedal drags can also steer when used alone. Double-tap and hold gas for
arcade boost, or brake for the simulation parking brake. On foot, a direction
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
