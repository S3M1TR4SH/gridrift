# Data safety draft

Draft only. Nothing in `store/` is submitted to Google Play.

Play's definition of collected data is data that leaves the device.

## Collected data

No, in the shell as shipped.

| Category | Collected | Shared | Why |
| --- | --- | --- | --- |
| Location | No | No | The shell does not request location. |
| Personal info | No | No | There is no account. |
| Financial info | No | No | There are no purchases. |
| App activity | No | No | Analytics stays in memory until a provider adapter is passed in, and the default tracker does not transmit. |
| Device or other ids | No | No | The AdMob bridge is a no-op and does not read an advertising id. |

## Data stored only on the device

The age answer, if the game asks it, stays in local storage. Under 13 forces ads and analytics off. Update this draft before enabling H5 Games Ads or a synchronous AdMob bridge.
