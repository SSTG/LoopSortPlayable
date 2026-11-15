import { _decorator, Component, AudioSource, AudioClip, resources } from 'cc';

const { ccclass, property } = _decorator;

const SOUNDS = ['pop', 'cube', 'click', 'win', 'fail', 'ui', 'complete', 'confetti'];
const MUSIC = 'music';

@ccclass('SoundManager')
export class SoundManager extends Component {
  @property({ type: AudioSource, tooltip: 'Plays the music: its loop and volume are set on this AudioSource. The clip is music.mp3 in the sound folder, loaded once the level is on screen.' })
  music: AudioSource | null = null;

  @property({ type: AudioSource, tooltip: 'Plays every other sound' })
  fx: AudioSource | null = null;

  @property({ tooltip: 'Folder under assets/resources holding the sounds: music, pop, cube, click, win, fail, ui, complete, confetti (.mp3). They load after the level appears so that they do not hold up the start.' })
  folder = 'audio';

  muted = false;
  private clips: Record<string, AudioClip> = {};
  private loading = false;
  private started = false;
  private stopped = false;
  private last: Record<string, number> = {};

  load() {
    if (this.loading) return;
    this.loading = true;
    for (const name of SOUNDS) this.fetch(name, clip => { this.clips[name] = clip; });
    this.fetch(MUSIC, clip => {
      if (!this.music) return;
      this.music.clip = clip;
      if (this.started && !this.stopped && !this.muted) this.music.play();
    });
  }

  unlock() {
    if (this.started) return;
    this.started = true;
    if (this.music && this.music.clip && !this.muted) this.music.play();
  }

  play(name: string, volume = 1) {
    const clip = this.clips[name];
    if (clip && this.fx && !this.muted) this.fx.playOneShot(clip, volume);
  }

  playStream(name: string, volume = 1, cooldown = 0.06) {
    const now = Date.now() / 1000;
    if (now - (this.last[name] || 0) < cooldown) return;
    this.last[name] = now;
    this.play(name, volume);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (!this.music || !this.music.clip) return;
    if (m) this.music.pause(); else if (this.started && !this.stopped) this.music.play();
  }

  stopMusic() {
    this.stopped = true;
    if (this.music && this.music.clip) this.music.stop();
  }

  private fetch(name: string, done: (clip: AudioClip) => void) {
    resources.load(`${this.folder}/${name}`, AudioClip, (err, clip) => {
      if (err) console.warn(`[LoopSort] could not load sound ${name}: ${err.message}`);
      else done(clip);
    });
  }
}
