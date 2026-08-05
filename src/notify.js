/*
 * Notifications on build completion: always shows the in-panel toast (handled
 * by the panel itself via viewModel.toast); optionally also fires a browser
 * Notification if permission has been granted.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.OQueue = root.OQueue || {};
    root.OQueue.Notify = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function requestPermission() {
    if (typeof Notification === 'undefined') return Promise.resolve('unsupported');
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return Promise.resolve(Notification.permission);
    }
    return Notification.requestPermission();
  }

  function notifyBuildComplete(completedLabel, nextLabel) {
    const title = `${completedLabel} complete`;
    const body = nextLabel ? `Next: ${nextLabel}` : 'Queue complete';
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    return { title, body };
  }

  return { requestPermission, notifyBuildComplete };
});
