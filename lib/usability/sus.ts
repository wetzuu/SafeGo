/**
 * Scoring for usability sessions: the System Usability Scale (Brooke, 1996) and task completion.
 * Sessions are recorded in data/usability/sessions.csv; `npm run sus` writes docs/USABILITY_RESULTS.md.
 */

/** The ten standard SUS statements, answered 1 (strongly disagree) to 5 (strongly agree). */
export const SUS_STATEMENTS = [
  "I think that I would like to use this system frequently.",
  "I found the system unnecessarily complex.",
  "I thought the system was easy to use.",
  "I think that I would need the support of a technical person to be able to use this system.",
  "I found the various functions in this system were well integrated.",
  "I thought there was too much inconsistency in this system.",
  "I would imagine that most people would learn to use this system very quickly.",
  "I found the system very cumbersome to use.",
  "I felt very confident using the system.",
  "I needed to learn a lot of things before I could get going with this system.",
] as const;

/** The session tasks, in order. Keep in step with docs/USABILITY_SESSIONS.md. */
export const TASKS = [
  "Decide whether to travel to España now",
  "Find the worst-hit part of Metro Manila",
  "Explain why SafeGo gave its rating",
  "See what España was like a day earlier",
  "Say what a Low rating does and does not mean",
] as const;

export type TaskOutcome = "yes" | "help" | "no";

export interface Session {
  participant: string;
  date: string;
  device: string;
  mode: string;
  tasks: TaskOutcome[];
  sus: number[];
  notes: string;
}

/** SUS score from ten answers of 1 to 5: odd items count (answer − 1), even items (5 − answer), total × 2.5. */
export function susScore(answers: number[]) {
  if (answers.length !== 10 || answers.some((answer) => !Number.isInteger(answer) || answer < 1 || answer > 5)) {
    throw new Error("A SUS form needs ten answers from 1 to 5.");
  }
  const total = answers.reduce((sum, answer, index) => sum + (index % 2 === 0 ? answer - 1 : 5 - answer), 0);
  return total * 2.5;
}

/** Reads a CSV line, allowing quoted fields that contain commas or doubled quotes. */
function splitLine(line: string) {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { fields.push(field); field = ""; }
    else field += char;
  }
  fields.push(field);
  return fields.map((value) => value.trim());
}

const HEADER = ["participant", "date", "device", "mode",
  ...TASKS.map((_, index) => `task${index + 1}`), ...SUS_STATEMENTS.map((_, index) => `sus${index + 1}`), "notes"];

export const CSV_HEADER = HEADER.join(",");

/** Parses the sessions file; every problem names its line so it can be fixed by hand. */
export function parseSessions(csv: string): Session[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim() && !line.trimStart().startsWith("#"));
  if (!lines.length || lines[0] !== CSV_HEADER) throw new Error(`The first line must be exactly:\n${CSV_HEADER}`);
  return lines.slice(1).map((line, row) => {
    const fields = splitLine(line);
    const where = `Line ${row + 2}`;
    if (fields.length !== HEADER.length) throw new Error(`${where} has ${fields.length} fields; expected ${HEADER.length}.`);
    const [participant, date, device, mode] = fields;
    if (!participant) throw new Error(`${where} needs a participant code.`);
    const tasks = fields.slice(4, 4 + TASKS.length).map((value) => {
      if (value !== "yes" && value !== "help" && value !== "no") throw new Error(`${where}: task outcomes are yes, help or no.`);
      return value;
    });
    const sus = fields.slice(4 + TASKS.length, 4 + TASKS.length + 10).map(Number);
    susScore(sus);
    return { participant, date, device, mode, tasks, sus, notes: fields.at(-1) ?? "" };
  });
}

export function summarize(sessions: Session[]) {
  const scores = sessions.map((session) => susScore(session.sus));
  const mean = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const sorted = [...scores].sort((a, b) => a - b);
  const median = sorted.length
    ? sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : null;
  const tasks = TASKS.map((name, index) => ({
    name,
    unaided: sessions.filter((session) => session.tasks[index] === "yes").length,
    withHelp: sessions.filter((session) => session.tasks[index] === "help").length,
    failed: sessions.filter((session) => session.tasks[index] === "no").length,
  }));
  return { participants: sessions.length, scores, mean, median, min: sorted[0] ?? null, max: sorted.at(-1) ?? null, tasks };
}
