import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.__DEV__ = false;

const { DICTATION_SAMPLE_RATE, encodeWav, levelOf } = await import("./audio.ts");
const { SpeechSegmenter } = await import("./segmenter.ts");
const { dictationLanguage, forCommandBar, joinTranscript, spliceDictation } = await import("./transcript.ts");
const { aliaTranscriber, DictationFailure } = await import("./alia.ts");
const dictation = await import("./dictation.ts");
const { useOxySession } = await import("../../oxy/session.ts");

const ms = (n) => Math.round((DICTATION_SAMPLE_RATE * n) / 1000);
const speech = (duration) => Float32Array.from({ length: ms(duration) }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 220 * i) / DICTATION_SAMPLE_RATE));
const silence = (duration) => new Float32Array(ms(duration));
const join = (...chunks) => {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
};
const feed = (segmenter, audio, mayCut) => {
  const segments = [];
  for (let at = 0; at < audio.length; at += 640) segments.push(...segmenter.push(audio.subarray(at, at + 640), mayCut).segments);
  return segments;
};

test("a WAV is 16-bit mono PCM at 16 kHz", () => {
  const wav = encodeWav(Float32Array.from([0, 1, -1, 0.5]));
  const view = new DataView(wav.buffer);
  assert.equal(String.fromCharCode(...wav.subarray(0, 4)), "RIFF");
  assert.equal(String.fromCharCode(...wav.subarray(8, 12)), "WAVE");
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 8);
  assert.deepEqual([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true)], [0, 32767, -32768]);
  assert.equal(wav.length, 52);
});

test("the meter reads quiet as 0 and loud as 1", () => {
  assert.equal(levelOf(0), 0);
  assert.equal(levelOf(0.0005), 0);
  assert.equal(levelOf(1), 1);
  assert.ok(levelOf(0.05) > 0.3 && levelOf(0.05) < 0.9);
});

test("silence is never cut into a segment", () => {
  const segmenter = new SpeechSegmenter();
  assert.deepEqual(feed(segmenter, silence(5000)), []);
  assert.equal(segmenter.flush(), null);
});

test("a pause after a phrase cuts it, with a little lead and tail", () => {
  const segmenter = new SpeechSegmenter();
  const segments = feed(segmenter, join(silence(1000), speech(2000), silence(800), speech(1500), silence(200)));
  assert.equal(segments.length, 1);
  const [first] = segments;
  assert.ok(first.durationMs >= 2000 + 280 && first.durationMs <= 2000 + 300 + 260, `${first.durationMs}`);
  assert.ok(first.voicedMs >= 1980);
  const last = segmenter.flush();
  assert.ok(last && last.voicedMs >= 1480, JSON.stringify(last && last.voicedMs));
  assert.ok(last.durationMs <= 300 + 1500 + 260);
});

test("a short pause inside a sentence doesn't cut it", () => {
  const segmenter = new SpeechSegmenter();
  assert.deepEqual(feed(segmenter, join(speech(1500), silence(450), speech(1500))), []);
});

test("a phrase shorter than the minimum waits for the next pause", () => {
  const segmenter = new SpeechSegmenter();
  const segments = feed(segmenter, join(speech(600), silence(800), speech(900), silence(800)));
  assert.equal(segments.length, 1);
  assert.ok(segments[0].voicedMs >= 1450);
});

test("a click is dropped, never sent", () => {
  const segmenter = new SpeechSegmenter();
  assert.deepEqual(feed(segmenter, join(silence(500), speech(100), silence(2000))), []);
  assert.equal(segmenter.flush(), null);
});

test("long speech is cut at 15 s at its quietest moment", () => {
  const segmenter = new SpeechSegmenter();
  const segments = feed(segmenter, join(speech(14000), silence(200), speech(4000)));
  assert.equal(segments.length, 1);
  assert.ok(segments[0].forced);
  assert.ok(Math.abs(segments[0].durationMs - 14020) <= 200, `${segments[0].durationMs}`);
});

test("the cut budget holds a pause cut until it allows one", () => {
  const segmenter = new SpeechSegmenter();
  let allowed = false;
  assert.deepEqual(feed(segmenter, join(speech(1500), silence(800)), () => allowed), []);
  allowed = true;
  assert.equal(feed(segmenter, silence(40), () => allowed).length, 1);
});

test("parts join into one text; a cut mid-sentence loses its period", () => {
  assert.equal(joinTranscript(["Hello there.", "How are you?"]), "Hello there. How are you?");
  assert.equal(joinTranscript(["I went to the", "  store and back. "]), "I went to the store and back.");
  assert.equal(joinTranscript(["I went to the store.", "and back."]), "I went to the store and back.");
  assert.equal(joinTranscript(["Wait...", "and then"]), "Wait... and then");
  assert.equal(joinTranscript(["", "One.", ""]), "One.");
});

test("the command bar drops a lone sentence's period, never a question mark", () => {
  assert.equal(forCommandBar("Weather in Barcelona."), "Weather in Barcelona");
  assert.equal(forCommandBar("What is the weather?"), "What is the weather?");
  assert.equal(forCommandBar("One. Two."), "One. Two.");
  assert.equal(forCommandBar("Wait..."), "Wait...");
});

test("dictated text goes in at the caret with a space on each side", () => {
  assert.deepEqual(spliceDictation("", "hello", ""), { value: "hello", caret: 5 });
  assert.deepEqual(spliceDictation("search", "cats", ""), { value: "search cats", caret: 11 });
  assert.deepEqual(spliceDictation("a ", "b", "c"), { value: "a b c", caret: 3 });
  assert.deepEqual(spliceDictation("a", "b", ", c"), { value: "a b, c", caret: 3 });
  assert.deepEqual(spliceDictation("keep", "", " me"), { value: "keep me", caret: 4 });
});

test("the language is the BCP 47 tag Alia accepts", () => {
  assert.equal(dictationLanguage("en-US"), "en-US");
  assert.equal(dictationLanguage("de-DE-u-co-phonebk"), "de-DE");
  assert.equal(dictationLanguage("not a tag"), "en");
});

test("Alia gets a multipart WAV and its refusals become codes", async () => {
  const seen = [];
  let answer = { status: 200, body: { text: "hola" } };
  const send = async (url, init) => {
    seen.push({ url, init });
    return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { "Content-Type": "application/json" } });
  };
  const transcribe = aliaTranscriber("https://api.alia.example", send, () => ({ Authorization: "Bearer t" }));
  const clip = { wav: encodeWav(speech(100)), durationMs: 100.4 };
  assert.equal(await transcribe(clip, "es-ES", new AbortController().signal), "hola");
  assert.equal(seen[0].url, "https://api.alia.example/v1/audio/transcriptions");
  assert.equal(seen[0].init.method, "POST");
  assert.equal(seen[0].init.headers.Authorization, "Bearer t");
  const form = seen[0].init.body;
  assert.equal(form.get("language"), "es-ES");
  assert.equal(form.get("durationMs"), "100");
  assert.equal(form.get("file").type, "audio/wav");
  assert.equal(form.get("file").name, "dictation.wav");
  for (const [status, code, expected] of [
    [503, "TRANSCRIPTION_UNAVAILABLE", "unavailable"],
    [429, "TRANSCRIPTION_LIMITED", "limited"],
    [422, "TRANSCRIPTION_REJECTED", "rejected"],
    [413, "CLIP_TOO_LONG", "too-long"],
    [401, "NOT_AUTHENTICATED", "not-signed-in"],
    [502, "SOMETHING_NEW", "failed"],
  ]) {
    answer = { status, body: { error: { code, message: "x" } } };
    await assert.rejects(transcribe(clip, "en", new AbortController().signal), (e) => e instanceof DictationFailure && e.code === expected);
  }
  const offline = aliaTranscriber("https://x", async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(offline(clip, "en", new AbortController().signal), (e) => e instanceof DictationFailure && e.code === "failed" && e.retryable);
});

function rig({ answers = (i) => `part ${i}` } = {}) {
  const sent = [];
  let onAudio = null;
  let closed = 0;
  let opened = 0;
  const unregisterCapture = dictation.registerDictationCapture({
    open: async (listener) => {
      opened++;
      onAudio = listener;
      return { close: () => closed++ };
    },
  });
  const unregisterTranscriber = dictation.registerDictationTranscriber(async (clip, language, signal) => {
    const i = sent.length;
    sent.push({ clip, language, signal });
    await new Promise((r) => setTimeout(r, 5));
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const answer = answers(i);
    if (answer instanceof Error) throw answer;
    return answer;
  });
  const shown = [];
  let restored = 0;
  const sink = { apply: (text) => shown.push(text), restore: () => restored++ };
  const play = (audio) => {
    for (let at = 0; at < audio.length; at += 640) onAudio?.(audio.slice(at, at + 640));
  };
  return {
    sent,
    shown,
    sink,
    play,
    get restored() {
      return restored;
    },
    get closed() {
      return closed;
    },
    get opened() {
      return opened;
    },
    done() {
      dictation.cancelDictation();
      unregisterCapture();
      unregisterTranscriber();
    },
  };
}

const settle = () => new Promise((r) => setTimeout(r, 30));
useOxySession.setState({ account: { id: "u1", name: "Test", handle: "test", email: null, avatar: null, color: null } });

test("signed out, dictation says to sign in and opens no microphone", async () => {
  useOxySession.setState({ account: null });
  const r = rig();
  await dictation.beginDictation("bar", r.sink);
  assert.equal(r.opened, 0);
  assert.equal(dictation.useDictation.getState().error?.code, "not-signed-in");
  r.done();
  useOxySession.setState({ account: { id: "u1", name: "Test", handle: "test", email: null, avatar: null, color: null } });
});

test("phrases stream into the field as they're transcribed, in order, and stop closes the microphone", async () => {
  const r = rig();
  assert.equal(r.opened, 0);
  await dictation.beginDictation("bar", r.sink);
  assert.equal(r.opened, 1);
  assert.equal(dictation.useDictation.getState().phase, "listening");
  r.play(join(silence(500), speech(1500), silence(800)));
  assert.equal(r.sent.length, 1);
  await settle();
  assert.deepEqual(r.shown, ["part 0"]);
  r.play(join(speech(1300), silence(300)));
  const finished = dictation.endDictation("bar");
  assert.equal(r.closed, 1);
  assert.equal(dictation.useDictation.getState().phase, "finishing");
  await finished;
  assert.equal(r.sent.length, 2);
  assert.deepEqual(r.shown, ["part 0", "part 0 part 1"]);
  assert.equal(dictation.useDictation.getState().phase, "idle");
  assert.equal(r.sent[0].clip.wav.length, 44 + r.sent[0].clip.durationMs * 32);
  r.done();
});

test("nothing is sent for a dictation that heard no speech", async () => {
  const r = rig();
  await dictation.beginDictation("bar", r.sink);
  r.play(silence(3000));
  await dictation.endDictation("bar");
  assert.equal(r.sent.length, 0);
  assert.deepEqual(r.shown, []);
  r.done();
});

test("cancel stops the microphone, drops what's in flight and restores the field", async () => {
  const r = rig();
  await dictation.beginDictation("bar", r.sink);
  r.play(join(speech(1500), silence(700)));
  assert.equal(r.sent.length, 1);
  dictation.cancelDictation("bar");
  assert.equal(r.closed, 1);
  assert.ok(r.sent[0].signal.aborted);
  assert.equal(r.restored, 1);
  await settle();
  assert.deepEqual(r.shown, []);
  assert.equal(dictation.useDictation.getState().phase, "idle");
  r.done();
});

test("a refusal stops dictation, keeps what was transcribed and says why", async () => {
  const r = rig({ answers: (i) => (i === 0 ? "kept" : new DictationFailure("limited")) });
  await dictation.beginDictation("bar", r.sink);
  r.play(join(speech(1500), silence(700)));
  await settle();
  r.play(join(speech(1500), silence(700)));
  await settle();
  assert.equal(r.closed, 1);
  assert.deepEqual(r.shown, ["kept"]);
  assert.equal(r.restored, 0);
  const state = dictation.useDictation.getState();
  assert.equal(state.phase, "idle");
  assert.equal(state.error?.code, "limited");
  assert.equal(state.error?.key, "bar");
  r.done();
});

test("a segment Alia can't read is skipped, the rest goes on", async () => {
  const r = rig({ answers: (i) => (i === 0 ? new DictationFailure("rejected") : "after") });
  await dictation.beginDictation("bar", r.sink);
  r.play(join(speech(1500), silence(700), speech(1500), silence(700)));
  await dictation.endDictation("bar");
  assert.deepEqual(r.shown, ["after"]);
  assert.equal(dictation.useDictation.getState().error, null);
  r.done();
});

test("a microphone the system refuses is an error, not a recording", async () => {
  const r = rig();
  const deny = dictation.registerDictationCapture({
    open: async () => {
      throw new dictation.DictationCaptureError("mic-denied");
    },
  });
  await dictation.beginDictation("composer:w1", r.sink);
  const state = dictation.useDictation.getState();
  assert.equal(state.phase, "idle");
  assert.equal(state.error?.code, "mic-denied");
  assert.match(state.error?.message ?? "", /microphone/);
  deny();
  r.done();
});

test("holding the button talks until release; a click toggles", async () => {
  const r = rig();
  const begin = (mode) => void dictation.beginDictation("bar", r.sink, mode);
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    dictation.pressDictation("bar", begin);
    await settle();
    assert.equal(dictation.useDictation.getState().mode, "hold");
    now += 900;
    dictation.releaseDictation("bar");
    assert.equal(dictation.useDictation.getState().phase, "idle");
    assert.equal(r.closed, 1);

    dictation.pressDictation("bar", begin);
    await settle();
    now += 120;
    dictation.releaseDictation("bar");
    assert.equal(dictation.useDictation.getState().phase, "listening");
    assert.equal(dictation.useDictation.getState().mode, "toggle");
    dictation.pressDictation("bar", begin);
    now += 80;
    dictation.releaseDictation("bar");
    await settle();
    assert.equal(dictation.useDictation.getState().phase, "idle");
    assert.equal(r.closed, 2);
  } finally {
    Date.now = realNow;
    r.done();
  }
});

test("a field going away cancels its dictation", async () => {
  const r = rig();
  const unregister = dictation.registerDictationField("bar", { element: () => "node", begin: () => {} });
  assert.deepEqual(Object.keys(dictation.dictationFieldAt("node") ?? {}), ["key", "begin"]);
  assert.equal(dictation.dictationFieldAt("other"), null);
  await dictation.beginDictation("bar", r.sink);
  unregister();
  assert.equal(r.closed, 1);
  assert.equal(r.restored, 1);
  assert.equal(dictation.useDictation.getState().phase, "idle");
  r.done();
});

test("the test endpoint takes only loopback with a bearer", () => {
  assert.equal(dictation.setDictationTestEndpoint("https://api.alia.onl", "x"), false);
  assert.equal(dictation.setDictationTestEndpoint("http://127.0.0.1:8796", ""), false);
  assert.equal(dictation.setDictationTestEndpoint("http://127.0.0.1:8796", "x"), true);
  assert.equal(dictation.setDictationTestEndpoint(null), true);
});
