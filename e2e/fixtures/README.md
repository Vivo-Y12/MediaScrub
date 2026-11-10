# MediaScrub browser test fixtures

- `sample.png`, `sample.jpg`, `private.jpg`: synthetic images created for this test suite; the private sample carries fabricated GPS and serial values.
- `sample.webm`, `sample-audio.webm`: synthetic browser-recorded VP8/Opus clips with no real personal media. The sample WebM lacks a browser-readable finite duration.
- `sample.mp4`: unsigned MP4 exported locally from `sample.webm` using the MediaScrub FFmpeg.wasm video conversion tool; used for finite-duration trim bounds.
- `c2pa-sample.jpg` (`CA.jpg`) and `c2pa-video.mp4` (`video1.mp4`): public C2PA test fixtures from [contentauth/c2pa-rs](https://github.com/contentauth/c2pa-rs/tree/main/sdk/tests/fixtures), used only to verify signed-image/video reader behavior. Check upstream fixture/license terms before redistributing them outside this repository.

No user files or production secrets are included.
