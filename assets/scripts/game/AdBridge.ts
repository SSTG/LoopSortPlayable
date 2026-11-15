export interface AdHooks {
  cta?: () => void;
  ready?: () => void;
  end?: () => void;
  level?: string;
}

export function adHooks(host: any = globalThis): AdHooks {
  return (host && host.playableAd) || {};
}

export function openStore(hooks: AdHooks, url: string, open: (url: string) => void): boolean {
  if (hooks.cta) { hooks.cta(); return true; }
  if (!url) return false;
  open(url);
  return true;
}

export function levelFor(hooks: AdHooks, fallback: string): string {
  return hooks.level || fallback;
}
