# Data safety draft

Draft only. Nothing in `store/` is submitted to Google Play.

This form matches the code on this branch. The web game stores an age band on the device, keeps optional stats in memory, and does not transmit them. The Trusted Web Activity does not add an analytics SDK or the Google Mobile Ads SDK.

Play's definition of collected data is data that leaves the device. Answers below use that meaning.

## Collected data

No.

| Category | Collected | Shared | Why |
| --- | --- | --- | --- |
| Location | No | No | The tracker rejects latitude and longitude. The TWA does not request location. |
| Personal info (name, email, user ids, address, phone) | No | No | There is no account. The analytics schema rejects name and email. |
| Financial info | No | No | There are no purchases. |
| Health and fitness | No | No | Not used. |
| Messages | No | No | There is no chat. |
| Photos and videos | No | No | The game does not open the camera or gallery. |
| Audio files | No | No | Sounds are synthesized in the page. The microphone is not used. |
| Files and docs | No | No | Not used. |
| Calendar | No | No | Not used. |
| Contacts | No | No | Not used. |
| App activity | No | No | After an adult opts in, gameplay events can be held in memory. `transmit()` does not send them. |
| Web browsing | No | No | Not collected. |
| App info and performance | No | No | There is no crash or performance SDK. |
| Device or other ids | No | No | No advertising id, Android id, or analytics distinct id is read. The AdMob adapter does not run on the web. |

## Data stored only on the device

The age gate writes `studio-core.consent.v1` in `localStorage`. The record stores the birth year on the device, plus whether analytics and ads are allowed. Players under 13 get non-personalized test ads only: H5 requests set non-personalized and child-directed, and AdMob requests set tagForChildDirectedTreatment, maxAdContentRating G, and npa. The build still uses Google's demo ad unit ids. Under 13 does not initialize Mixpanel, does not read a device id or an advertising id, and does not enable notifications. Loading the record again cannot turn analytics, notifications, or personalized ads back on.

That record is not copied off the device by this build. It does not need to be declared as collected data. It is listed here so the form is not filled from guesswork.

## Security and deletion

- Data is not transmitted, so encryption in transit is not applicable to a collection pipeline.
- Players can refuse analytics. Under-13 players are not asked.
- There is no account to delete.
- Declining analytics leaves `analyticsAllowed` false.

## Ads and children

- The page can show a local advertisement placeholder. It does not request an ad network.
- `studio-core/ads/admob` names only Google's published Android demo ad units and returns `bridge_unavailable` unless a native shell installed `__studioAdsBridge`. The TWA does not install that bridge and does not depend on `play-services-ads`.
- Players under 13 can be shown non-personalized ads only. They get no analytics. The adapters do not transmit a device id or an advertising id, and notifications stay off.

## Before submission

If a later change actually sends analytics or loads an ad tag, stop and rewrite this draft first. In particular, the open Mixpanel pull request would start sending anonymous gameplay events after an adult opts in. That is app activity collected by a service provider, still without name, email, or precise location. Do not submit these answers unchanged after that code is merged.
