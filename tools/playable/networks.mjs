const MRAID = `cta: function () { if (window.mraid && mraid.open) mraid.open(storeUrl); else window.open(storeUrl); }`;

export const NETWORKS = {
  preview: {
    limitMb: 0,
    hooks: `cta: function () { if (storeUrl) window.open(storeUrl); }`,
  },
  applovin: { limitMb: 5, hooks: MRAID },
  unity: { limitMb: 5, hooks: MRAID },
  ironsource: { limitMb: 5, hooks: MRAID },
  google: {
    limitMb: 5,
    zip: true,
    head: `<meta name="ad.orientation" content="portrait,landscape">
<script src="https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>`,
    hooks: `cta: function () { if (window.ExitApi) ExitApi.exit(); }`,
  },
  facebook: {
    limitMb: 5,
    zip: true,
    hooks: `cta: function () { if (window.FbPlayableAd) FbPlayableAd.onCTAClick(); }`,
  },
  mintegral: {
    limitMb: 5,
    zip: true,
    before: `window.gameStart = function () {}; window.gameClose = function () {};`,
    hooks: `cta: function () { if (window.install) window.install(); },
    ready: function () { if (window.gameReady) window.gameReady(); },
    end: function () { if (window.gameEnd) window.gameEnd(); }`,
  },
  tiktok: {
    limitMb: 5,
    zip: true,
    head: `<script src="https://sf16-muse-va.ibytedtos.com/obj/union-fe-nc-i18n/playable/sdk/playable-sdk.js"></script>`,
    extraFiles: { 'config.json': JSON.stringify({ playable_orientation: 0, playable_languages: ['en'] }) },
    hooks: `cta: function () { if (window.playableSDK) window.playableSDK.openAppStore(); }`,
  },
  vungle: {
    limitMb: 5,
    zip: true,
    hooks: `cta: function () { parent.postMessage('download', '*'); },
    end: function () { parent.postMessage('complete', '*'); }`,
  },
};

export function adapterScript(network, config, level) {
  const n = NETWORKS[network];
  return `(function () {
  var ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var storeUrl = ios ? ${JSON.stringify(config.iosUrl || config.androidUrl || '')} : ${JSON.stringify(config.androidUrl || config.iosUrl || '')};
  ${n.before || ''}
  window.playableAd = {
    network: ${JSON.stringify(network)},
    level: ${JSON.stringify(level || '')},
    ${n.hooks}
  };
})();`;
}
