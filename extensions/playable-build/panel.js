'use strict';

const NAME = 'playable-build';
const POLL_MS = 500;
const SCENE_LEVEL = '';
const ALL_FINAL = '*final';

const LABELS = {
  applovin: 'AppLovin',
  google: 'Google Ads',
  unity: 'Unity Ads',
  ironsource: 'ironSource',
  facebook: 'Meta (Facebook)',
  mintegral: 'Mintegral',
  tiktok: 'TikTok / Pangle',
  vungle: 'Liftoff (Vungle)',
  preview: 'Browser preview',
};

const STATUS = {
  idle: 'Ready.',
  running: 'Working... a full build takes a minute or two.',
  done: 'Done. The files are in the output folder.',
  failed: 'Something went wrong. See the log below.',
};

const template = `
<div class="wrap">
  <ui-section header="What to build" expand>
    <ui-prop>
      <ui-label slot="label" tooltip="The level the ad plays.">Level</ui-label>
      <ui-select slot="content" id="level"></ui-select>
    </ui-prop>
    <div class="hint">Pick one level, all final levels, or the level saved in the scene.</div>
  </ui-section>

  <ui-section header="Ad networks" expand>
    <div id="networks" class="networks"></div>
  </ui-section>

  <ui-section header="Store pages" expand>
    <ui-prop>
      <ui-label slot="label" tooltip="App Store page opened by the Download button on iPhone and iPad.">iOS URL</ui-label>
      <ui-input slot="content" id="iosUrl" placeholder="https://apps.apple.com/app/..."></ui-input>
    </ui-prop>
    <ui-prop>
      <ui-label slot="label" tooltip="Google Play page opened by the Download button on Android.">Android URL</ui-label>
      <ui-input slot="content" id="androidUrl" placeholder="https://play.google.com/store/apps/details?id=..."></ui-input>
    </ui-prop>
    <div class="hint">AppLovin, Unity and ironSource open these directly. The other networks use their own store link.</div>
  </ui-section>

  <div class="buttons">
    <ui-button id="build" class="blue" tooltip="Builds the game again, then packs it. Use after changing code, art, sounds or levels.">Build and pack</ui-button>
    <ui-button id="pack" tooltip="Packs the last build again. Enough when only the level choice, networks or store pages changed.">Pack only</ui-button>
    <ui-button id="stop" class="red" disabled>Stop</ui-button>
    <ui-button id="open">Open output folder</ui-button>
  </div>

  <div id="status" class="status"></div>
  <pre id="log" class="log"></pre>
</div>
`;

const style = `
.wrap { padding: 10px; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; overflow: auto; }
ui-section { margin-bottom: 8px; }
ui-prop { margin: 4px 0; }
.hint { color: var(--color-default-contrast-weaker, #888); font-size: 11px; margin: 2px 0 6px 0; }
.networks { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; padding: 6px 0; }
.buttons { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.status { margin: 4px 0; font-weight: bold; }
.status.failed { color: #ff6b6b; }
.status.done { color: #6bd66b; }
.log { flex: 1; min-height: 140px; margin: 0; padding: 8px; overflow: auto; white-space: pre-wrap; word-break: break-all;
  background: rgba(0, 0, 0, 0.25); border-radius: 4px; font-size: 11px; line-height: 1.4; user-select: text; }
`;

module.exports = Editor.Panel.define({
  template,
  style,

  $: {
    level: '#level',
    networks: '#networks',
    iosUrl: '#iosUrl',
    androidUrl: '#androidUrl',
    build: '#build',
    pack: '#pack',
    stop: '#stop',
    open: '#open',
    status: '#status',
    log: '#log',
  },

  methods: {
    async refresh(fill) {
      const state = await Editor.Message.request(NAME, 'get-state');
      if (!state) return;
      this.finalLevels = state.levels.filter(l => l.indexOf('FinalLevels/') === 0);
      if (fill) this.fill(state);
      this.show(state);
    },

    fill(state) {
      const options = [
        `<option value="${ALL_FINAL}">All final levels (${this.finalLevels.length})</option>`,
        `<option value="${SCENE_LEVEL}">Level saved in the scene</option>`,
      ].concat(state.levels.map(l => `<option value="${l}">${l}</option>`));
      this.$.level.innerHTML = options.join('');
      this.$.level.value = ALL_FINAL;
      const chosen = (state.config && state.config.networks) || [];
      this.$.networks.innerHTML = state.networks.map(n =>
        `<ui-checkbox data-network="${n}"${chosen.indexOf(n) >= 0 ? ' value' : ''}>${LABELS[n] || n}</ui-checkbox>`).join('');
      this.$.networks.querySelectorAll('ui-checkbox').forEach(box => box.addEventListener('confirm', () => this.save()));
      this.$.iosUrl.value = (state.config && state.config.iosUrl) || '';
      this.$.androidUrl.value = (state.config && state.config.androidUrl) || '';
    },

    show(state) {
      const text = state.error || STATUS[state.status] || '';
      this.$.status.textContent = text;
      this.$.status.className = 'status ' + (state.error ? 'failed' : state.status);
      const logText = state.log.join('\n');
      if (this.$.log.textContent !== logText) {
        this.$.log.textContent = logText;
        this.$.log.scrollTop = this.$.log.scrollHeight;
      }
      const busy = state.running;
      this.setDisabled(this.$.build, busy);
      this.setDisabled(this.$.pack, busy);
      this.setDisabled(this.$.stop, !busy);
    },

    setDisabled(button, off) {
      if (off) button.setAttribute('disabled', ''); else button.removeAttribute('disabled');
    },

    chosenNetworks() {
      const out = [];
      this.$.networks.querySelectorAll('ui-checkbox').forEach(box => { if (box.value) out.push(box.getAttribute('data-network')); });
      return out;
    },

    chosenLevels() {
      const value = this.$.level.value;
      if (value === ALL_FINAL) return this.finalLevels.slice();
      return value ? [value] : [];
    },

    async save() {
      await Editor.Message.request(NAME, 'save-settings', {
        iosUrl: this.$.iosUrl.value || '',
        androidUrl: this.$.androidUrl.value || '',
        networks: this.chosenNetworks(),
      });
    },

    async start(mode) {
      const networks = this.chosenNetworks();
      if (!networks.length) {
        this.$.status.textContent = 'Tick at least one ad network.';
        this.$.status.className = 'status failed';
        return;
      }
      await this.save();
      await Editor.Message.request(NAME, 'run', { mode, levels: this.chosenLevels(), networks });
      await this.refresh(false);
    },
  },

  ready() {
    this.finalLevels = [];
    this.$.iosUrl.addEventListener('confirm', () => this.save());
    this.$.androidUrl.addEventListener('confirm', () => this.save());
    this.$.build.addEventListener('confirm', () => this.start('build'));
    this.$.pack.addEventListener('confirm', () => this.start('pack'));
    this.$.stop.addEventListener('confirm', () => Editor.Message.request(NAME, 'stop'));
    this.$.open.addEventListener('confirm', () => Editor.Message.request(NAME, 'open-output'));
    this.refresh(true);
    this.timer = setInterval(() => this.refresh(false), POLL_MS);
  },

  close() {
    clearInterval(this.timer);
  },
});
