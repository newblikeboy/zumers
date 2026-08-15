# Cloudinary Video Delivery

## Current Implementation

Zumers uploads videos to Cloudinary with a signed upload from the Go API. After upload, the React client stores a Cloudinary delivery URL with these transformations:

```text
c_limit,w_1280/q_auto/f_auto
```

This gives the feed a progressive video URL that still works in the native browser `<video>` element.

## Why This Helps

`q_auto` lets Cloudinary choose a quality level that balances visual quality and file size. This reduces bandwidth and improves first playback speed.

`f_auto` lets Cloudinary choose the best video format or codec supported by the viewer's browser. This can deliver smaller modern encodes where supported while falling back safely for older browsers.

`c_limit,w_1280` prevents very large uploads from being delivered at unnecessarily high display widths inside the feed.

## Adaptive Streaming With `sp_auto`

`sp_auto` is useful for true adaptive bitrate streaming, where playback quality changes based on device and network conditions. It requires HLS or MPEG-DASH delivery using `.m3u8` or `.mpd`, and it should be paired with a compatible player such as Cloudinary Video Player or an HLS/DASH-capable player.

We should not put `sp_auto` directly into the existing native `<video>` URL for all browsers, because that can break playback in browsers that do not support the chosen streaming manifest natively.

## Next Upgrade

When Phase 4 moves from native video playback to a Cloudinary video player component:

1. Install a supported Cloudinary/HLS/DASH video player.
2. Use Cloudinary public IDs as the player source.
3. Enable HLS or DASH source types so Cloudinary can apply `sp_auto`.
4. Test first-request processing behavior and fallback states.
5. Verify playback on Chrome, Edge, Safari, Firefox, Android, and iOS.

## References

- Cloudinary video optimization: https://cloudinary.com/documentation/video_optimization
- Cloudinary adaptive bitrate streaming: https://cloudinary.com/documentation/adaptive_bitrate_streaming
- Cloudinary video player HLS/DASH: https://cloudinary.com/documentation/video_player_hls_dash
