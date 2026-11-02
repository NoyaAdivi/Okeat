// Read text aloud with the browser's built-in voices (Web Speech API).
// Hebrew voices exist on Windows, Android and iOS; if none is installed we fall back to the default voice.

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

const pageIsEnglish = () => typeof document !== 'undefined' && document.documentElement.lang === 'en';

function englishVoice(): SpeechSynthesisVoice | undefined {
  return window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('en'));
}

function hebrewVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang?.toLowerCase().startsWith('he')) ?? voices.find((v) => v.lang?.toLowerCase().startsWith('iw'));
}

export function hasHebrewVoice(): boolean {
  return speechSupported() && !!hebrewVoice();
}

export function speak(text: string, opts: { interrupt?: boolean; rate?: number } = {}) {
  if (!speechSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  const say = () => {
    // Long text is split into sentences: some browsers stop reading long utterances.
    const parts = text.replace(/\s+/g, ' ').match(/[^.!?\n]+[.!?]?/g) ?? [text];
    for (const part of parts) {
      const u = new SpeechSynthesisUtterance(part.trim());
      u.lang = pageIsEnglish() ? 'en-US' : 'he-IL';
      const v = pageIsEnglish() ? englishVoice() : hebrewVoice();
      if (v) u.voice = v;
      u.rate = opts.rate ?? 1;
      synth.speak(u);
    }
  };
  synth.resume(); // Chrome can stay paused after a tab sleeps
  const busy = synth.speaking || synth.pending;
  if ((opts.interrupt ?? true) && busy) {
    // Some browsers drop what is spoken right after cancel(), so wait a moment.
    synth.cancel();
    setTimeout(say, 80);
  } else {
    say();
  }
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}

/** Visible text of an element, skipping things marked aria-hidden. */
export function readableText(root: Element): string {
  const clone = root.cloneNode(true) as Element;
  clone.querySelectorAll('[aria-hidden="true"], script, style, svg, .a11y').forEach((n) => n.remove());
  return (clone as HTMLElement).innerText ?? clone.textContent ?? '';
}
