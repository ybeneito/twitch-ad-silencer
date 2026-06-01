// Twitch Ad Stream Keeper - content script
//
// During a Twitch ad break, Twitch keeps the live stream playing in a small,
// muted preview <video> (top-right of the page) while the main player shows the
// ad. This script detects the ad break, then unmutes that preview video and
// mutes the main player (the ad), so only the stream audio is heard. The preview
// is left at its native size and position. When the ad ends, the original mute
// states are restored.
//
// No privileged API is needed, hence no background script. Firefox does not
// expose the W3C Picture-in-Picture JS API anyway, so this in-page audio swap is
// the workable approach.

(() => {
  "use strict";

  // Set to true to print diagnostics under the "[ad-stream-keeper]" prefix when
  // recalibrating selectors against the live Twitch DOM.
  const DEBUG = false;

  // DOM markers that indicate an ad break is running. Twitch obfuscates most
  // class names, but these data-attributes have been stable on the ad UI.
  const AD_MARKER_SELECTORS = [
    '[data-a-target="video-ad-label"]',
    '[data-a-target="video-ad-countdown"]',
    '[data-test-selector="ad-banner-default-text"]',
  ];

  // The main player video lives inside this container. Any *other* <video>
  // present during an ad is the stream preview we want to unmute.
  const MAIN_PLAYER_SELECTOR = '[data-a-target="video-player"]';

  const CHECK_DEBOUNCE_MS = 250;

  const state = {
    enabled: true,
    isActive: false,
    previewVideo: null,
    savedPreviewMuted: true,
    adVideo: null,
    savedAdMuted: false,
    adDetected: false,
    noPreviewLogged: false,
  };

  const log = (...args) => {
    if (DEBUG) console.info("[ad-stream-keeper]", ...args);
  };

  const isAdPlaying = () =>
    AD_MARKER_SELECTORS.some(
      (selector) => document.querySelector(selector) !== null
    );

  const renderedArea = (video) => {
    const rect = video.getBoundingClientRect();
    return rect.width * rect.height;
  };

  // The stream preview during a mid-roll is a <video> outside the main player.
  // If several remain, it is the smallest rendered one.
  const findPreviewVideo = () => {
    const mainPlayer = document.querySelector(MAIN_PLAYER_SELECTOR);
    const candidates = Array.from(document.querySelectorAll("video")).filter(
      (video) => !mainPlayer || !mainPlayer.contains(video)
    );
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => renderedArea(a) - renderedArea(b))[0];
  };

  // The main player video carries the ad audio during a break. Prefer the video
  // inside the player container; fall back to the largest video that is not the
  // preview.
  const findAdVideo = () => {
    const mainPlayer = document.querySelector(MAIN_PLAYER_SELECTOR);
    const inContainer = mainPlayer?.querySelector("video");
    if (inContainer) return inContainer;
    const others = Array.from(document.querySelectorAll("video")).filter(
      (video) => video !== state.previewVideo
    );
    if (others.length === 0) return null;
    return others.sort((a, b) => renderedArea(b) - renderedArea(a))[0];
  };

  const unmutePreview = (video) => {
    state.savedPreviewMuted = video.muted;
    video.muted = false;
    if (video.volume === 0) video.volume = 1;
    state.previewVideo = video;
  };

  const restorePreview = (video) => {
    if (video?.isConnected) video.muted = state.savedPreviewMuted;
  };

  const muteAd = () => {
    // Already muted for this break.
    if (state.adVideo?.isConnected) return;
    const adVideo = findAdVideo();
    if (!adVideo || adVideo === state.previewVideo) {
      log("ad video not found to mute");
      return;
    }
    state.savedAdMuted = adVideo.muted;
    adVideo.muted = true;
    state.adVideo = adVideo;
  };

  const activate = () => {
    const video = findPreviewVideo();
    if (!video) {
      // No preview means the stream is not playing alongside the ad: this is a
      // pre-roll (ad before the stream starts), nothing to unmute. Logged once.
      if (!state.noPreviewLogged) {
        log("ad running with no preview (likely a pre-roll); nothing to do");
        state.noPreviewLogged = true;
      }
      return;
    }
    unmutePreview(video);
    state.isActive = true;
    state.noPreviewLogged = false;
    muteAd();
    log("ad break: stream preview unmuted, ad muted");
  };

  const deactivate = () => {
    restorePreview(state.previewVideo);
    if (state.adVideo?.isConnected) state.adVideo.muted = state.savedAdMuted;
    state.adVideo = null;
    state.previewVideo = null;
    state.isActive = false;
    log("ad break ended: mute states restored");
  };

  const sync = () => {
    if (!state.enabled) {
      // Disabled via the popup: undo anything in progress and stand down.
      if (state.isActive) deactivate();
      state.adDetected = false;
      state.noPreviewLogged = false;
      return;
    }

    const adPlaying = isAdPlaying();

    if (!adPlaying) {
      // Ad just ended (mid-roll restore, or a pre-roll finishing with nothing
      // to undo). Reset the per-break flags either way.
      if (state.adDetected) {
        if (state.isActive) deactivate();
        state.adDetected = false;
        state.noPreviewLogged = false;
      }
      return;
    }

    if (!state.adDetected) {
      state.adDetected = true;
      log("ad detected");
    }

    if (!state.isActive) {
      // Keep trying: the preview can appear a moment after the ad marker.
      activate();
    } else if (!state.previewVideo?.isConnected) {
      // Twitch replaced the preview node mid-break: re-acquire it.
      log("preview video was replaced, re-acquiring");
      state.isActive = false;
      activate();
    }
  };

  let debounceTimer = null;
  const scheduleSync = () => {
    if (debounceTimer !== null) return;
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      sync();
    }, CHECK_DEBOUNCE_MS);
  };

  const startObserving = () => {
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    // Initial pass in case an ad is already running when the script loads.
    sync();
  };

  // React live to the popup toggle, even mid-break.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.enabled) return;
    state.enabled = changes.enabled.newValue;
    log("toggled", state.enabled ? "on" : "off");
    sync();
  });

  // Load the saved on/off state before wiring up the observer.
  browser.storage.local.get({ enabled: true }).then((result) => {
    state.enabled = result.enabled;
    startObserving();
    log("initialized", state.enabled ? "(enabled)" : "(disabled)");
  });
})();
