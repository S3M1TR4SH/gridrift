# Gridrift: What it takes to earn revenue (web/PWA ads)
Researched 2026-10-16. Sources are listed inline. **[EST]** marks an estimate or a third-party figure. "Not published" means I found no official number.

## 1. Google AdSense + H5 Games Ads (Ad Placement API), on your own site
- **Signup:** you need an approved AdSense account for a site you own. Then apply separately for H5 Games Ads through the form. Approval is "subject to partner eligibility" and not guaranteed. https://developers.google.com/ad-placement/docs/signup · https://adsense.google.com/start/h5-game-ads-apply/
- **Approval criteria:** you must own an H5 games website and follow AdSense and advertising policies (copyright, replicated content, ad-to-content ratio, ad placement, misrepresentation). https://adsense.google.com/intl/en_in/start/h5-games-ads/
- **Traffic minimum:** none published.
- **Integration and placement:** use `adBreak()` and `adConfig()`. Full-screen ads may run only at natural breaks such as start, between levels, or pause, never during gameplay. Google controls frequency. https://developers.google.com/ad-placement/apis · https://support.google.com/adsense/answer/9955214
- **Under-13 / EEA:** there is a `data-tag-for-under-age-of-consent` parameter (same page). COPPA child-directed treatment also applies if the site is aimed at kids.
- **Thresholds (USD):** ID verification at $0, which is required before ads serve. Address PIN at $10, and the PIN takes about 3 weeks by mail. Payment method at $10. Payout at $100, paid on the 21st–26th of the month. https://support.google.com/adsense/answer/1709871 · https://support.google.com/adsense/answer/157667
- **Tax:** US persons file a W-9. Non-US persons file a W-8BEN, or a W-8BEN-E for an entity. Submit by the 20th or the payment rolls to the next month. https://support.google.com/adsense/answer/10735961 · https://support.google.com/adsense/answer/2490070
- **Revenue share:** Google's standard publisher share. It isn't stated in the sources above.
- **Time to first payout:** you need to reach $100, which takes many months at low traffic **[EST]**.

## 2. CrazyGames
- **Signup:** a free developer account. Games start in Basic Launch and can move to Full Launch. **There is no revenue share in Basic Launch.** https://docs.crazygames.com/requirements/intro/
- **Eligibility for revenue share:** Full Launch, the CrazyGames SDK, ads only through the SDK, no other portal's branding, and an original game (Terms 5.3). The game must stay playable with AdBlock. https://files.crazygames.com/documents/developer_terms_20250818.pdf · https://docs.crazygames.com/faq/
- **Revenue share:** no fixed percentage. It's calculated monthly from users, ad performance and advertiser demand (Terms 5.4). The terms mention a +50% uplift if you opt in to an exclusivity option.
- **Payout:** €100 minimum, and smaller balances roll over. Paid through Tipalti by wire, ACH, eCheck or PayPal. The payouts page says NET 60 but "typically by the 10th of the following month". Payment onboarding (Tipalti tax and ID forms) has to be finished first. https://docs.crazygames.com/payouts/
- **eCPM:** not published. The ad guide is at https://docs.crazygames.com/resources/ad-monetization-guide/ **[EST]** One third party puts it at about €1.20 per 1,000 plays for simple HTML5 games (https://app.cinevva.com/guides/web-game-monetization).

## 3. Poki
- **Signup:** upload a build (prototypes are fine) and pass content moderation, then a 5-stage playtest journey. Poki curates which games it takes, judging quality, player fit, tech, mobile support and originality. Clones are not promoted. https://developers.poki.com/guide/adding-your-game · https://developers.poki.com/guide/what-we-look-for
- **Rules:** ads only through the Poki SDK, no in-app purchases, no reward-walling, no ad timers, and rewarded buttons can't be green. The game must work with an adblocker. https://developers.poki.com/guide/requirements-quality
- **Revenue share:** an exclusive web deal, by default 5 years. You keep 100% of revenue from players who come directly, and Poki-sourced players are split 50/50. A non-exclusive game, or one already on other portals, may get a one-time flat fee instead. https://developers.poki.com/guide/revenue-deal-types · https://sdk.poki.com/
- **Payout threshold and timing:** not published. Payment is by wire or PayPal **[third-party: https://portalready.world/portals/portal-payouts-compared/]**.
- **Note:** web exclusivity conflicts with putting the game on CrazyGames or GameDistribution. Choose before you distribute.

## 4. GameDistribution (Azerion)
- **Signup:** a developer account. The GD SDK is mandatory. https://portalready.world/portals/gamedistribution/ **[third-party summary]**
- **Revenue share:** 33% of Net Revenue. Net revenue is gross minus ad and hosting costs and invalid-traffic deductions (Terms 3.1). https://static.gamedistribution.com/terms/developer.html
- **Payout:** the terms say €100, paid within 60 days of the monthly report. The FAQ says €50 by PayPal and €100 by bank transfer. VAT and payment details are required. https://gamedistribution.com/developers/faq/general-questions/when-will-i-get-paid/
- **Pro:** wide syndication to many sites, with no curation bar published.

## 5. AdinPlay
- Ad network for browser-game sites. Signup is by contacting the team. Traffic minimum and payout terms are **not published officially**. https://adinplay.com/publishers · https://adinplay.com/contact/for-publishers
- **[Third-party, unverified]:** about 100k monthly pageviews and a $100 minimum (https://publishergrowth.com/software/adinplay). Realistically this comes after you have traffic.

## 6. Others
- **Playgama:** 50% of net revenue for portal and partner-network distribution. Partner-site distribution pays 70%, rising to 80% above $1k and 90% above $3k. $100 payout minimum, and smaller amounts carry forward. https://developer.playgama.com/terms · https://wiki.playgama.com/playgama/faq/payments-and-statistics
- **GameMonetize:** 45% to the developer, or 90% if you're also the publisher. $30 minimum, paid by PayPal or USDT, Net30 **[third-party: portalready.world payouts comparison above]**.
- **itch.io:** tips and pay-what-you-want sales rather than ads. You choose itch's cut (default 10%). $5 minimum in collected mode. The tax interview is required, with 30% default withholding if you have no valid TIN. https://itch.io/docs/creators/payments · https://itch.io/updates/updates-to-itchio-seller-accounts-payouts-tax-interview
- **Newgrounds, Armor Games, Y8, GamePix, Ezoic:** not researched in depth this pass, so I give no figures rather than guess. Armor Games and Y8 historically pay by license or sponsorship, and Ezoic needs your own site traffic **[unverified, check before relying on it]**.

## Cross-cutting rules
- **Invalid traffic:** never click your own ads or buy bot traffic. All networks deduct invalid traffic, and AdSense places holds or bans accounts for it.
- **Ads only at natural breaks.** Rewarded ads must be opt-in, and on portals only the portal's SDK may show ads.
- **COPPA:** don't make Gridrift child-directed unless you mean to, since that cuts eCPM through non-personalized ads **[EST]**. Tag EEA/UK under-age requests if needed.
- **Tax:** US persons file a W-9. Non-US persons file a W-8BEN or W-8BEN-E, with a TIN to claim treaty rates.
- **eCPM [EST]:** web rewarded video runs about $4+ eCPM (https://www.applixir.com/blog/the-complete-guide-to-ecpm-optimization-for-web-games/). It varies hugely by country and format, and no official figures are published.

## Ranked fastest path to first dollar
1. **CrazyGames, then Full Launch with the SDK.** It's free, no traffic is needed, and its 50M+ players bring the traffic. The €100 payout comes around the 10th of the next month. The catch is passing the Basic → Full Launch review.
2. **GameDistribution, alongside it (non-exclusive).** It's SDK-only and syndicates widely. The cut is low (33%) and payment is slower (up to 60 days), but there's no curation gate.
3. **Playgama, also non-exclusive.** 50%+ share and a $100 minimum.
4. **AdSense + H5 Games Ads on your own PWA site.** Best long-term margin, but approval isn't guaranteed. The PIN takes about 3 weeks and you need $100, so first payout is slow without your own traffic.
5. **Poki.** Highest upside, but it's curated and exclusive. Pitch it **first** if Gridrift is strong, because exclusivity rules out options 1–3. Otherwise skip it.
6. **AdinPlay and Ezoic:** only once your own site has real traffic.
Decision point: try Poki first (exclusive), or go wide with 1+2+3. You can't do both on the web.
