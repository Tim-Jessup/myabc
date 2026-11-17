#!/usr/bin/env python3
"""Make Pip's voice: one MP3 per spoken line, plus audio/index.json.

Uses the Kokoro-82M voice model (Apache-2.0) through the kokoro-onnx package.
Only lines that are new or changed are generated, so it is quick to re-run after
editing js/lines.js or js/data.js.

  pip install kokoro-onnx
  python tools/make_voice.py --model kokoro-v1.0.onnx --voices voices-v1.0.bin [--voice af_heart]

Needs node (to read the line list) and ffmpeg (to make MP3s).
"""
import argparse, hashlib, json, os, re, subprocess, sys, tempfile, wave
from concurrent.futures import ProcessPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, 'audio')

# Letters are said by name. Spelling the names out stops the model reading "A" as "uh".
NAMES = dict(A='eigh', B='bee', C='see', D='dee', E='ee', F='ef', G='jee', H='aitch', I='eye', J='jay',
             K='kay', L='ell', M='em', N='en', O='oh', P='pee', Q='cue', R='are', S='ess', T='tee',
             U='you', V='vee', W='double you', X='ex', Y='why', Z='zed')


# How each letter name must come out (IPA, stress marks removed). Checked before recording,
# because the model reads some spellings oddly ("eff" came out as "E-F-F", "ay" as "eye").
EXPECT = dict(A='eɪ', B='biː', C='siː', D='diː', E='iː', F='ɛf', G='dʒiː', H='eɪtʃ', I='aɪ', J='dʒeɪ',
              K='keɪ', L='ɛl', M='ɛm', N='ɛn', O='oʊ', P='piː', Q='kjuː', R='ɑːɹ', S='ɛs', T='tiː',
              U='juː', V='viː', W='dʌbəl juː', X='ɛks', Y='waɪ', Z='zɛd')


def check_names(model, voices, lang):
    import warnings; warnings.filterwarnings('ignore')
    from kokoro_onnx import Kokoro
    k = Kokoro(model, voices)
    bad = []
    for L, name in NAMES.items():
        for text in (name + '.', f'Find the letter {name}.'):
            got = k.tokenizer.phonemize(text, lang).replace('ˈ', '').replace('ˌ', '').rstrip('.').strip()
            if not got.endswith(' ' + EXPECT[L]) and got != EXPECT[L]:
                bad.append(f'{L}: {text!r} -> {got!r} (want ...{EXPECT[L]})')
    if bad:
        sys.exit('Letter names would be mispronounced:\n  ' + '\n  '.join(bad))


def list_lines():
    js = ("const vm=require('vm'),fs=require('fs');"
          f"vm.runInThisContext(fs.readFileSync({json.dumps(os.path.join(ROOT, 'js/data.js'))},'utf8')+';globalThis.DATA=DATA;');"
          f"vm.runInThisContext(fs.readFileSync({json.dumps(os.path.join(ROOT, 'js/curriculum.js'))},'utf8')+';globalThis.CURRICULUM=CURRICULUM;');"
          f"const L=require({json.dumps(os.path.join(ROOT, 'js/lines.js'))});"
          "console.log(JSON.stringify(L.all(DATA, CURRICULUM).map(s=>[L.key(s),s])));")
    return json.loads(subprocess.check_output(['node', '-e', js], text=True))


def spoken(line):
    """The text actually given to the voice model."""
    t = line.strip()
    if re.fullmatch(r'[A-Z]\W*', t):  # a letter on its own
        return NAMES[t[0]] + '.'
    # a capital letter standing alone is a letter name, except the word I (I'm, I see)
    t = re.sub(r"\b([A-Z])\b(?!')", lambda m: m.group(1) if m.group(1) == 'I' and re.match(r"I [a-z]", t[m.start():]) else NAMES[m.group(1)], t)
    t = t.replace(':', ',')
    return t[0].upper() + t[1:] if ' ' in t else t  # a lone word keeps its case ("a" is not "A")


_k = None
def synth(job):
    global _k
    key, text, path, model, voices, voice, lang, speed = job
    if _k is None:
        import warnings; warnings.filterwarnings('ignore')
        from kokoro_onnx import Kokoro
        _k = Kokoro(model, voices)
    import numpy as np
    a, sr = _k.create(text, voice=voice, speed=speed, lang=lang)
    pad = np.zeros(int(sr * 0.06), dtype=np.float32)
    a = np.concatenate([pad, a, pad])
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        tmp = f.name
    w = wave.open(tmp, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp, '-af', 'loudnorm=I=-16:TP=-1.5',
                    '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '40k', path], check=True)
    os.unlink(tmp)
    return key


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--voices', required=True)
    ap.add_argument('--voice', default='af_heart')
    ap.add_argument('--speed', type=float, default=0.9)
    ap.add_argument('--jobs', type=int, default=max(1, (os.cpu_count() or 2) // 2))
    args = ap.parse_args()
    lang = 'en-gb' if args.voice.startswith('b') else 'en-us'
    os.makedirs(AUDIO, exist_ok=True)
    check_names(args.model, args.voices, lang)

    clips, jobs = {}, []
    for key, line in list_lines():
        if key in clips:
            continue
        text = spoken(line)
        name = hashlib.sha1(f'{args.voice}|{args.speed}|{text}'.encode()).hexdigest()[:12]
        clips[key] = name
        path = os.path.join(AUDIO, name + '.mp3')
        if not os.path.exists(path):
            jobs.append((key, text, path, args.model, args.voices, args.voice, lang, args.speed))

    print(f'{len(clips)} lines, {len(jobs)} to make', flush=True)
    done = 0
    with ProcessPoolExecutor(args.jobs) as ex:
        for _ in ex.map(synth, jobs, chunksize=4):
            done += 1
            if done % 50 == 0:
                print(f'  {done}/{len(jobs)}', flush=True)

    keep = set(clips.values())
    for f in os.listdir(AUDIO):
        if f.endswith('.mp3') and f[:-4] not in keep:
            os.unlink(os.path.join(AUDIO, f))
    with open(os.path.join(AUDIO, 'index.json'), 'w') as f:
        json.dump({'voice': args.voice, 'speed': args.speed, 'clips': dict(sorted(clips.items()))}, f, indent=0)
    print('done', flush=True)


if __name__ == '__main__':
    main()
