// The vision sound cue (assets/audio/vision_*.m4a) plays for Goalify Beyond.
// Flip once every licence in assets/audio/SOURCES.md is confirmed for a paid app.
export const VISION_SOUND_AVAILABLE = false;

// Level from earned XP (spec 010). The server ledger always runs; this only
// switches what the app shows. Flip to false to fall back to the old
// life-score-derived level if something goes wrong after release.
export const EARNED_XP = true;
