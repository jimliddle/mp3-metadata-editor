# MP3 & WAV Metadata Inspector & Editor

A single-file, offline tool for inspecting and editing MP3 and WAV metadata in your browser. Open an MP3 or WAV, explore its tags and artwork, make changes, and download an edited copy without re-encoding the audio.

**No installation, build step, server, account, or external dependencies.**

## Get started

1. Download this repository using **Code → Download ZIP**, then extract it. Alternatively, download [`index.html`](index.html) directly.
2. Open `index.html` in a modern desktop browser.
3. Drag an MP3 or WAV onto the page or select **Choose audio file**.
4. Browse **All fields**, an individual tag block, **Artwork**, **File & audio**, or the WAV **RIFF chunks** view.
5. Select **Edit metadata**, choose a tag block, and change, add, or remove fields.
6. Select **Save edited MP3** or **Save edited WAV** to download `your-file-edited.mp3` or `your-file-edited.wav`.

The original file stays intact. After a successful download is started, the inspector shows the edited version. You can continue editing that version and save again.

## Features

- Search metadata by field name, identifier, format, or value.
- Inspect duplicate tags, custom fields, comments, lyrics, chapter metadata, artwork, and common audio headers.
- Expand fields to see decoded values, flags, and paged hexadecimal payloads.
- Download original tag blocks, individual payloads, artwork, and embedded objects.
- Export inspection results as JSON, including parsed binary payloads encoded as Base64.
- Edit supported text fields, comments, lyrics, custom text and URL fields.
- Add a new ID3v2.3 tag to an MP3 or embed one in a WAV.
- Inspect WAV INFO, Broadcast WAV text and technical fields, embedded ID3, XML, cue points, and annotations.
- Add, edit, or remove native WAV INFO fields; edit existing Broadcast WAV text.
- Browse RIFF chunks, including unknown chunks, and download their original bytes.
- Replace or remove embedded artwork; new artwork accepts JPEG and PNG files up to 20 MiB.
- Save edited files in their original audio format by rebuilding selected metadata and copying the original audio bytes.

## MP3 format support

| Format | Inspection | Editing |
| --- | --- | --- |
| ID3v2.2, ID3v2.3, ID3v2.4 | Text, common binary frames, artwork, chapters, flags, and raw payloads | Supported text, comments, lyrics, custom fields, and artwork; individual fields can be removed |
| ID3v1 / ID3v1.1 | All standard fields | Text fields, track number, and genre within the format's limits |
| Enhanced ID3v1 (`TAG+`) | Supported fields and original tag bytes | Inspection only |
| APEv1 / APEv2 | Text, binary items, and embedded cover art | Text and artwork; individual items can be removed |
| Lyrics3v1 / Lyrics3v2 | Lyrics and supported fields | Inspection only |
| MPEG / Xing / Info / VBRI headers | Audio properties, available encoder details, and first-frame bytes | Inspection only |

Unknown ID3 frames and APE binary values remain available as raw bytes. Not every proprietary metadata format has a specialized decoder.

## WAV format support

Standard little-endian **RIFF/WAVE** files can be inspected and edited. PCM integer, IEEE floating-point, and WAVE_FORMAT_EXTENSIBLE headers expose sample rate, channels, bit depth, byte rate, and duration. Other WAVE codecs expose their available header properties; metadata editing does not decode or transcode the audio.

| Chunk / container | Inspection | Editing |
| --- | --- | --- |
| `LIST/INFO` | All text fields, including duplicates and custom four-character IDs | Add, change, or remove fields; create a new INFO block |
| Broadcast WAV `bext` | Text, time reference, version, UMID and loudness where available | Description, originator, originator reference, origination date/time and coding history in an existing block |
| Embedded `id3 ` / `ID3 ` | ID3v2.2–2.4, including artwork and raw frames | Supported ID3 text/artwork; add a new ID3v2.3 chunk |
| `iXML`, `axml`, `aXML`, `_PMX`, `XMP ` | XML text and raw payload | Inspection only |
| `cue ` and `LIST/adtl` | Cue points, labels, notes and raw annotation payloads | Inspection only |
| Other chunks | Original bytes; selected audio header fields | Retained byte-for-byte |
| Big-endian RIFX, RF64 and BW64 | Chunk map, supported metadata and audio properties | Inspection only |
| Segmented `LIST/wavl` audio | Top-level chunk map and available metadata; nested audio is not decoded | Inspection only |

For usual WAV title, artist, album, comments, genre and track fields, choose the **WAV LIST/INFO** block. For artwork, choose an embedded ID3 block or **Add an embedded ID3v2.3 tag (text / artwork)**. Different players support different combinations of WAV tags; INFO and ID3 copies are independent.

INFO text edits use UTF-8 by default. If a `CSET` chunk declares UTF-8, Windows-1252, or ISO-8859-1, its encoding is honored. Unsupported declared code pages disable INFO editing. Existing untouched INFO values retain their original bytes. Broadcast WAV text uses ASCII and enforces the format's fixed field lengths; its timing, UMID, loudness, and reserved bytes are retained.

WAV saves retain sample payloads, untouched chunks, original chunk order, and any bytes outside the RIFF boundary. New metadata is inserted before the first audio-data chunk. RIFF sizes and even-byte padding are recalculated. A structurally invalid WAV cannot be saved; files with detected position-dependent metadata reject changes that resize chunks. Outputs exceeding RIFF's 32-bit size limit are rejected; the editor does not convert to RF64.

## How editing works

Edits apply to the **selected tag block**. An audio file can contain several independent copies of a title, artist, or other field across metadata blocks (for example, ID3 and APE in MP3, or INFO and ID3 in WAV). To change those copies too, select each relevant block and edit it before saving. Changes across multiple selected blocks are included in the same downloaded audio file.

Existing ID3v2 tags retain their version. Newly added ID3v2 tags use version 2.3. Unedited frame payloads and other tag blocks are retained; the audio is copied without re-encoding. Inspection views and JSON exports reflect the last opened or saved version, rather than unsaved edits.

Use **Remove field** to delete a field and **Undo removal** to restore it before saving. **Reset edits** discards pending changes.

## Privacy and browser requirements

File reading, parsing, image previews, editing, and downloads happen locally in your browser. The page does not upload audio files, call external APIs, load external scripts, or fetch linked artwork. Its content security policy blocks network connections. Documentation links open only when you follow them.

Use a modern browser with File, Blob, TextEncoder, TextDecoder, and BigInt support. Decompressing compressed ID3v2.3/v2.4 frames additionally requires `DecompressionStream`; otherwise their original payloads remain available for inspection. Where a browser exposes the optional WebMCP interface, the page offers a read-only tool for inspecting the file the user has already opened.

## Limitations

- Encrypted fields are not decrypted. Unsupported binary fields can be inspected, retained, or removed, but do not have a general-purpose value editor.
- Malformed or incompletely parsed tag structures cannot be rewritten reliably and remain inspection-only.
- ID3v1 fields have fixed byte lengths and use Latin-1. Edits that exceed those limits or require unsupported characters are rejected instead of silently truncated. Use ID3v2 for longer text or Unicode.
- Rebuilding an ID3 tag omits its optional extended header, including any CRC and restrictions. Signed or specially flagged metadata may require explicitly removing the affected field before other edits can be saved.
- If position-dependent metadata such as chapter byte offsets is detected, editing is restricted to changes that preserve tag/chunk sizes. Unknown proprietary chunks are retained as bytes; their semantics are not interpreted.
- An inspection decodes at most 64 MiB of stored tag data, with a separate 64 MiB decompression budget, 20,000 entries, and eight chapter nesting levels. Oversized tag blocks remain downloadable.
- MP3 audio detection checks up to 1 MiB after leading tags. Duration is estimated from the first-frame bitrate when a usable frame count is unavailable. WAV duration uses sample frames, a `fact` sample count, or a byte-rate estimate. This is not a full audio-stream validator.
- Some players cache metadata. Reopen or reimport the downloaded audio file if a player continues to show old values.

## Development

The application is contained in [`index.html`](index.html): inline CSS and four classic script blocks provide the MP3 parser, MP3 writer, WAV support and format routing, and interface. Edit that file and reopen or refresh it in your browser; there are no packages to install.

When changing the writer, verify saved files with an independent audio metadata reader and compare the original and output audio bytes. Keep the page self-contained and preserve unknown metadata payloads when they are not explicitly edited or removed.

### WAV regression checks

With **Node.js 18+**, **FFmpeg**, and **FFprobe** installed, run:

```sh
node tests/wav.cjs
```

The test script generates temporary audio fixtures and removes them afterward. It checks PCM16, PCM24 and float WAVs; INFO, BWF and embedded ID3 edits; Unicode and legacy text encodings; chunk and sample-byte preservation; malformed-file rejection; read-only RIFX/RF64/BW64 support; and MP3 format routing. FFprobe independently reads saved tags, and FFmpeg verifies unchanged decoded audio hashes for the real WAV fixtures. These tools are needed only for development tests, not for using the HTML file.

## License

[MIT](LICENSE) © 2026 Jim Liddle.

