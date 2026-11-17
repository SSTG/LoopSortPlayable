import { _decorator, Component, AudioSource, AudioClip } from 'cc';

const { ccclass, property } = _decorator;

const SOUNDS = ['pop', 'cube', 'click', 'win', 'fail', 'ui', 'complete', 'confetti'] as const;

@ccclass('SoundManager')
export class SoundManager extends Component {
  @property({ type: AudioSource })
  music: AudioSource | null = null;

  @property({ type: AudioSource })
  fx: AudioSource | null = null;

  @property({ type: AudioClip, group: 'Clips' })
  musicClip: AudioClip | null = null;

  @property({ type: AudioClip, group: 'Clips' })
  pop: AudioClip | null = null;

  @property({ type: AudioClip, group: 'Clips' })
  cube: AudioClip | null = null;

  @property({ type: AudioClip, group: 'Clips' })
  click: AudioClip | null = null;

  @property({ type: AudioClip, group: 'Clips' })
  win: AudioClip | null = null;

  @property({ type: AudioClip, group: 'Clips' })
  fail: AudioClip | null = null;

  @property({ type: AudioClip, group: 'Clips' })
  ui: AudioClip | null = null;

  @property({ type: AudioClip, group: 'Clips' })
  complete: AudioClip | null = null;

  @property({ type: AudioClip, group: 'Clips' })
  confetti: AudioClip | null = null;

  muted = false;
  private clips: Record<string, AudioClip> = {};
  private loading = false;
  private started = false;
  private stopped = false;
  private last: Record<string, number> = {};

  load() {
    if (this.loading) return;
    this.loading = true;
    for (const name of SOUNDS) {
      const clip = this[name];
      if (clip) this.clips[name] = clip; else console.warn(`[LoopSort] sound ${name} is not set on the SoundManager`);
    }
    if (this.music && this.musicClip) {
      this.music.clip = this.musicClip;
      if (this.started && !this.stopped && !this.muted) this.music.play();
    }
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
}
