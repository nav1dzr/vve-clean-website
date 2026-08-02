# Carpet page — media status

All carpet media is now published. This records exactly how each web file was
derived, so the set can be reproduced or extended later.

## Originals

The originals are **not** in the repo. They live in the owner's working copy at
`public/carpet/` (~160 MB across ten files) and were never modified. Only the
derivatives below are tracked.

## Before/after pairs (3, all published)

The pairing is the owner's explicit mapping, **not** alphabetical order — note
that the office "before" is spelt `carper1_before.heic` (typo in the original)
against a `carpet1_after.png`, so sorting by filename would mis-pair the set.

| Card | Original | Web derivative | Source px | Output px | Size |
|---|---|---|---|---|---|
| Office carpet — before | `carper1_before.heic` | `web/carpet-office-before.jpg` | 5712×4284 | 1600×1200 | 475 KB |
| Office carpet — after | `carpet1_after.png` | `web/carpet-office-after.jpg` | 1442×1742 | 1324×1600 | 299 KB |
| Blue bedroom carpet — before | `carpet_before.heic` | `web/carpet-blue-before.jpg` | 5707×4284 | 1600×1201 | 278 KB |
| Blue bedroom carpet — after | `carpet_after.heic` | `web/carpet-blue-after.jpg` | 4284×5712 | 1200×1600 | 307 KB |
| Brown carpet — before | `carpet3_before.jpg` | `web/carpet-brown-before.jpg` | 5712×4284 | 1600×1200 | 510 KB |
| Brown carpet — after | `carpet3_after.png` | `web/carpet-brown-after.jpg` | 1448×1086 | 1448×1086 | 500 KB |

Two pairs mix landscape and portrait. That is handled by presentation, not by
cropping: `BeforeAfterTile` puts every image on a fixed 4:3 stage with
`object-contain`, so the full uncropped frame is always shown, letterboxed on a
navy backdrop when its orientation differs. No labels were burnt into any image.

### How the HEIC files were decoded

An earlier pass concluded these were undecodable, because **libheif** rejects
all three:

```
Number of references in iref box (45) exceeds the security limits of 16 references
```

That is a libheif security limit, not a corrupt file. Windows decodes them
fine — `Microsoft.HEIFImageExtension` (v1.2.36.0) is installed, which registers
a HEIF codec with WIC. Decoding through WIC therefore works with no third-party
library at all:

```powershell
Add-Type -AssemblyName PresentationCore, WindowsBase

$decoder = [System.Windows.Media.Imaging.BitmapDecoder]::Create(
  (New-Object System.Uri 'D:\...\carpet_before.heic'),
  [System.Windows.Media.Imaging.BitmapCreateOptions]::PreservePixelFormat,
  [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad)

$img = $decoder.Frames[0]                       # EXIF orientation read from
                                                # /app1/ifd/{ushort=274} and
                                                # applied via RotateTransform
$img = New-Object System.Windows.Media.Imaging.TransformedBitmap(
         $img, (New-Object System.Windows.Media.ScaleTransform $s, $s))

$enc = New-Object System.Windows.Media.Imaging.JpegBitmapEncoder
$enc.QualityLevel = 82
$enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($img))
$fs = [System.IO.File]::Open($out, 'Create'); $enc.Save($fs); $fs.Close()
```

All six images were run through the same path (max dimension 1600 px, JPEG
q82). `BitmapFrame::Create` is called without a metadata argument, so the
derivatives carry no EXIF — nothing for a browser to re-rotate.

## Videos (4, all published)

Every source is 4K **HEVC 10-bit HDR** (BT.2020 / HLG) in a QuickTime
container. Three carry a −90° display matrix and are therefore portrait; the
fourth is landscape.

| Original | Web derivative | Source | Output | Duration | Size |
|---|---|---|---|---|---|
| `carpet.MOV` (34 MB) | `video/web/carpet-1.mp4` | 3840×2160 HEVC, rot −90° | 720×1280 H.264 | 11.03 s | 1.56 MB |
| `carpet1.mov` (23 MB) | `video/web/carpet-2.mp4` | 3840×2160 HEVC, rot −90° | 720×1280 H.264 | 10.75 s | 1.61 MB |
| `carpet2.MOV` (32 MB) | `video/web/carpet-3.mp4` | 3840×2160 HEVC, rot −90° | 720×1280 H.264 | 12.46 s | 2.22 MB |
| `carpet4.MOV` (38 MB) | `video/web/carpet-4.mp4` | 3840×2160 HEVC, no rotation | 1280×720 H.264 | 15.50 s | 1.59 MB |

All four: H.264 High profile, `yuv420p`, BT.709 SDR, `+faststart`, **no audio**
(the page always plays muted, so the track is dead weight). 130 MB → 7.0 MB.

### The HDR trap

A plain `-c:v libx264` transcode of these sources produces a grey, desaturated
result: the HLG/BT.2020 content gets reinterpreted as BT.709 without conversion.
The chain must tone-map first.

```sh
TONEMAP="zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,\
tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p"

# portrait clips (carpet.MOV, carpet1.mov, carpet2.MOV)
ffmpeg -i carpet.MOV -vf "scale=720:-2:flags=lanczos,$TONEMAP" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 28 -preset medium \
  -an -sn -dn -map_metadata -1 -movflags +faststart carpet-1.mp4

# landscape clip (carpet4.MOV)
ffmpeg -i carpet4.MOV -vf "scale=-2:720:flags=lanczos,$TONEMAP" ... carpet-4.mp4

# poster frame, taken 1s in so it is not a black lead-in frame
ffmpeg -ss 1 -i carpet.MOV -vf "scale=720:-2:flags=lanczos,$TONEMAP" \
  -frames:v 1 -q:v 4 carpet-1-poster.jpg
```

ffmpeg's `autorotate` already applies the display matrix, so no explicit
`transpose` is needed — the portrait sources arrive as 2160×3840.

`ffmpeg` is not installed on this machine. A throwaway `ffmpeg-static` (6.1.1)
was installed into a scratch directory outside the repo and deleted afterwards.
The website has **no** runtime image or video dependency, and `package.json` /
`package-lock.json` are untouched.

## Placement

| Clip | Where | Why |
|---|---|---|
| `carpet-1.mp4` | under the **Office carpet** card | portrait; stair-carpet extraction, branded uniform |
| `carpet-2.mp4` | under the **Blue bedroom carpet** card | portrait; filmed on that same job |
| `carpet-3.mp4` | under the **Brown carpet** card | portrait; bedroom carpet extraction |
| `carpet-4.mp4` | `CarpetProcessSection` — full-width 16:9 stage | the only landscape source; best wide equipment shot |

Only `carpet-2.mp4` is the same job as the card above it. Captions describe what
each clip shows rather than asserting it is the same carpet, so nothing on the
page overstates the connection.

## Playback

Every clip goes through `LazyVideo`: `preload="none"`, `<source>` children
withheld until an IntersectionObserver reports the clip is within 200 px of the
viewport, paused on exit, `muted` + `loop` + `playsInline`, poster required, and
`prefers-reduced-motion` honoured by never autoplaying and showing controls
instead. Nothing is fetched on first paint.
