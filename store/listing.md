# Play listing draft

Draft only. Nothing in `store/` is submitted to Google Play.

## Title

Gridrift

## Short description

Place pieces, clear lines, and keep a streak on a 10x10 grid.

## Full description

Gridrift is a small puzzle you play on a 10 by 10 grid. Drag a piece into a gap, clear a full row or column, and keep a streak going. Each round asks for more clears, then the same board continues.

You do not need an account. The game asks an age question and keeps the answer on the device. Players under 13 get non-personalized ads only, and no stats. Everyone else can leave stats off. In this build those stats stay in the browser. They are not sent anywhere.

Restart is always available. A continue or a hint, when offered, is optional. Declining it returns you to the game.

The Android package opens the website as a Trusted Web Activity. It does not add a store login, payments, or a native ad SDK.

## Keywords

puzzle, block puzzle, line clear, grid, streak, single player, board

## Asset list

Store creatives below are not exported and not uploaded. In-game art is referenced by id from `assets.manifest.json`, which pins `S3M1TR4SH/asset-library` at `v0.2.0`. The loader draws a placeholder when the library file is missing.

Play icon, 512: `icon.gridrift.icon-512`, file `branding/icon-512.png`.

Maskable icon, 512: `icon.gridrift.icon-512-maskable`, file `branding/icon-512-maskable.png`.

Hi-res icon, 192, also used as the TWA launcher source: `icon.gridrift.icon-192`, file `branding/icon-192.png`.

Feature graphic, 1024 by 500: not drawn. Required before submission. Do not upload a screenshot in its place.

Phone screenshots: not captured. Required before submission.

In-game ids:

- Tiles: `tile.blue`, `tile.green`, `tile.orange`, `tile.pink`, `tile.red`, `tile.yellow`, `tile.grey`, `tile.back.01`
- Buttons and marks: `ui.button_rectangle_flat.blue`, `ui.button_rectangle_depth_flat.blue`, `ui.button_round_flat.blue`, `ui.button_square_flat.blue`, `ui.icon_checkmark.blue`, `ui.icon_cross.blue`, `ui.star.blue`, `ui.star_outline.blue`
- Type: `font.kenney-future`, `font.kenney-blocks`
- Sounds: `sfx.click`, `sfx.place`, `sfx.error`, `sfx.win`, `sfx.line_clear`, `sfx.combo`, `sfx.game_over`, `sfx.clear`, `sfx.streak.1`, `sfx.streak.2`, `sfx.streak.3`, `sfx.invalid`, `sfx.tutorial.step`, `sfx.ui.tap`
- Effects: `fx.particle.1`, `fx.particle.2`, `fx.particle.3`, `fx.particle.4`, `fx.particle.5`, `fx.particle.6`, `fx.particle.7`, `fx.particle.8`, `fx.flash`
- Other icons: `icon.gridrift.apple-touch-icon`, `icon.gridrift.favicon-32`, `icon.gridrift.favicon-ico`
