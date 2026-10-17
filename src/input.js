export const TAP_SLOP = 10;

export function createPointerState() {
  return { drag: null, selected: null };
}

export function pointerReducer(state, event, hit) {
  if (hit.ignore) {
    if (event.type === 'up' || event.type === 'cancel') {
      return { state: { ...state, drag: null }, effect: { type: 'cancel' } };
    }
    return { state, effect: null };
  }
  if (event.type === 'down') {
    if (hit.trayIndex >= 0) {
      return {
        state: {
          ...state,
          drag: {
            index: hit.trayIndex,
            pointerId: event.pointerId,
            startX: event.x,
            startY: event.y,
            x: event.x,
            y: event.y,
            moved: false
          }
        },
        effect: null
      };
    }
    if (state.selected != null && hit.overBoard) {
      return {
        state: {
          ...state,
          drag: {
            index: state.selected,
            pointerId: event.pointerId,
            startX: event.x,
            startY: event.y,
            x: event.x,
            y: event.y,
            moved: true,
            fromSelection: true
          }
        },
        effect: null
      };
    }
    return { state, effect: null };
  }
  if (event.type === 'move') {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return { state, effect: null };
    const distance = Math.hypot(event.x - state.drag.startX, event.y - state.drag.startY);
    return {
      state: {
        ...state,
        drag: {
          ...state.drag,
          x: event.x,
          y: event.y,
          moved: state.drag.moved || distance >= TAP_SLOP
        }
      },
      effect: null
    };
  }
  if (event.type === 'up' || event.type === 'cancel') {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return { state, effect: null };
    const drag = state.drag;
    const cleared = { ...state, drag: null };
    if (event.type === 'cancel') return { state: cleared, effect: { type: 'cancel' } };
    if (!drag.moved) {
      return {
        state: { ...cleared, selected: drag.index },
        effect: { type: 'select', index: drag.index }
      };
    }
    if (hit.overBoard && hit.ghostValid) {
      return {
        state: { ...cleared, selected: null },
        effect: { type: 'place', index: drag.index, x: hit.snapX, y: hit.snapY }
      };
    }
    return { state: cleared, effect: { type: 'cancel' } };
  }
  return { state, effect: null };
}
