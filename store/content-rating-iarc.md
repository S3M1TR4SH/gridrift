# Content rating draft (IARC)

Draft only. Nothing in `store/` is submitted to Google Play. These are the answers a person would enter in the Play Console questionnaire. They describe the current build.

## Violence

Does the app contain violence? No.

No cartoon, fantasy, realistic, or sexual violence. No blood, gore, or death of characters. Pieces disappear when a row or column is full.

## Fear

Does the app contain scary content? No.

## Sexuality

Does the app contain sexual content or nudity? No.

## Language

Does the app contain profanity or crude humor? No.

The interface uses short labels such as "How old are you?", "Kid mode", and "No moves left".

## Controlled substances

Does the app reference drugs, alcohol, or tobacco? No.

## Gambling

Does the app simulate gambling? No.

There are no wagers, loot boxes, random paid rewards, or casino mechanics. Scoring is from placing pieces and clearing lines.

## User interaction

Can users interact with each other? No.

There is no chat, no user profiles, no public content, and no sharing of personal information.

Does the app share the user's current location with other users? No.

## Online and purchases

Does the app let users purchase digital goods? No.

Does the app let users spend real money? No.

Unrestricted web access: the Android package is a Trusted Web Activity for one placeholder origin, `gridrift.vercel.app`. It is not a general browser. Replace that host before shipping. The page itself does not embed a browser to arbitrary sites.

## Ads

Does the app contain advertising? No third-party advertising.

The web build can show a placeholder screen that says it does not contact an ad network. The AdMob adapter is a no-op without a native bridge, and the Android project does not include the Mobile Ads SDK. Change this answer before submission if a real ad tag is added.

## Audience

Under-13 players can launch the puzzle. The age gate stores that band on the device and disables ads and analytics for them. Treat the target audience as a general audience that includes children. Do not mark the app "not designed for children" while that path exists. Do not enroll it in a Families program from this draft. A reviewer still has to check Families policy before distribution.

## Miscellaneous

- Shares precise location: No.
- Digital purchases: No.
- User-generated content: No.
- Official government, news, or educational product: No.
