# Rest timer notifications — ClickUp z8t8qgnd04

Task: https://app.clickup.com/t/z8t8qgnd04

Status: **In Progress**. The agreed phone scope is Android first. The watch model is
undecided. ClickUp's daily MCP limit prevented reading the original task or writing its
status/description; apply the status and this summary manually. Do not mark Complete
until the device checks below pass and the platform limitations are accepted/resolved.

## Inspection and implementation

- React/Zustand inside Capacitor 7, with Android and iOS native shells. Android's existing
  minimum SDK is 23 and target SDK is 35. No dependency/version/minimum-SDK changes.
- `useUI` already kept an absolute rest deadline, but the mobile build had no native
  rest notification. The server Web Push endpoint was the only scheduled end alert;
  standalone mobile has no backend. The existing native LocalNotifications plugin
  schedules workout-day reminders (IDs 100–106), not rest alerts.
- A local Android `RestTimer` Capacitor plugin posts one silent countdown notification
  (ID 21001). Android System UI renders its chronometer, independent of WebView execution.
  It derives from the same `timer.endsAt` used by the app; its display offset compensates
  for Android's whole-second truncation to match the app's ceiling. Its alarm and timeout
  use the actual deadline. No background JS tick stream or foreground service is needed.
- Starting/adjusting another rest replaces that notification and its alarm. Skip,
  subtraction past zero, and starting a timed work set cancel it. Expiry replaces it with
  a single end-of-rest notification. Separate channels keep countdown updates silent and
  honor the sound setting captured at start/adjustment for the completion alert.
- Native completion is serialized and recorded so the alarm receiver and in-app expiry
  cannot both deliver an end alert. Android never also schedules the server rest push.
  If the completion bridge rejects after a successful native start, the app retains OS
  alert ownership and does not add a potentially duplicate WebAudio completion alert.
  Browser behavior keeps its existing server alert. Denied permission/plugin failure
  preserves the in-app timer and local foreground sound/vibration.
- Permission checks/native mutations are queued; stale starts are invalidated when a
  permission prompt returns after replacement or cancellation. Permission denial is not
  re-prompted automatically. No notification permission dialog appears merely at launch.
- Native preferences preserve the active deadline/total across process recreation. A
  cold launch restores an unexpired rest without rescheduling it or overwriting a timer
  already changed by the user. Visibility changes recompute remaining time from the
  deadline. Adjustments also recompute from the deadline instead of stale cached seconds.
- Rebuild the Android shell after `npm run build:mobile` / `npx cap sync android`; the
  bridge registration, manifest receiver and notification icon are native source changes.
  Existing `SCHEDULE_EXACT_ALARM` and plugin-provided `POST_NOTIFICATIONS` permissions
  are reused; the normal `VIBRATE` manifest permission is added for end-of-rest haptics
  (no runtime prompt). No package installation is required by this feature.

## Platform limits and remaining decisions

- Live notification countdown: **Android 7/API 24+**. Android 6/API 23 remains compatible
  and displays the finish time instead; this does **not** meet the live countdown criterion.
  Decide whether Android 6 needs a separate implementation or can be excluded from the
  countdown feature's support range before closing the task.
- Android 8/API 26+ has a notification timeout so the active countdown is removed at the
  deadline even if the completion receiver is delayed. Android 7 relies on alarm delivery
  for removal; test consecutive short timers and low-power behavior on that version if
  it is supported.
- Android 12+ exact alarm access is separate from notification permission and can be
  disabled (often disabled by default on recent installs). With access, the receiver uses
  `setExactAndAllowWhileIdle`; without access, it falls back to `setAndAllowWhileIdle`.
  The deadline does not drift, but **completion sound/update can arrive late**. Doze can
  also throttle frequent idle alarms. Precise completion timing under those conditions
  remains a device check/support decision; the implementation does not force a Settings
  dialog or claim precise delivery when the OS prohibits it.
- User channel settings, DND, lock-screen privacy and battery policies can suppress
  presentation/sound. Changing sound during a running rest takes effect on the next
  rest start/adjustment. Revoking notification permission during a rest preserves the
  workout; local foreground feedback remains available.
- Force-stop, reboot and wall-clock changes during a rest are outside the verified scope.
  This implementation does not reschedule alarms after reboot. Ordinary backgrounding,
  locking, and WebView process recreation are the intended scope.
- **iPhone is outside this Android-first implementation.** Its current rest notification
  behavior is unchanged. A live iPhone countdown requires an ActivityKit Live Activity
  plus WidgetKit extension, native bridge, availability fallback, signing and device tests;
  ordinary local notifications do not supply a continuously updating countdown.
- Browser/PWA notification countdown is not implemented. Browser end alerts remain.

## Smartwatch assessment

| Platform | Notification mirroring | Live countdown/native experience | Extra effort |
| --- | --- | --- | --- |
| Android phone + Wear OS | Phone notifications can bridge to a paired watch when permitted by companion/watch settings. Completion text/alert is the baseline candidate. | Do not assume the phone chronometer renders/ticks on every watch/OEM. Mirroring is not a watch app, complication, or independently running timer. New Wear OS Live Updates are a separate API/version path; this implementation uses an ordinary notification. | Test the target phone/watch pair and its bridge settings first. A guaranteed watch countdown/control surface needs a separately scoped Wear OS implementation and synchronization/lifecycle tests. |
| iPhone + Apple Watch | iPhone notifications can mirror, depending on app settings and which device is unlocked/in use; notifications generally appear on the phone or watch, not both. The Android feature cannot mirror through an iPhone. | Mirroring a completion alert does not establish a watch countdown. An iPhone Live Activity and any watch presentation/control need separate availability and device validation. A native watch app is a separate deliverable. | Implement the iPhone phone feature first; then test the selected watch/watchOS. Independently usable timer UI/actions require an agreed watchOS scope. |
| Other watches | Depends on vendor companion app, pairing and notification access. | No guaranteed live countdown from generic mirrored text. | Identify the model and vendor capabilities before estimating. |

**Open decision:** target watch model, OS/version and paired phone. No standalone watch
app, watch dependency, or watch build target has been added. Mirroring assessment is
supported by the official sources below; watch behavior has not been device-verified.

Sources:

- [Android notification chronometers](https://developer.android.com/reference/android/app/Notification.Builder)
- [Android alarm scheduling and restrictions](https://developer.android.com/develop/background-work/services/alarms)
- [Wear OS notification bridging](https://developer.android.com/training/wearables/notifications)
- [Wear OS bridging controls](https://developer.android.com/training/wearables/notifications/bridger)
- [Wear OS Live Updates](https://developer.android.com/training/wearables/notifications/live-updates)
- [Apple Watch notification routing](https://support.apple.com/en-ie/108369)
- [ActivityKit Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)

## Automated checks

- Frontend tests: **290 passed across 22 files**, including 20 new tests for timer deadline
  sharing, suspension, stale adjustments, replacement, Skip's React click event, permission
  denial, late permission prompts, mutation ordering, failure containment, native/server
  alert ownership (including bridge rejection after scheduling) and cold-launch restoration.
- Web production build: passed; existing chunk-size/dynamic-import warnings remain.
- `npm run build:mobile` and Capacitor sync: passed after final changes. iOS sync skipped
  CocoaPods/Xcode steps because those tools are not installed; iOS is outside agreed scope.
- Android SDK 35 debug APK: **built successfully** using JDK 21 and the unchanged
  Gradle/dependency versions. This environment's Build Tools 34 download failed; a
  `/tmp`-only Gradle init script selected installed Build Tools 35 for verification.
  Repository compile/target/min SDK remain 35/35/23. Recheck the default build once
  Build Tools 34 is available. An earlier auxiliary SDK 36 build also compiled successfully.
  Final artifact: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`.
  Its bundled JavaScript was checked against the final synced mobile assets and matches.
- Android lint: ran and reported **1 existing error and 22 warnings**. The error is
  `ProtectedPermissions` on the pre-existing `SCHEDULE_EXACT_ALARM` manifest declaration;
  there are no errors in the new timer code. Three new `ApplySharedPref` warnings refer
  to intentional synchronous writes of the tiny deadline/completion record so process
  recreation cannot lose timer/alert ownership. Other warnings concern existing resources
  and dependency versions. No lint baseline/suppression or unrelated resource fixes added.
- Physical phone/watch checks: **not performed**; results must be recorded below.
- `git diff --check`: passed. ADB listed no connected devices. The working tree was clean
  before this task and the resulting changes are limited to the timer/Android feature,
  tests and this note. No release/version/dependency changes were made.

## Physical-device checklist

Record phone model, Android/API version, app build, notification permission, exact-alarm
access and battery mode for each run. Use a second clock and record actual completion
times; compare app and notification at matching moments (allow the normal one-second
render boundary). Verify that there is only one completion sound/vibration.

- [ ] **Foreground:** Start a 60-second rest. Expand the notification shade; countdown
  matches the in-app deadline and does not sound on creation/updates. At expiry the
  active countdown clears/changes, the app clears rest, and one completion alert arrives.
  Tap the notification and confirm it opens the existing app instance.
- [ ] **Background:** Start 90 seconds, press Home, wait 30 seconds, inspect the countdown,
  reopen. Remaining time reflects elapsed time, with no reset. Repeat staying backgrounded
  beyond expiry; returning must not replay the end alert.
- [ ] **Locked screen:** Start 90 seconds and lock immediately. Inspect expanded lock-screen
  notification (enable notification content if hidden by privacy settings). Keep locked
  through expiry and confirm cleanup and a single end alert. Unlock and verify app state.
- [ ] **Cancellation:** Skip a rest in-app, then lock/background and wait beyond the original
  deadline: no timer or end alert remains. Repeat by subtracting past zero and by starting
  a timed work set. Repeat cancelling while the first permission prompt is open.
- [ ] **Consecutive timers:** Start 90 seconds, replace with 30 seconds before expiry. Only
  one active notification exists and only the new deadline alerts. Repeat near expiry and
  after a completed timer; the previous deadline must not alert again.
- [ ] **Adjustments:** Add/subtract 15 seconds repeatedly, including immediately after a
  long background interval. App and notification use the revised deadline, and old alarms
  do not fire. Notification replacement stays silent.
- [ ] **Permission denied/revoked:** Deny the first prompt; workouts and app countdown still
  work, with local foreground end feedback. No crash/repeated prompt. Enable notifications
  in Android Settings, start another rest and verify it posts. Revoke mid-rest and repeat.
- [ ] **Sound and channels:** Test sound on/off and DND/channel suppression. Countdown is
  always silent; completion respects captured sound choice and OS settings. Confirm no
  simultaneous native/server/WebAudio end alerts on resume.
- [ ] **Exact alarms / battery:** Repeat background/lock/consecutive tests with exact-alarm
  access on and off, Battery Saver and Doze. Record any completion latency. Android 8+
  countdown must disappear at its deadline even if the inexact completion alert is late.
- [ ] **Process recreation:** Background an active rest and allow/induce process reclamation
  without force-stopping the package. Reopen before expiry: restore the original deadline
  and total without rescheduling, resetting, or replaying an alert.
- [ ] **Older Android:** On API 24/25 verify countdown and idle cleanup; on API 23 confirm
  the documented finish-time fallback and record the support decision.
- [ ] **Watch (after model selection):** Confirm mirroring is enabled; test foreground,
  locked-phone and completion routing, cancellation/replacement, and whether the mirrored
  chronometer actually ticks. Record outcomes without treating mirroring as native support.

Remaining verification: the unchecked physical-device scenarios, Android 6 support
decision, exact-alarm/Doze completion behavior, watch selection, and a default-toolchain
build with Build Tools 34. Existing lint error is reported separately above.
