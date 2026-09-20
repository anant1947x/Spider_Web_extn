# Spider Web & Dust

An MV3 Chrome extension that turns neglected websites into small abandoned rooms: layered cobwebs, long drifting strands, dust motes, grain, vignette, and an optional crawling spider. Clean it manually with a duster or run an automatic sweep.

## Load it locally

1. Open chrome://extensions.
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select this folder:
   C:\Users\vansh\OneDrive\Desktop\makdi_jala\Spider_Web_extn
5. Pin **Spider Web & Dust**, then open its popup to configure it.

After edits, press the extension's reload button on chrome://extensions, then refresh the test page.

## Fast visual test

1. In the popup, set **Days before webs** to 0.
2. Refresh any normal HTTPS website.
3. Choose a web density:
   - **Low**: multiple anchored webs plus single/dual cross-page strands.
   - **Medium / High / Extreme**: progressively more edge clusters, drapes, long strands, dust, and spiders.
4. Use **Brush** to clean manually (hold/drag, Esc exits), or **Sweep** for a complete automatic pass.

The first stale visit is shown using the previous visit timestamp, then the current visit is recorded. This lets a site become dusty only after it has actually been away long enough while still allowing the scene to remain cleanable during that page view.

## Design choices

- Cobwebs use the supplied alpha-transparent images with uniform tint, highlights, and shadows. Black in image previews is transparency, not a baked background.
- Long single/dual threads, grain, vignette, dust, sparkles, and the spider are rendered procedurally for sharp scaling and reliable cleaning.
- The spider is a lightweight vector animation rather than a looping transparent video, which keeps the extension smaller, more responsive, and compatible with reduced-motion preferences.
