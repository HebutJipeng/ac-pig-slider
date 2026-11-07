import { mouthPose, characterForm, speechEnvelope, audioOutputTime } from './domain.js';
// The .riv layers the approved illustrations, local facial repairs and regenerated mouth sprites driven by Rive.
const asset = path => new URL(`../public/${path}`, import.meta.url).href;
let loading, audioContext;
const clips = new Map();
export function unlockVoice() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return Promise.reject(new Error('Web Audio unavailable'));
  audioContext ??= new Context({ latencyHint: 'interactive' });
  return audioContext.resume();
}
async function decodedClip(file) {
  if (!clips.has(file)) clips.set(file, (async () => {
    const response = await fetch(asset(`rive/${file}`), { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Audio failed to load');
    const buffer = await audioContext.decodeAudioData(await response.arrayBuffer());
    return { buffer, ...speechEnvelope(buffer.getChannelData(0), buffer.sampleRate) };
  })().catch(error => { clips.delete(file); throw error; }));
  return clips.get(file);
}
export function loadCharacter(canvas) {
  loading ??= Promise.all([
    new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = asset('vendor/rive/rive.js'); script.onload = resolve;
      script.onerror = () => { script.remove(); reject(new Error('Rive runtime failed to load')); };
      document.head.append(script);
    }),
    fetch(asset('rive/speech.json')).then(response => { if (!response.ok) throw new Error('Speech failed to load'); return response.json(); }),
  ]).catch(error => { loading = null; throw error; });
  return loading.then(([, speech]) => new Promise((resolve, reject) => {
    window.rive.RuntimeLoader.setWasmUrl(asset('vendor/rive/rive.wasm'));
    window.rive.RuntimeLoader.setWasmFallbackUrl(asset('vendor/rive/rive_fallback.wasm'));
    const character = new window.rive.Rive({
      src: asset('rive/ac-mascot.riv'), canvas, stateMachine: 'Character', autoplay: true, autoBind: true,
      onLoadError: reject,
      onLoad: () => {
        const model = character.viewModelInstance;
        const properties = Object.fromEntries(['pig', 'human', 'reborn', 'mouthOpen', 'mouthWide', 'embarrassed', 'ready', 'talking', 'mouthClosed', 'mouthSmall', 'mouthFull', 'mouthRound'].map(key => [key, model?.number(key)]));
        if (Object.values(properties).some(property => !property)) { character.cleanup(); reject(new Error('Rive bindings missing')); return; }
        character.resizeDrawingSurfaceToCanvas();
        let audio = null, frame = 0, generation = 0;
        const progress = document.querySelector('#defense-progress');
        const mouth = (pose = null) => {
          properties.talking.value = pose === null ? 0 : 1;
          for (const name of ['mouthClosed', 'mouthSmall', 'mouthFull', 'mouthRound']) properties[name].value = name === pose ? 1 : 0;
        };
        const stop = () => {
          generation++; cancelAnimationFrame(frame); frame = 0;
          if (audio) {
            audio.source.onended = null;
            try { audio.source.stop(); } catch { /* The source may already have ended. */ }
            audio.source.disconnect(); audio.gain.disconnect(); audio = null;
          }
          progress.hidden = true; progress.value = 0;
          mouth();
        };
        resolve({
          async show(level) {
            canvas.hidden = false;
            const form = characterForm(level);
            for (const name of ['reborn', 'human', 'pig']) properties[name].value = name === form ? 1 : 0;
            properties.embarrassed.value = 0;
            character.resizeDrawingSurfaceToCanvas(); character.play();
            const run = generation;
            // The free export draws its official splash over the running artboard.
            // Wait for the authored portrait backdrop to be visible before starting audio.
            await new Promise((resolveReady, rejectReady) => {
              const started = performance.now();
              const check = () => {
                if (run !== generation) { rejectReady(new Error('Rive startup cancelled')); return; }
                if (performance.now() - started > 15000) { rejectReady(new Error('Rive startup timed out')); return; }
                const pixel = canvas.getContext('2d').getImageData(2, 2, 1, 1).data;
                if (properties.ready.value >= 1 && pixel[0] + pixel[1] + pixel[2] > 300 && pixel[3] === 255) resolveReady();
                else requestAnimationFrame(check);
              };
              requestAnimationFrame(check);
            });
          },
          hide() { stop(); canvas.hidden = true; character.pause(); },
          stop,
          caught() { properties.embarrassed.value = 1; mouth(); },
          async speak(text, muted, done, failed) {
            stop(); const run = generation;
            const clip = speech[text];
            if (!clip) { failed(); return; }
            try {
              await unlockVoice();
              if (run !== generation) return;
              const { buffer, step, levels } = await decodedClip(clip.file);
              if (run !== generation) return;
              if (audioContext.state !== 'running') throw new Error('Audio context suspended');
              const source = audioContext.createBufferSource();
              const gain = audioContext.createGain();
              source.buffer = buffer; gain.gain.value = muted ? 0 : 1;
              source.connect(gain); gain.connect(audioContext.destination);
              audio = { source, gain };
              const startsAt = audioContext.currentTime + .03;
              progress.max = buffer.duration; progress.value = 0; progress.hidden = false;
              mouth('mouthClosed');
              source.start(startsAt);
              const animate = now => {
                if (run !== generation) return;
                // Use the very same decoded samples and audible output clock as playback.
                const elapsed = audioOutputTime(audioContext, now) - startsAt;
                progress.value = Math.max(0, Math.min(buffer.duration, elapsed));
                if (elapsed >= buffer.duration) { stop(); done(); return; }
                const volume = elapsed < 0 ? 0 : levels[Math.floor(elapsed / step)] || 0;
                mouth(mouthPose(volume, text === '哼唧。'));
                frame = requestAnimationFrame(animate);
              };
              frame = requestAnimationFrame(animate);
            } catch {
              if (run !== generation) return;
              stop(); failed();
            }
          },
          resize() { character.resizeDrawingSurfaceToCanvas(); },
        });
      },
    });
  }));
}
