# ADR-RQG-B: Version 2 of the plan format

Status: accepted, 2026-11-23.
Ticket: https://github.com/gambitl/claude-code-stack/issues/98

This record replaces the line of [ADR-SIC-B](ADR-SIC-B-run-state.md) that says a plan file starts with `Format: cstack-plan/1`. A plan file now starts with `Format: cstack-plan/2`. The other rules of ADR-SIC-B stay as they are, including the refusal of a format that `cstack` does not know.

## Context

Three problems of past runs have one cause. The plan accepted a claim without proof.

A plan could state a fact about the code that nobody had checked. It could change something that the ticket fixes, such as a function signature or a message, without asking the user. And a test that was meant to refuse something could pass without ever having failed.

Two user stories of the epic fix this. The first asks that every fact name its source, and that a change to what the ticket fixes be linked to a question that the user answered. The second asks that each unit name its test cases one by one, and say which case proves each negative criterion. Both stories need new lines in the plan. So the format version goes up once, for both of them together.

## Options

For the facts, there were two options.

1. Keep the facts as free prose in "Decisions", and let the reviews check them. This needs no new format. But a review reads prose, and a fact without a source looks the same as a fact with one. It was the way the unchecked claims got through.
2. Write the facts as a fixed list, where each line has a fixed form that `cstack` can read. A program can then refuse a line that has no source. This is the option we chose.

For the test cases, there were also two options.

1. Keep one `- Test:` line for each unit. A unit then proves its behaviour with one named case, even when it has several rules to prove.
2. Allow several `- Test:` lines in a unit, one for each case, and add a line that links a negative criterion to its case. This is the option we chose.

## What happens to the plans of version 1

A plan of version 1 has none of the new sections. `cstack` 0.3.2 is the last release that reads it as a plan. A newer `cstack` refuses such a plan with exit code 3. The message says that the file has the format `cstack-plan/1` and that `cstack` 0.3.2 can read it. When the file names the `cstack` version that wrote it, the message names that version instead. The message also says to install that release and to run `cstack skills install` again, so that the skills match the release.

This follows open question 4 of the specification. The advice is to finish every run in progress before an upgrade.

Two commands still read a plan of version 1. `cstack measure` reads its header, and `cstack audit` reads it, so that the audit and the measure of old runs keep working. A plan of version 1 is not required to have the three new sections.

## Decision

We use the fixed list, and the named test cases. The format is `cstack-plan/2`. It adds three sections and two kinds of unit line. Every form below is the one that `cstack/src/plan/read.ts` reads.

### The new sections

The new sections come in this order. "Negative criteria" comes after "Ticket" and before "Dependencies". "Facts" comes after "Code mapping" and before "Decisions". "Changes to what the ticket fixes" comes after "Blocking questions" and before "Review log". Each section holds either the single word `none` or a list. The word `none` next to a line of the list is refused.

The section "Negative criteria" holds one line for each negative criterion of the ticket. The line is `<k>. <the criterion>`. The number `<k>` starts at 1 and has no gap.

The section "Facts" holds one line for each fact that the plan relies on. The line is `- <the fact> Source: <the source>`. The source has one of two forms.

- A fact that comes from the code is followed by `Source: ` and then a path in backticks, `, line <n>: `, and the quoted text in double quotes. The path is relative to the repository root. The line number is one number, never a range, and it starts at 1. The quoted text is not empty, and it ends the line.
- A fact that comes from the user is followed by `Source: the user, on <YYYY-MM-DD>`.

The source starts at the first ` Source: ` whose rest is a whole valid source. So a fact can quote the words ` Source: ` in its own text. A fact without a valid source is refused, and the message says why the source is not valid.

The section "Changes to what the ticket fixes" holds one line for each change. The line is `- <the change> Blocking question: <n>`. The number `<n>` is the number of the blocking question where the user decided the change.

### The new unit lines

A unit can have several `- Test:` lines, one for each case. Each line is `- Test: `<test file>`: <the case>`. All the `- Test:` lines of a unit name the same file, and the file is also in the `- Files:` line. A case is named only once in a unit. A line that starts with two spaces continues the line above it. A case is written as the JUnit report names it. For vitest, that is the titles of the describe blocks and the title of the test, joined by ` > `.

A unit can have one `- Negative criterion <k>: <the case>` line for each negative criterion that it covers. These lines come after the `- Test:` lines and before `- Minimum code:`. The number `<k>` must be in the section "Negative criteria". The case must be one of the cases of the `- Test:` lines of the same unit. A unit with a `- No test:` line cannot have such a line. A criterion is named once in a unit.

### What the reader checks and what it leaves to later tickets

`readPlan()` reads these lines and refuses a line that does not have the form above. It does not open any file. It does not check that a quoted text is on its line, and it does not check that a change is linked to an answered question. Those checks need the repository and the state of the run, so they belong to the commands that approve and review a plan. Later tickets of the epic add them.

## Reasons

A list with a fixed form lets a program do what a review could not do. It can refuse a fact that has no source, and it can find every change to what the ticket fixes.

Asking for a quoted text, not only a path and a line, makes a source easy to check later. The line can move, but the words stay.

Naming each test case lets a later check read the test report case by case. A test file that fails as a whole cannot show that each rule was tested.

Raising the version once, for both stories, means that a user upgrades only once. It also means that the refusal of an old plan happens in one place.

## Consequences

A plan written by an older `cstack` cannot be finished with a newer one. The user installs the older release, finishes the run, and then upgrades. The release notes of the epic say so.

The template `cstack/skills/resolve-issue/templates/plan.md` describes every new line and says who fills it. The plan guides do not tell the agent to fill the new sections yet, so a later ticket adds those steps. A person who edits the template must keep it in step with `readPlan()`.

The format of a line is strict on purpose. A fact line with a small mistake, such as a range of lines, is refused until it is fixed. We accept this cost, because a lenient reader would let the unchecked claims back in.
