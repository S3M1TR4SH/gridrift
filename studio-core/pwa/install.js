export function createInstallController() {
  let deferred = null;
  let installed = false;

  return {
    get available() {
      return Boolean(deferred) && !installed;
    },
    capture(event) {
      if (!event || typeof event.preventDefault !== 'function') {
        throw new Error('expected a beforeinstallprompt event');
      }
      event.preventDefault();
      if (!installed) deferred = event;
    },
    async prompt() {
      if (!deferred || installed) return { outcome: 'unavailable' };
      const pending = deferred;
      await pending.prompt();
      const choice = pending.userChoice ? await pending.userChoice : { outcome: 'dismissed' };
      deferred = null;
      if (choice?.outcome === 'accepted') installed = true;
      return choice ?? { outcome: 'dismissed' };
    },
    markInstalled() {
      installed = true;
      deferred = null;
    }
  };
}
