/**
 * Replay mode: the app shows recorded weather from one documented past moment instead of live data
 * (`npm run presentation -- --replay`). The page reads the pack's header and sets it here before
 * anything renders, so the map's "now", the rewind slider and every "live" label follow the replay.
 */
export interface ReplayInfo {
  /** What happened, e.g. "Habagat flash floods across Metro Manila". */
  label: string;
  /** Manila local time of the replay moment, "yyyy-MM-ddTHH:00". */
  at: string;
  /** A dated report of what happened that day. */
  source: string;
}

let replay: ReplayInfo | null = null;

export function setReplay(info: ReplayInfo | null) {
  replay = info;
}

export function getReplay() {
  return replay;
}

/** The replay moment while a replay is on, otherwise the real time. */
export function appNow() {
  return replay ? Date.parse(`${replay.at}:00+08:00`) : Date.now();
}

/** "recorded" during a replay, "live" otherwise, for labels that name where data came from. */
export function liveWord() {
  return replay ? "recorded" : "live";
}

/** The same word with a capital letter, for the start of a sentence. */
export function capitalLiveWord() {
  return replay ? "Recorded" : "Live";
}

/** One line naming the sources a rating used. A replay has weather only: there is no archive of past PAGASA alerts. */
export function basisLine() {
  return replay ? "Based on recorded weather." : "Based on live weather and PAGASA alerts.";
}
