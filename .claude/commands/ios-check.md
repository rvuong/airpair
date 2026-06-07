Check iOS Safari compliance in the current proto code before testing on iPhone.

Grep the relevant source files in `proto/` (or `src/` if it exists) for the following. Report each item as ✅ found / ⚠️ missing / ❌ wrong:

1. `requestPermission` — DeviceOrientationEvent permission called inside a user gesture handler
2. `AudioContext` — created and `.resume()` called inside the same user gesture handler
3. `touch-action: none` — in CSS or inline style
4. `overscroll-behavior: none` — in CSS or inline style
5. `preventDefault` on touchmove — to block pull-to-refresh
6. `wakeLock` — navigator.wakeLock.request called
7. Landscape detection — screen orientation check with "tournez votre téléphone" fallback
8. Silent switch warning — visual warning to the user about the iOS mute button

For each missing item: one line explaining where to add it. No explanations for items that are present.
