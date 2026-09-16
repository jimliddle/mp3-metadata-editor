# MP3 Metadata Inspector & Editor

A single-file, offline tool for inspecting and editing MP3 metadata in your browser. Open an MP3, explore its tags and artwork, make changes, and download an edited copy without re-encoding the audio.

**No installation, build step, server, account, or external dependencies.**

## Get started

1. Download this repository using **Code → Download ZIP**, then extract it. Alternatively, download [`mp3-metadata-inspector.html`](mp3-metadata-inspector.html) directly.
2. Open `mp3-metadata-inspector.html` in a modern desktop browser.
3. Drag an MP3 onto the page or select **Choose MP3 file**.
4. Browse **All fields**, an individual tag block, **Artwork**, or **File & audio**.
5. Select **Edit metadata**, choose a tag block, and change, add, or remove fields.
6. Select **Save edited MP3** to download a file named `your-file-edited.mp3`.

The original file stays intact. After a successful download is started, the inspector shows the edited version. You can continue editing that version and save again.

## Features

- Search metadata by field name, identifier, format, or value.
- Inspect duplicate tags, custom fields, comments, lyrics, chapter metadata, artwork, and common audio headers.
- Expand fields to see decoded values, flags, and paged hexadecimal payloads.
- Download original tag blocks, individual payloads, artwork, and embedded objects.
- Export inspection results as JSON, including parsed binary payloads encoded as Base64.
- Edit supported text fields, comments, lyrics, custom text and URL fields.
- Add a new ID3v2.3 tag to a file.
- Replace or remove embedded artwork; new artwork accepts JPEG and PNG files up to 20 MiB.
- Save edited MP3s by rebuilding selected tag blocks and copying the original audio bytes.

## Format support

| Format | Inspection | Editing |
| --- | --- | --- |
| ID3v2.2, ID3v2.3, ID3v2.4 | Text, common binary frames, artwork, chapters, flags, and raw payloads | Supported text, comments, lyrics, custom fields, and artwork; individual fields can be removed |
| ID3v1 / ID3v1.1 | All standard fields | Text fields, track number, and genre within the format's limits |
| Enhanced ID3v1 (`TAG+`) | Supported fields and original tag bytes | Inspection only |
| APEv1 / APEv2 | Text, binary items, and embedded cover art | Text and artwork; individual items can be removed |
| Lyrics3v1 / Lyrics3v2 | Lyrics and supported fields | Inspection only |
| MPEG / Xing / Info / VBRI headers | Audio properties, available encoder details, and first-frame bytes | Inspection only |

Unknown ID3 frames and APE binary values remain available as raw bytes. Not every proprietary metadata format has a specialized decoder.

## How editing works

Edits apply to the **selected tag block**. An MP3 can contain several independent copies of a title, artist, or other field across ID3 and APE tags. To change those copies too, select each relevant block and edit it before saving. Changes across multiple selected blocks are included in the same downloaded MP3.

Existing ID3v2 tags retain their version. Newly added ID3v2 tags use version 2.3. Unedited frame payloads and other tag blocks are retained; the audio is copied without re-encoding. Inspection views and JSON exports reflect the last opened or saved version, rather than unsaved edits.

Use **Remove field** to delete a field and **Undo removal** to restore it before saving. **Reset edits** discards pending changes.

## Privacy and browser requirements

File reading, parsing, image previews, editing, and downloads happen locally in your browser. The page does not upload MP3s, call external APIs, load external scripts, or fetch linked artwork. Its content security policy blocks network connections. Documentation links open only when you follow them.

Use a modern browser with File, Blob, TextEncoder, TextDecoder, and BigInt support. Decompressing compressed ID3v2.3/v2.4 frames additionally requires `DecompressionStream`; otherwise their original payloads remain available for inspection. Where a browser exposes the optional WebMCP interface, the page offers a read-only tool for inspecting the file the user has already opened.

## Limitations

- Encrypted fields are not decrypted. Unsupported binary fields can be inspected, retained, or removed, but do not have a general-purpose value editor.
- Malformed or incompletely parsed tag structures cannot be rewritten reliably and remain inspection-only.
- ID3v1 fields have fixed byte lengths and use Latin-1. Edits that exceed those limits or require unsupported characters are rejected instead of silently truncated. Use ID3v2 for longer text or Unicode.
- Rebuilding an ID3 tag omits its optional extended header, including any CRC and restrictions. Signed or specially flagged metadata may require explicitly removing the affected field before other edits can be saved.
- If position-dependent metadata such as chapter byte offsets is detected, editing is restricted to changes that preserve tag size.
- An inspection decodes at most 64 MiB of stored tag data, with a separate 64 MiB decompression budget, 20,000 entries, and eight chapter nesting levels. Oversized tag blocks remain downloadable.
- Audio detection checks up to 1 MiB after leading tags. Duration is estimated from the first-frame bitrate when a usable frame count is unavailable. This is not a full audio-stream validator.
- Some players cache metadata. Reopen or reimport the downloaded MP3 if a player continues to show old values.

## Development

The application is contained in [`mp3-metadata-inspector.html`](mp3-metadata-inspector.html): inline CSS and three classic script blocks provide the parser, metadata writer, and interface. Edit that file and reopen or refresh it in your browser; there are no packages to install.

When changing the writer, verify saved files with an independent MP3 reader and compare the original and output audio bytes. Keep the page self-contained and preserve unknown metadata payloads when they are not explicitly edited or removed.

## License

[MIT](LICENSE) © 2026 Jim Liddle.
