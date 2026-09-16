// Run: node tests/wav.cjs (Node 18+, ffmpeg and ffprobe on PATH).
// Fixtures are generated in a temporary directory and removed after the run.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scripts = ['parser', 'writer', 'wav'].map(id => html.match(new RegExp('<script id="' + id + '">([\\s\\S]*?)</script>'))[1]);
const api = vm.runInThisContext('(()=>{' + scripts.join('\n') + ';return {reader:AudioMetadata,writer:AudioWriter};})()');
const {reader, writer} = api;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-metadata-test-'));
const C = (...parts) => Buffer.concat(parts.map(p => Buffer.from(p)));
const B = s => Buffer.from(s, 'latin1');
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const ss = n => Buffer.from([n >>> 21 & 127, n >>> 14 & 127, n >>> 7 & 127, n & 127]);
const chunk = (id, data, pad = 0) => C(B(id), u32(data.length), data, data.length % 2 ? [pad] : []);
const riff = (...parts) => { const body = C(B('WAVE'), ...parts); return C(B('RIFF'), u32(body.length), body); };
const frame = (id, payload) => C(B(id), ss(payload.length), [0, 0], payload);
const id3 = (...frames) => { const body = C(...frames); return C(B('ID3'), [4, 0, 0], ss(body.length), body); };
const blob = (b, name = 'test.wav') => Object.assign(new Blob([b]), {name});
const field = (r, id) => r.tags.flatMap(t => t.entries).find(f => f.id === id);
// Independent RIFF traversal used to compare actual serialized chunk bytes.
function chunks(b) {
  const result = []; const end = b.readUInt32LE(4) + 8;
  for (let p = 12; p < end;) {
    const n = b.readUInt32LE(p + 4), next = p + 8 + n + n % 2;
    assert(next <= end); result.push({id: b.toString('latin1', p, p + 4), raw: b.subarray(p, next), data: b.subarray(p + 8, p + 8 + n)}); p = next;
  }
  return result;
}
async function edit(bytes, change, kind = 'info') {
  const file = blob(bytes), before = await reader.parse(file);
  const index = before.tags.findIndex(t => t.waveKind === kind);
  const key = index < 0 ? kind === 'info' ? 'new-info' : 'new' : String(index);
  const d = writer.makeDraft(index < 0 ? null : before.tags[index], key, before);
  assert(!d.error, d.error); await change(d, before);
  const out = await writer.build(file, before, new Map([[key, d]]));
  const bytesOut = Buffer.from(await out.arrayBuffer()), after = await reader.parse(blob(bytesOut));
  assert.equal(after.wave.valid, true); assert.equal(out.type, 'audio/wav');
  assert.deepEqual(chunks(bytesOut).filter(c => c.id === 'data').map(c => c.data), chunks(bytes).filter(c => c.id === 'data').map(c => c.data), 'Audio sample bytes changed');
  assert.equal(bytesOut.readUInt32LE(4) + 8, after.wave.riffEnd);
  return {before, after, bytes: bytesOut};
}
function ffmpeg(args) { return cp.execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]); }
function generate(name, codec, extra = []) {
  const output = path.join(dir, name);
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=0.2', '-ac', '2', '-c:a', codec,
    '-metadata', 'title=Original WAV', '-metadata', 'artist=Sample Artist', '-metadata', 'description=Original broadcast description',
    '-metadata', 'originator=Recorder', '-metadata', 'coding_history=A=PCM,F=48000', '-write_bext', '1', ...extra, output]);
  return fs.readFileSync(output);
}
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }
(async () => {
  let pcm;
  for (const [name, codec, depth] of [['pcm', 'pcm_s16le', 16], ['pcm24', 'pcm_s24le', 24], ['float', 'pcm_f32le', 32]]) {
    await test(name + ': native Unicode INFO edits, FFprobe read and identical decoded audio', async () => {
      const bytes = generate(name + '.wav', codec); if (name === 'pcm') pcm = bytes;
      const x = await edit(bytes, d => {
        d.rows.find(r => r.id === 'INAM').text = 'Edited café — 日本語 🎵';
        d.rows.find(r => r.id === 'IART').removed = true;
        writer.add(d, 'ICMT').text = 'Comment\nSecond line';
        const custom = writer.add(d, 'CUSTOM'); custom.id = 'IKEY'; custom.text = 'Custom value';
      });
      assert.equal(x.after.audio.bitsPerSample, depth); assert.equal(x.after.audio.durationSeconds, 0.2);
      assert.equal(field(x.after, 'INAM').value, 'Edited café — 日本語 🎵'); assert(!field(x.after, 'IART'));
      assert.deepEqual(chunks(x.bytes).filter(c => c.id !== 'LIST').map(c => c.raw), chunks(bytes).filter(c => c.id !== 'LIST').map(c => c.raw));
      const output = path.join(dir, name + '-edited.wav'); fs.writeFileSync(output, x.bytes);
      const tags = JSON.parse(cp.execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format_tags', '-of', 'json', output])).format.tags;
      assert.equal(tags.title, 'Edited café — 日本語 🎵'); assert.equal(tags.comment, 'Comment\nSecond line'); assert(!tags.artist);
      assert.deepEqual(ffmpeg(['-i', output, '-map', '0:a', '-f', 'md5', '-']), ffmpeg(['-i', path.join(dir, name + '.wav'), '-map', '0:a', '-f', 'md5', '-']));
    });
  }
  const originalChunks = chunks(pcm), fmt = originalChunks.find(c => c.id === 'fmt ').raw, data = originalChunks.find(c => c.id === 'data').raw;
  const plain = riff(fmt, data);
  await test('Add INFO to an untagged WAV and remove the complete INFO block', async () => {
    const x = await edit(plain, d => writer.add(d, 'INAM').text = 'New title');
    const y = await edit(x.bytes, d => d.rows.forEach(r => r.removed = true));
    assert.deepEqual(y.bytes, plain);
  });
  await test('BWF text edits preserve time reference, UMID, loudness and reserved bytes', async () => {
    const bext = Buffer.from(originalChunks.find(c => c.id === 'bext').data);
    for (let i = 338; i < 602; i++) bext[i] = i % 256;
    bext.writeUInt16LE(2, 346);
    const source = riff(fmt, chunk('bext', bext), data);
    const x = await edit(source, d => {
      d.rows.find(r => r.id === 'Description').text = 'Changed broadcast description';
      d.rows.find(r => r.id === 'Originator').removed = true;
      d.rows.find(r => r.id === 'CodingHistory').text = 'A=PCM,F=48000,W=16\r\n';
    }, 'bext');
    const saved = chunks(x.bytes).find(c => c.id === 'bext').data;
    assert.deepEqual(saved.subarray(338, 602), bext.subarray(338, 602));
    assert.equal(field(x.after, 'Description').value, 'Changed broadcast description');
    assert.equal(field(x.after, 'Originator').value, '');
    await assert.rejects(() => edit(source, d => d.rows[0].text = 'x'.repeat(257), 'bext'), /limited/);
    await assert.rejects(() => edit(source, d => d.rows[0].text = '日本語', 'bext'), /ASCII/);
  });
  await test('Create embedded ID3 text and artwork; edit it again', async () => {
    // Minimal PNG byte fixture: writer and parser preserve it without transcoding.
    const artwork = Buffer.from('89504e470d0a1a0a0000000049454e44ae426082', 'hex');
    const x = await edit(plain, d => {
      writer.add(d, 'TIT2').text = 'WAV ID3 日本語';
      const a = writer.add(d, 'APIC'); a.asset = artwork; a.mime = 'image/png'; a.replaced = true;
    }, 'id3');
    assert.equal(field(x.after, 'TIT2').value[0], 'WAV ID3 日本語');
    assert.deepEqual(Buffer.from(field(x.after, 'APIC').art.data), artwork);
    const y = await edit(x.bytes, d => d.rows.find(r => r.id === 'TIT2').text = 'Another title', 'id3');
    assert.equal(field(y.after, 'TIT2').value[0], 'Another title');
    assert.deepEqual(Buffer.from(field(y.after, 'APIC').art.data), artwork);
  });
  await test('Unknown ID3 frames and zero suffix survive embedded ID3 edits', async () => {
    const source = riff(fmt, chunk('ID3 ', C(id3(frame('TIT2', C([3], B('Old'))), frame('XBIN', [0, 255, 7, 9])), [0, 0, 0])), data);
    const x = await edit(source, d => d.rows[0].text = 'New embedded title', 'id3');
    assert.deepEqual(Buffer.from(field(x.after, 'XBIN').raw), Buffer.from([0, 255, 7, 9]));
    assert.equal(x.after.tags.find(t => t.waveKind === 'id3').details.suffixBytes, 3);
  });
  await test('XML, cue annotations, odd padding, unknown chunks and trailing bytes survive', async () => {
    const cue = C(u32(1), u32(7), u32(0), B('data'), u32(0), u32(0), u32(8));
    const extra = [chunk('iXML', B('<BWFXML><NOTE>Original</NOTE></BWFXML>')), chunk('axml', B('<test/>')),
      chunk('cue ', cue), chunk('LIST', C(B('adtl'), chunk('labl', C(u32(7), B('Marker\0'))))), chunk('XTRA', [1, 2, 3], 157), chunk('JUNK', [4, 5, 6], 187)];
    const source = C(riff(fmt, ...extra, data), B('TRAILER'));
    const x = await edit(source, d => writer.add(d, 'INAM').text = 'a'.repeat(501));
    for (const c of extra) assert(chunks(x.bytes).some(item => item.raw.equals(c)));
    assert.equal(x.bytes.subarray(-7).toString(), 'TRAILER'); assert.equal(field(x.after, 'cue ').value[0].sampleOffset, 8);
    assert.equal(field(x.after, 'labl').value.text, 'Marker');
  });
  await test('INFO field order, duplicates, original text bytes and padding survive', async () => {
    const one = chunk('INAM', B('Original\0'), 207), two = chunk('INAM', B('Duplicate\0'));
    const source = riff(fmt, chunk('LIST', C(B('INFO'), one, two, chunk('IART', B('Artist\0')))), data);
    const x = await edit(source, d => d.rows.find(r => r.id === 'IART').text = 'Someone');
    const saved = chunks(x.bytes).find(c => c.id === 'LIST').data;
    assert.deepEqual(saved.subarray(4, 4 + one.length + two.length), C(one, two));
  });
  await test('Declared Windows-1252 and Latin-1 INFO encodings are honored', async () => {
    for (const [page, title, bytes] of [[1252, 'Euro €', C(B('Euro '), [128, 0])], [28591, 'Café', C(B('Caf'), [233, 0])]]) {
      const cset = Buffer.alloc(8); cset.writeUInt16LE(page);
      const source = riff(fmt, chunk('CSET', cset), chunk('LIST', C(B('INFO'), chunk('INAM', B('Old\0')))), data);
      const x = await edit(source, d => d.rows[0].text = title);
      assert.equal(field(x.after, 'INAM').value, title); assert.deepEqual(Buffer.from(field(x.after, 'INAM').raw), bytes);
      await assert.rejects(() => edit(source, d => d.rows[0].text = '日本語'), /cannot represent/);
    }
  });
  await test('Multiple data chunks retain their separate sample payloads', async () => {
    const source = riff(fmt, data, chunk('XTRA', [0]), data);
    const x = await edit(source, d => writer.add(d, 'INAM').text = 'Multiple');
    assert.equal(x.after.audio.dataChunkCount, 2); assert.equal(x.after.audio.durationSeconds, 0.4);
  });
  await test('RF64 and BW64 metadata inspection is read-only', async () => {
    const source = generate('rf64.wav', 'pcm_s16le', ['-rf64', 'always']);
    for (const kind of ['RF64', 'BW64']) {
      const bytes = Buffer.from(source); bytes.write(kind); const file = blob(bytes), r = await reader.parse(file);
      assert.equal(r.wave.container, kind); assert.equal(r.wave.valid, true); assert.equal(r.wave.editable, false);
      assert.equal(r.audio.durationSeconds, 0.2); assert.equal(field(r, 'INAM').value, 'Original WAV');
      await assert.rejects(() => writer.build(file, r, new Map()), /standard RIFF/);
    }
  });
  await test('RIFX big-endian WAV inspection is read-only', async () => {
    const format = Buffer.alloc(16); format.writeUInt16BE(1, 0); format.writeUInt16BE(1, 2); format.writeUInt32BE(8000, 4); format.writeUInt32BE(16000, 8); format.writeUInt16BE(2, 12); format.writeUInt16BE(16, 14);
    const beChunk = (id, payload) => { const h = Buffer.alloc(8); h.write(id); h.writeUInt32BE(payload.length, 4); return C(h, payload); };
    const body = C(B('WAVE'), beChunk('fmt ', format), beChunk('data', Buffer.alloc(16000))), head = Buffer.alloc(8); head.write('RIFX'); head.writeUInt32BE(body.length, 4);
    const r = await reader.parse(blob(C(head, body))); assert.equal(r.audio.durationSeconds, 1); assert.equal(r.wave.editable, false);
  });
  await test('Malformed chunk sizes, truncated audio and missing padding block saving', async () => {
    const missingPad = riff(fmt, data, C(B('XTRA'), u32(1), [1]));
    for (const source of [pcm.subarray(0, pcm.length - 1), missingPad, riff(fmt, chunk('data', [1]))]) {
      const f = blob(source), r = await reader.parse(f); assert.equal(r.wave.editable, false);
      await assert.rejects(() => writer.build(f, r, new Map()), /standard RIFF/);
    }
    await assert.rejects(() => reader.parse(blob(B('not a wav'))), /RIFF WAVE/);
  });
  await test('Position-dependent metadata rejects edits that move chunks', async () => {
    const be = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
    const chap = frame('CHAP', C(B('chapter\0'), be(0), be(200), be(100), be(1000)));
    const source = riff(fmt, chunk('id3 ', id3(chap)), data);
    await assert.rejects(() => edit(source, d => writer.add(d, 'INAM').text = 'New'), /position-dependent/);
  });
  await test('No-op save is rejected and MP3 routing still supports editing', async () => {
    await assert.rejects(() => edit(pcm, () => {}), /Make a metadata change/);
    const name = path.join(dir, 'test.mp3'); ffmpeg(['-f', 'lavfi', '-i', 'sine=duration=0.2', '-metadata', 'title=MP3 original', name]);
    const f = blob(fs.readFileSync(name), 'test.mp3'), before = await reader.parse(f); assert.equal(before.format, 'MP3');
    const d = writer.makeDraft(before.tags[0], '0', before); d.rows.find(r => r.id === 'TIT2').text = 'MP3 updated';
    const out = await writer.build(f, before, new Map([['0', d]])), after = await reader.parse(blob(await out.arrayBuffer(), 'edited.mp3'));
    assert.equal(field(after, 'TIT2').value[0], 'MP3 updated');
    assert.deepEqual(Buffer.from(await f.slice(before.audio.firstFrameOffset, before.audio.firstFrameOffset + before.audio.audioRegionBytes).arrayBuffer()), Buffer.from(await out.slice(after.audio.firstFrameOffset, after.audio.firstFrameOffset + after.audio.audioRegionBytes).arrayBuffer()));
  });
  console.log(passed + ' WAV / routing validation groups passed.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => fs.rmSync(dir, {recursive: true, force: true}));
