(function () {
  var ROOT = 'https://pack.invalid/';
  var MIME = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
    ttf: 'font/ttf', woff: 'font/woff', woff2: 'font/woff2',
    json: 'application/json', js: 'text/javascript', wasm: 'application/wasm', bin: 'application/octet-stream',
  };
  var files = {};
  var urls = {};

  function mime(path) {
    return MIME[path.slice(path.lastIndexOf('.') + 1).toLowerCase()] || 'application/octet-stream';
  }

  function tidy(path) {
    var out = [];
    path.split('/').forEach(function (part) {
      if (part === '..') out.pop();
      else if (part && part !== '.') out.push(part);
    });
    return out.join('/');
  }

  function find(url) {
    if (url && typeof url !== 'string') url = url.href || url.url;
    if (typeof url !== 'string' || /^(data|blob):/.test(url)) return null;
    url = url.split('#')[0].split('?')[0];
    if (url.indexOf(ROOT) === 0) url = url.slice(ROOT.length);
    else url = url.replace(/^[a-z][a-z0-9+.-]*:\/*[^/]*\//i, '');
    var path = tidy(url);
    while (path) {
      if (files[path]) return path;
      var cut = path.indexOf('/');
      if (cut < 0) return null;
      path = path.slice(cut + 1);
    }
    return null;
  }

  function text(path) {
    var bytes = files[path];
    if (window.TextDecoder) return new TextDecoder('utf-8').decode(bytes);
    var s = '';
    for (var i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return decodeURIComponent(escape(s));
  }

  function dataUrl(path) {
    if (urls[path]) return urls[path];
    var bytes = files[path], s = '';
    for (var i = 0; i < bytes.length; i += 8190) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8190));
    return (urls[path] = 'data:' + mime(path) + ';base64,' + btoa(s));
  }

  function fromBase64(b64) {
    if (Uint8Array.fromBase64) return Uint8Array.fromBase64(b64);
    var raw = atob(b64), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function inflateJs(src, size) {
    var dst = new Uint8Array(size);
    var sp = 0, dp = 0, hold = 0, held = 0;
    var LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
    var LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
    var DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
    var DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
    var ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

    function bits(n) {
      while (held < n) { hold |= src[sp++] << held; held += 8; }
      var v = hold & ((1 << n) - 1);
      hold >>>= n;
      held -= n;
      return v;
    }

    function tree(lens, from, count) {
      var counts = new Uint16Array(16), starts = new Uint16Array(16), symbols = new Uint16Array(count), i, sum = 0;
      for (i = 0; i < count; i++) counts[lens[from + i]]++;
      counts[0] = 0;
      for (i = 0; i < 16; i++) { starts[i] = sum; sum += counts[i]; }
      for (i = 0; i < count; i++) if (lens[from + i]) symbols[starts[lens[from + i]]++] = i;
      return { counts: counts, symbols: symbols };
    }

    function symbol(t) {
      var sum = 0, cur = 0, len = 0;
      do {
        if (!held) { hold = src[sp++]; held = 8; }
        cur = 2 * cur + (hold & 1);
        hold >>>= 1;
        held--;
        len++;
        sum += t.counts[len];
        cur -= t.counts[len];
      } while (cur >= 0);
      return t.symbols[sum + cur];
    }

    function fixedTrees() {
      var lens = new Uint8Array(320), i;
      for (i = 0; i < 144; i++) lens[i] = 8;
      for (; i < 256; i++) lens[i] = 9;
      for (; i < 280; i++) lens[i] = 7;
      for (; i < 288; i++) lens[i] = 8;
      for (; i < 320; i++) lens[i] = 5;
      return [tree(lens, 0, 288), tree(lens, 288, 32)];
    }

    function dynamicTrees() {
      var hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
      var lens = new Uint8Array(320), i;
      for (i = 0; i < hclen; i++) lens[ORDER[i]] = bits(3);
      var codes = tree(lens, 0, 19);
      lens = new Uint8Array(320);
      for (i = 0; i < hlit + hdist;) {
        var s = symbol(codes), repeat = 1, value = s;
        if (s === 16) { value = lens[i - 1]; repeat = bits(2) + 3; }
        else if (s === 17) { value = 0; repeat = bits(3) + 3; }
        else if (s === 18) { value = 0; repeat = bits(7) + 11; }
        while (repeat--) lens[i++] = value;
      }
      return [tree(lens, 0, hlit), tree(lens, hlit, hdist)];
    }

    function block(trees) {
      for (;;) {
        var s = symbol(trees[0]);
        if (s === 256) return;
        if (s < 256) { dst[dp++] = s; continue; }
        s -= 257;
        var len = LBASE[s] + bits(LEXT[s]);
        var d = symbol(trees[1]);
        var from = dp - (DBASE[d] + bits(DEXT[d]));
        while (len--) dst[dp++] = dst[from++];
      }
    }

    for (var last = 0; !last;) {
      last = bits(1);
      var type = bits(2);
      if (type === 0) {
        hold = 0; held = 0;
        var n = src[sp] | (src[sp + 1] << 8);
        sp += 4;
        dst.set(src.subarray(sp, sp + n), dp);
        sp += n; dp += n;
      } else if (type === 1) block(fixedTrees());
      else if (type === 2) block(dynamicTrees());
      else throw new Error('bad pack');
    }
    return dst;
  }

  function inflate(src, size) {
    var slow = function () { return inflateJs(src, size); };
    try {
      var stream = new Blob([src]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).arrayBuffer().then(function (buf) { return new Uint8Array(buf); }).catch(slow);
    } catch (e) {
      return Promise.resolve().then(slow);
    }
  }

  function unpack(node) {
    var size = +node.getAttribute('data-size');
    var packed = fromBase64(node.textContent);
    node.parentNode.removeChild(node);
    return inflate(packed, size).then(function (all) {
      var head = all[0] | (all[1] << 8) | (all[2] << 16) | (all[3] << 24);
      files.__index = all.subarray(4, 4 + head);
      var index = JSON.parse(text('__index'));
      delete files.__index;
      for (var path in index) files[path] = all.subarray(4 + head + index[path][0], 4 + head + index[path][0] + index[path][1]);
    });
  }

  function later(fn) { Promise.resolve().then(fn); }

  function redirect(proto, serve) {
    var d = Object.getOwnPropertyDescriptor(proto, 'src');
    Object.defineProperty(proto, 'src', {
      configurable: true,
      enumerable: true,
      get: function () { return this.__packed || d.get.call(this); },
      set: function (v) {
        var path = find(v);
        if (path === null) { d.set.call(this, v); return; }
        this.__packed = String(v);
        serve(this, path, d);
      },
    });
  }

  function patchElements() {
    redirect(HTMLScriptElement.prototype, function (el, path) {
      el.text = text(path) + '\n//# sourceURL=' + path;
      later(function () { el.dispatchEvent(new Event('load')); });
    });
    redirect(HTMLImageElement.prototype, function (el, path, d) { d.set.call(el, dataUrl(path)); });
    redirect(HTMLMediaElement.prototype, function (el, path, d) { d.set.call(el, dataUrl(path)); });
  }

  function patchCss() {
    var fix = function (css) {
      return String(css).replace(/url\((["']?)([^"')]+)\1\)/g, function (all, q, url) {
        var path = find(url);
        return path === null ? all : 'url("' + dataUrl(path) + '")';
      });
    };
    var d = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    Object.defineProperty(HTMLStyleElement.prototype, 'textContent', {
      configurable: true,
      get: function () { return d.get.call(this); },
      set: function (v) { d.set.call(this, fix(v)); },
    });
    var Face = window.FontFace;
    if (!Face) return;
    window.FontFace = function (family, source, descriptors) {
      return new Face(family, typeof source === 'string' ? fix(source) : source, descriptors);
    };
    window.FontFace.prototype = Face.prototype;
  }

  function patchRequests() {
    var X = XMLHttpRequest.prototype, open = X.open, send = X.send, header = X.setRequestHeader;
    var put = function (xhr, key, value) { Object.defineProperty(xhr, key, { configurable: true, value: value }); };
    X.open = function (method, url) {
      this.__path = find(url);
      if (this.__path === null) return open.apply(this, arguments);
    };
    X.setRequestHeader = function () {
      if (this.__path == null) return header.apply(this, arguments);
    };
    X.send = function () {
      var xhr = this, path = xhr.__path;
      if (path == null) return send.apply(xhr, arguments);
      later(function () {
        var type = xhr.responseType || 'text', bytes = files[path], body;
        if (type === 'arraybuffer') body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        else if (type === 'blob') body = new Blob([bytes], { type: mime(path) });
        else if (type === 'json') body = JSON.parse(text(path));
        else { body = text(path); put(xhr, 'responseText', body); }
        put(xhr, 'response', body);
        put(xhr, 'status', 200);
        put(xhr, 'statusText', 'OK');
        put(xhr, 'readyState', 4);
        ['readystatechange', 'load', 'loadend'].forEach(function (name) { xhr.dispatchEvent(new Event(name)); });
      });
    };
    var realFetch = window.fetch;
    if (!realFetch) return;
    window.fetch = function (url) {
      var path = find(url);
      if (path === null) return realFetch.apply(this, arguments);
      return Promise.resolve(new Response(files[path], { status: 200, headers: { 'Content-Type': mime(path) } }));
    };
  }

  function lazyAudio() {
    var Real = window.AudioContext || window.webkitAudioContext;
    if (!Real || typeof Proxy === 'undefined') return;
    var Lazy = function () {
      var real = null, pending = {};
      var make = function () {
        if (!real) {
          real = new Real();
          for (var key in pending) real[key] = pending[key];
        }
        return real;
      };
      return new Proxy({}, {
        get: function (_, key) {
          var value = make()[key];
          return typeof value === 'function' ? value.bind(real) : value;
        },
        set: function (_, key, value) {
          if (real) real[key] = value; else pending[key] = value;
          return true;
        },
      });
    };
    window.AudioContext = Lazy;
    if (window.webkitAudioContext) window.webkitAudioContext = Lazy;
  }

  function patchModules() {
    var proto = System.constructor.prototype, resolve = proto.resolve;
    proto.resolve = function (id, parent) {
      if (id === 'cc') return ROOT + 'cocos-js/cc.js';
      if (/^\.\.?\//.test(id) && (!parent || parent.indexOf(ROOT) === 0)) {
        var dir = parent ? parent.slice(ROOT.length, parent.lastIndexOf('/') + 1) : '';
        var path = tidy(dir + id);
        if (files[path]) return ROOT + path;
      }
      return resolve.call(this, id, parent);
    };
    var instantiate = proto.instantiate;
    proto.instantiate = function (url, parent) {
      var path = url.indexOf(ROOT) === 0 ? url.slice(ROOT.length) : '';
      if (!files[path]) return instantiate.call(this, url, parent);
      var el = document.createElement('script');
      el.text = text(path) + '\n//# sourceURL=' + path;
      document.head.appendChild(el);
      document.head.removeChild(el);
      return this.getRegister(url);
    };
  }

  window.playablePack = {
    start: function () {
      return unpack(document.getElementById('playable-pack')).then(function () {
        lazyAudio();
        patchElements();
        patchCss();
        patchRequests();
        patchModules();
        return System.import('./index.js');
      }).catch(function (e) { console.error('[playable]', e); });
    },
    inflateJs: inflateJs,
  };
})();
