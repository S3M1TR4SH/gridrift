import assert from 'node:assert/strict';
import { test } from 'node:test';
import pacing from '../config/pacing.json' with { type: 'json' };
import retention from '../config/retention.json' with { type: 'json' };
import tuning from '../config/tuning.json' with { type: 'json' };
import { memoryStorage } from '../studio-core/consent/age-gate.js';
import { createPacer } from '../studio-core/pacing/pacer.js';
import { createMatch, SHAPES } from '../src/logic.js';
import { scriptedBoards, shouldSkipOnboarding, wordCount } from '../src/onboarding.js';
import { mulberry32 } from '../src/rng.js';
import {
  bandShapes,
  beginRun,
  emptyMercy,
  noteLoss,
  shouldShowWelcome,
  STREAK_RESET_COPY
} from '../src/retention.js';
import { createSaveStore } from '../src/save.js';

const score = {
  ...tuning.score,
  graceMoves: retention.feedback.runStreak.graceMoves,
  bonusPerStep: retention.feedback.runStreak.bonusPerStep
};
const palette = [{ id: 'tile.blue', color: '#3d8bfd' }];

test('shipped retention config matches the spec blocks for items 1 through 5', () => {
  assert.equal(retention.persistence.welcomeBack.minAwayMinutes, 30);
  assert.equal(retention.persistence.saveRunOnEveryPlacement, true);
  assert.equal(retention.persistence.welcomeBack.showBestScore, true);
  assert.equal(retention.persistence.welcomeBack.showStreak, true);
  assert.deepEqual(retention.feedback.clearFx, ['flash', 'particles', 'scorePopup']);
  assert.deepEqual(retention.feedback.multiClearFx, ['shake', 'pitchRise']);
  assert.equal(retention.feedback.maxFxMs, 400);
  assert.equal(retention.feedback.runStreak.graceMoves, 1);
  assert.equal(retention.feedback.runStreak.bonusPerStep, 10);
  assert.equal(retention.feedback.combo.showCounter, true);
  assert.equal(retention.feedback.haptics.userToggle, true);
  assert.equal(retention.feedback.respectReducedMotion, true);
  assert.equal(retention.onboarding.scriptedBoards, 2);
  assert.equal(retention.onboarding.guaranteeFirstClearWithinMoves, 3);
  assert.equal(retention.onboarding.textMaxWords, 8);
  assert.equal(retention.onboarding.prefilledFirstBoard, true);
  assert.equal(retention.onboarding.dismissOnAction, true);
  assert.equal(retention.persistence.persistLevel.enabled, true);
  assert.equal(retention.feedback.streakFx.minStreak, 2);
  assert.equal(retention.tray.fixedSlots, true);
  assert.equal(retention.layout.mobilePortrait.boardAnchor, 'upper');
  assert.equal(retention.onboarding.skipForReturningPlayers, true);
  assert.equal(retention.onboarding.firstSessionNoInterstitials, true);
  assert.equal(retention.onboarding.dragOffsetPx, 60);
  assert.equal(tuning.juice.dragLiftPx, 60);
  for (const key of ['flashMs', 'particleLifeMs', 'popupMs', 'shakeMs', 'invalidShakeMs', 'snapBackMs']) {
    assert.ok(tuning.juice[key] < retention.feedback.maxFxMs, key);
  }
  assert.equal(retention.difficulty.minShapes, 15);
  assert.equal(retention.difficulty.adIndependentRng, true);
  assert.deepEqual(retention.difficulty.rampByScore, [[0, 'easy'], [300, 'normal'], [1200, 'hard']]);
  assert.equal(retention.difficulty.mercy.afterLossesInRow, 3);
  assert.equal(retention.difficulty.mercy.easierDealRuns, 1);
  assert.equal(retention.dailyChallenge.seed, 'utcDate');
  assert.deepEqual(retention.dailyChallenge.objectiveRange, [8, 20]);
  assert.equal(retention.dailyChallenge.reward.amount, 20);
  assert.equal(retention.dayStreak.rolloverHourLocal, 4);
  assert.equal(retention.dayStreak.freezes.max, 2);
  assert.equal(retention.dayStreak.freezes.earnEveryNDays, 7);
  assert.equal(retention.dayStreak.freezes.purchasable, false);
  assert.equal(retention.dayStreak.freezes.adOnly, false);
  assert.equal(retention.dayStreak.lossCopyTone, 'neutral');
  assert.doesNotMatch(STREAK_RESET_COPY, /lose everything|dying|last chance/i);
  assert.ok(Object.keys(SHAPES).length >= retention.difficulty.minShapes);
});

test('welcome back waits half an hour and keeps the best score', () => {
  const now = 1_700_000_000_000;
  const run = { board: [[0]] };
  assert.equal(shouldShowWelcome({ run: null, lastSeen: 0, now }), false);
  assert.equal(shouldShowWelcome({
    run,
    lastSeen: now - 29 * 60 * 1000,
    now,
    minAwayMinutes: 30
  }), false);
  assert.equal(shouldShowWelcome({
    run,
    lastSeen: now - 30 * 60 * 1000,
    now,
    minAwayMinutes: 30
  }), true);
  const store = createSaveStore(memoryStorage());
  store.save({ bestScore: 40, lastSeen: now, run: null });
  const again = store.save({ bestScore: 10, lastSeen: now + 1000, run: null });
  assert.equal(again.bestScore, 40);
  assert.equal(again.lastSeen, now + 1000);
});

test('scripted boards clear within three moves and returning players skip them', () => {
  const boards = scriptedBoards();
  assert.equal(boards.length, retention.onboarding.scriptedBoards);
  for (const board of boards) {
    assert.ok(wordCount(board.prompt) <= retention.onboarding.textMaxWords);
    const match = createMatch({
      grid: 6,
      traySize: 3,
      score,
      rng: () => 0,
      targetClears: 99,
      poolFor: () => ['dot'],
      palette,
      saved: {
        board: board.board,
        pieces: board.pieces,
        score: 0,
        phase: 'playing',
        targetClears: 99
      }
    });
    let moves = 0;
    let lines = 0;
    for (const move of board.moves) {
      moves += 1;
      lines = match.place(move.index, move.x, move.y).lines;
      if (lines > 0) break;
    }
    assert.ok(lines > 0);
    assert.ok(moves <= retention.onboarding.guaranteeFirstClearWithinMoves);
  }
  assert.equal(shouldSkipOnboarding({ tutorialSeen: true }), true);
  assert.equal(shouldSkipOnboarding({ sessions: 2 }), true);
  assert.equal(shouldSkipOnboarding({ bestScore: 8 }), true);
  assert.equal(shouldSkipOnboarding({}), false);
});

function scriptedStreak(graceMoves) {
  const board = scriptedBoards()[0];
  const match = createMatch({
    grid: 6,
    traySize: 3,
    score: { ...score, graceMoves, bonusPerStep: graceMoves === 1 ? 10 : 0 },
    rng: () => 0,
    targetClears: 99,
    poolFor: () => ['dot'],
    palette,
    saved: {
      board: board.board,
      pieces: board.pieces,
      phase: 'playing',
      targetClears: 99
    }
  });
  const cleared = match.place(0, 5, 0);
  const afterDry = [];
  afterDry.push(match.place(1, 0, 2).ok ? match.state.streak : -1);
  afterDry.push(match.place(2, 1, 2).ok ? match.state.streak : -1);
  return { gained: cleared.gained, afterDry };
}

test('one grace move keeps a run streak and a second dry move resets it', () => {
  const none = scriptedStreak(0);
  const one = scriptedStreak(1);
  const two = scriptedStreak(2);
  assert.deepEqual(none.afterDry, [0, 0]);
  assert.deepEqual(one.afterDry, [1, 0]);
  assert.deepEqual(two.afterDry, [1, 1]);
  assert.ok(one.gained > none.gained);
});

function namesFor({ seed, scoreValue, easy, ads }) {
  const rng = mulberry32(seed);
  const source = ads
    ? pacing
    : {
      ...pacing,
      ads: {
        ...pacing.ads,
        personalized: true,
        interstitial: { ...pacing.ads.interstitial, enabled: false },
        rewarded: { ...pacing.ads.rewarded, enabled: false }
      },
      difficulty: { ...pacing.difficulty, failBias: 1, forceUnplaceable: true }
    };
  const pacer = createPacer({
    pacing: source,
    now: () => 0,
    sessionNumber: ads ? 4 : 1,
    isChild: () => !ads
  });
  if (ads) pacer.recordAd('rewarded');
  const pool = bandShapes({
    score: scoreValue,
    easy,
    pools: source.difficulty.pools,
    ramp: retention.difficulty.rampByScore
  });
  const match = createMatch({
    grid: 6,
    traySize: 3,
    score,
    rng,
    targetClears: 99,
    poolFor: () => pool,
    palette
  });
  return {
    names: match.state.pieces.map((piece) => piece.shapeName),
    pool,
    failBias: pacer.failBias,
    forceUnplaceable: pacer.forceUnplaceable
  };
}

test('score bands and mercy ignore ads and never force a loss', () => {
  const easy = pacing.difficulty.pools[0].shapes;
  const normal = pacing.difficulty.pools[1].shapes;
  const hard = pacing.difficulty.pools[2].shapes;
  assert.deepEqual(bandShapes({ score: 0, pools: pacing.difficulty.pools, ramp: retention.difficulty.rampByScore }), easy);
  assert.deepEqual(bandShapes({ score: 300, pools: pacing.difficulty.pools, ramp: retention.difficulty.rampByScore }), normal);
  assert.deepEqual(bandShapes({ score: 1200, pools: pacing.difficulty.pools, ramp: retention.difficulty.rampByScore }), hard);
  assert.deepEqual(bandShapes({
    score: 5000,
    easy: true,
    pools: pacing.difficulty.pools,
    ramp: retention.difficulty.rampByScore
  }), easy);

  let mercy = emptyMercy();
  mercy = noteLoss(mercy);
  mercy = noteLoss(mercy);
  assert.equal(beginRun(mercy).easy, false);
  mercy = noteLoss(mercy);
  assert.equal(mercy.queued, 1);
  for (let extra = 0; extra < 4; extra += 1) mercy = noteLoss(mercy);
  assert.equal(mercy.queued, 1);
  const started = beginRun(mercy);
  assert.equal(started.easy, true);
  assert.equal(beginRun(started.mercy).easy, false);

  for (const seed of [3, 11, 27]) {
    const withAds = namesFor({ seed, scoreValue: 1500, easy: started.easy, ads: true });
    const without = namesFor({ seed, scoreValue: 1500, easy: started.easy, ads: false });
    assert.deepEqual(withAds.names, without.names, `seed ${seed}`);
    assert.deepEqual(withAds.pool, easy);
    assert.equal(withAds.failBias, 0);
    assert.equal(without.failBias, 0);
    assert.equal(withAds.forceUnplaceable, false);
    assert.equal(without.forceUnplaceable, false);
  }
});

test('a fair score ramp still produces a lockout', () => {
  let locked = false;
  for (let seed = 1; seed <= 12 && !locked; seed += 1) {
    const rng = mulberry32(seed);
    const chooser = mulberry32(seed + 50);
    const match = createMatch({
      grid: tuning.grid,
      traySize: tuning.traySize,
      score,
      rng,
      targetClears: 99,
      poolFor: (_clears, points) => bandShapes({
        score: points,
        easy: false,
        pools: pacing.difficulty.pools,
        ramp: retention.difficulty.rampByScore
      }),
      palette
    });
    for (let step = 0; step < 80 && match.state.phase === 'playing'; step += 1) {
      const pieces = match.state.pieces;
      let placed = false;
      const order = [0, 1, 2].sort(() => chooser() - 0.5);
      for (const index of order) {
        const piece = pieces[index];
        if (!piece) continue;
        for (let y = 0; y < tuning.grid && !placed; y += 1) {
          for (let x = 0; x < tuning.grid && !placed; x += 1) {
            if (chooser() > 0.2) continue;
            const result = match.place(index, x, y);
            if (result.ok) placed = true;
          }
        }
      }
      if (!placed) {
        for (let index = 0; index < pieces.length && !placed; index += 1) {
          const piece = pieces[index];
          if (!piece) continue;
          for (let y = 0; y < tuning.grid && !placed; y += 1) {
            for (let x = 0; x < tuning.grid && !placed; x += 1) {
              const result = match.place(index, x, y);
              if (result.ok) placed = true;
            }
          }
        }
      }
      if (!placed) break;
    }
    if (match.state.phase === 'game_over') locked = true;
  }
  assert.equal(locked, true);
  assert.equal(pacing.difficulty.failBias, 0);
  assert.equal(pacing.difficulty.forceUnplaceable, false);
});
