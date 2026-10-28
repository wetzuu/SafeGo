# SafeGo usability sessions

A short, repeatable session to check whether people understand SafeGo's ratings, plus the standard
System Usability Scale (SUS). Plan for **5–8 participants**, about **15 minutes each**. Five people
usually surface most of the serious problems.

Record every session in `data/usability/sessions.csv`, then run `npm run sus` to write
[USABILITY_RESULTS.md](USABILITY_RESULTS.md). Never fill in sessions that did not happen.

## Before the sessions

- **Who:** commuters and students who travel in Metro Manila. Include at least two people on a phone.
- **Consent:** ask permission to take notes. Use participant codes (P01, P02…), never names,
  and do not record home addresses or contact details.
- **Same conditions for everyone:** run SafeGo with `npm run presentation:replay`. Every participant then sees
  the same rainy moment (17 Aug 2026, 12:00 PM), and the results don't depend on the weather that day.
  Record the mode as `replay`. If you use live data instead, record `live`.
- **Device:** a laptop with the browser at full screen, or a phone on the same Wi-Fi
  (`npm run presentation:replay -- --lan`, then open the laptop's address on the phone).

## Running a session

Say this, and nothing more about how SafeGo works:

> "This is SafeGo, a student prototype that rates travel conditions in Metro Manila during bad weather.
> I'm testing the app, not you. Please think out loud. I can't help during the tasks, but you can
> say 'I'm stuck' at any time."

For each task, read the prompt, then stay quiet. Write down the outcome:

- `yes`: done without any help;
- `help`: done after a hint;
- `no`: not done, or done with a wrong understanding.

Also note the time taken, anything they misread, and short quotes.

| # | Prompt to read | Counts as `yes` when they… |
| --- | --- | --- |
| 1 | "You need to go to España Boulevard right now. Should you go?" | Find España, read its rating, and give the advice on the card (for example, avoid travel unless essential). |
| 2 | "Which part of Metro Manila looks worst right now?" | Point to the highest-rated area on the map. |
| 3 | "Why did SafeGo give España that rating?" | Open "Why this rating" and say it comes from the weather model (not a PAGASA warning, not a flood sensor). |
| 4 | "What were conditions like at España a day earlier?" | Use the timeline to go back about 24 hours and read the rating then. |
| 5 | "If SafeGo said Low for a road, would that mean the road isn't flooded?" | Say no: Low means the weather looks calm, not that the street was checked. |

Task 5 is the most important. Any participant who says Low means "safe" or "not flooded" is a design
problem to fix, even if every other task went well.

## SUS questionnaire (after the tasks)

Hand over the ten statements below. Each is answered **1 (strongly disagree) to 5 (strongly agree)**.
Use the wording exactly as written, because the score is only comparable with the standard wording.
If you translate it, note that in the CSV notes.

1. I think that I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think that I would need the support of a technical person to be able to use this system.
5. I found the various functions in this system were well integrated.
6. I thought there was too much inconsistency in this system.
7. I would imagine that most people would learn to use this system very quickly.
8. I found the system very cumbersome to use.
9. I felt very confident using the system.
10. I needed to learn a lot of things before I could get going with this system.

Ask one closing question: "What, if anything, would you change?" Put the answer in the notes.

## Recording and scoring

Add one line per participant to `data/usability/sessions.csv`:

```text
P01,2026-11-05,phone,replay,yes,yes,help,yes,no,4,2,4,2,5,1,4,2,4,2,"Thought Low meant no flooding"
```

Then run:

```bash
npm run sus
```

The script checks every line, computes each SUS score (odd items: answer − 1; even items: 5 − answer;
total × 2.5) and writes the per-task counts. A score of 68 is the commonly cited average. With 5–8
people the result is a rough signal for the slides, not a measurement.

## Gate before the conference

If **4 of the first 5** participants get task 5 right unaided, the wording is working. If not, change the
rating card wording, then test it with two more people.
