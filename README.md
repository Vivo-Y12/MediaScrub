<h1 align="center">MediaScrub</h1>

**Your media, your device.** MediaScrub is a free browser app for working with images and videos, checking Content Credentials, and reviewing private metadata. Your files are processed in your browser—not uploaded to a media-processing server. No account, payment, ads, or subscription.

## Features

### Check where a file came from

Use **Provenance** to inspect supported Content Credentials (C2PA). See the available validation result, recorded history, and details, then save a report if you need one. Signed files are protected from edits that would break their credentials.

**MediaScrub cannot detect SynthID.** SynthID and C2PA are different technologies; not finding Content Credentials does **not** mean a file is human-made or free of invisible watermarks.

### Edit images in batches

**Image Studio** can resize, crop, rotate, convert, and compress images. Preview and compare results, then download one file or the whole batch as a ZIP.

### Work with video

**Video Lab** can trim, resize, convert, or compress compatible videos. You can also make a GIF, extract audio, or save frames as images. See progress, cancel a job, and download results individually or together.

### Check what's inside a file

**Metadata & Privacy** shows details hidden in a file, such as camera settings and location. Export a report, or use the **JPEG privacy editor** to remove a photo's saved GPS location and device serial/owner details. You can also edit its artist or description without recompressing the picture.

## How to use it

1. Open a tool in MediaScrub and choose or drop your files.
2. Review what it finds or choose the edits you want.
3. Download the result and check it before sharing. Keep your original until you're happy with the new file.

The app loads its code and processing tools from the site you opened, but **your selected media stays on your device**. Clearing the queue or closing the tab releases files held in browser memory; downloads you saved remain on your device.

## Good to know

- **A valid record is not a trusted identity.** Its available checks passed; that does not mean you should trust the person or organization named in it. A missing or unreadable record cannot prove how a file was made.
- **Signed files are protected.** MediaScrub stops edits that could invalidate their Content Credentials. It cannot inspect C2PA records in WebM video, so it cannot tell you whether one is present.
- **Metadata edits are selective, not a privacy guarantee.** Other hidden details may remain even after editing a JPEG. Video metadata removal is also best-effort. Check the downloaded file before sharing it.
- **Format support varies.** Common image inputs include PNG, JPEG, WebP, and BMP. GIF uses the first frame; TIFF uses the first page; SVG is turned into pixels. AVIF depends on your browser; HEIC is not supported. Video support depends on the file's codec and your device. A video with unreadable duration may produce a shorter trim than requested.
- **Your device does the work.** Large or unusual files may be slow or run out of memory. The JPEG privacy editor has a 20 MB safety limit.

For more detail, see the app's **Docs** and **Privacy** pages. Developers and self-hosters can find [setup, testing, and deployment instructions](docs/DEVELOPMENT.md); the [verification and limitations report](docs/QUALITY.md) covers technical details.
