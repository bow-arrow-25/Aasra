let sharedCtx = null;

function getSharedContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedCtx) sharedCtx = new AudioContextClass();
  return sharedCtx;
}

export function unlockAudio() {
  const ctx = getSharedContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

export function startPhoneRing() {
  const ctx = getSharedContext();
  if (!ctx) return () => {};
  ctx.resume().catch(() => {});

  let stopped = false;
  const nodes = [];

  function burst() {
    if (stopped) return;
    try {
      const now = ctx.currentTime;
      [
        [0, 440],
        [0, 480],
        [0.55, 440],
        [0.55, 480],
      ].forEach(([offset, freq]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.09, now + offset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.42);
        nodes.push(osc, gain);
      });
    } catch {
      /* autoplay or unsupported */
    }
    try {
      navigator.vibrate?.([400, 180, 400, 1400]);
    } catch {
      /* ignore */
    }
  }

  burst();
  const timer = window.setInterval(burst, 2200);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    nodes.forEach((node) => {
      try {
        if (typeof node.stop === "function") node.stop();
        node.disconnect?.();
      } catch {
        /* ignore */
      }
    });
    try {
      navigator.vibrate?.(0);
    } catch {
      /* ignore */
    }
  };
}

export function silentWavDataUrl(durationSec = 2) {
  const sampleRate = 8000;
  const numSamples = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);

  function writeString(offset, value) {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeString(36, "data");
  view.setUint32(40, numSamples, true);
  for (let i = 0; i < numSamples; i += 1) {
    view.setUint8(44 + i, 128);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export function startSoftChime(intervalMs = 3000) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return () => {};

  let ctx = null;
  function ding() {
    try {
      if (!ctx) ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 523.25;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.72);
    } catch {
      /* autoplay or unsupported */
    }
  }

  ding();
  const timer = window.setInterval(ding, intervalMs);
  return () => {
    window.clearInterval(timer);
    try {
      ctx?.close();
    } catch {
      /* ignore */
    }
  };
}
