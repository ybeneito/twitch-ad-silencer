# Twitch Ad Silencer

A lightweight Firefox extension that keeps the stream audio playing during Twitch
ad breaks — without blocking or skipping the ad.

## How it works

During an ad break, Twitch keeps the live stream running in a small muted
preview while the main player shows the ad. This extension detects the break,
**unmutes the preview** and **mutes the ad**, so you only hear the stream. When
the ad ends, the original audio states are restored.

The ad still plays in full (muted), so the streamer's impression is still
counted. No PiP, no clicks, no privileged APIs, no background script.