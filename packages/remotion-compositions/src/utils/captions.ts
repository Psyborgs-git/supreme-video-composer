/**
 * Caption timing utilities for splitting transcripts into timed caption entries.
 * Usable by TikTok-caption, Quote Cards, History Storyline, or any template
 * that needs word-timed subtitles.
 */

export interface CaptionEntry {
  text: string;
  startFrame: number;
  endFrame: number;
}

export interface WordTimestamp {
  word: string;
  startMs: number;
  endMs: number;
}

/**
 * Split a raw transcript string into caption chunks at word boundaries.
 * Each chunk contains at most `wordsPerCaption` words.
 * Frame timing is estimated by distributing words proportionally over the
 * total duration.
 */
export function splitTranscriptToCaptions(
  transcript: string,
  totalDurationFrames: number,
  fps: number,
  wordsPerCaption: number = 4,
): CaptionEntry[] {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const captions: CaptionEntry[] = [];
  const totalChars = words.join(" ").length;
  let charIndex = 0;

  for (let i = 0; i < words.length; i += wordsPerCaption) {
    const chunk = words.slice(i, i + wordsPerCaption);
    const text = chunk.join(" ");

    const startFraction = charIndex / totalChars;
    charIndex += text.length + (i + wordsPerCaption < words.length ? 1 : 0);
    const endFraction = charIndex / totalChars;

    const startFrame = Math.round(startFraction * totalDurationFrames);
    const endFrame = Math.round(endFraction * totalDurationFrames);

    captions.push({ text, startFrame, endFrame });
  }

  return captions;
}

/**
 * Convert an array of word-level timestamps (from Whisper or similar)
 * into grouped caption entries.
 */
export function wordTimestampsToCaptions(
  words: WordTimestamp[],
  fps: number,
  wordsPerCaption: number = 4,
): CaptionEntry[] {
  if (words.length === 0) return [];

  const captions: CaptionEntry[] = [];

  for (let i = 0; i < words.length; i += wordsPerCaption) {
    const chunk = words.slice(i, i + wordsPerCaption);
    const text = chunk.map((w) => w.word).join(" ");
    const startFrame = Math.round((chunk[0].startMs / 1000) * fps);
    const endFrame = Math.round((chunk[chunk.length - 1].endMs / 1000) * fps);

    captions.push({ text, startFrame, endFrame });
  }

  return captions;
}

/**
 * Convert sentence-level entries (with start/end times in seconds)
 * into frame-based caption entries.
 */
export function sentencesToCaptions(
  sentences: Array<{ text: string; startSeconds: number; endSeconds: number }>,
  fps: number,
): CaptionEntry[] {
  return sentences.map((s) => ({
    text: s.text,
    startFrame: Math.round(s.startSeconds * fps),
    endFrame: Math.round(s.endSeconds * fps),
  }));
}
