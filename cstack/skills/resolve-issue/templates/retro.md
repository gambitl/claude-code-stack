# Retrospective: <ticket id> — <ticket title>

Date: <YYYY-MM-DD>
Plan file: <path, or "none" when the run stopped before the plan file existed>
Outcome: done | needs-decision | failed | stopped at phase <N>

## Steps

```text
<The lines that cstack audit printed on standard output, as printed. Do not change them.>
```

<When the audit printed no line, write one sentence that says so and gives the reason, with no path. Otherwise delete this sentence.>

## Protect

<At most three behaviours that visibly helped this run, each with its evidence, or "nothing this time".>

## Improve

<One item per thing to change. Each item says what happened, gives the evidence (a phase, a commit, a line of the plan file, never a quote of a person) and ends with one tag: [skill], [agent prompt], [conventions file], [ticket template] or [one-off]. Or "nothing this time".>

## Trap hit

<A gotcha of this repository that the conventions file does not mention, with what it cost, or "nothing this time".>

<!-- Keep the file under fifteen lines of prose, in full sentences. The code block of `## Steps` and the items under `## Improve` that come from its lines do not count toward the fifteen lines of prose. Empty headings are normal: never invent an item to fill one. -->
