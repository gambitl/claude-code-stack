# ADR-SIC-D: The settings file and the model of the review agent

Status: accepted, 2026-11-18.
Ticket: https://github.com/gambitl/claude-code-stack/issues/14
Specification: [`docs/projects/skills-into-cli.md`](../projects/skills-into-cli.md)

## Context

Each repository can have a settings file, `.cstack/settings.json`. It holds choices of the team, such as the test commands. It can also name the agent that does the independent review of a finished branch, and the model that agent uses.

The skill `resolve-issue` already settled where models come from. Line 210 of `skills/resolve-issue/SKILL.md` says that the model and the thinking level of each role are set in the headers of the files in `agents/`. The table at lines 30 to 40 lists every role with its model and level. The rule at line 42 says that a launch of a named agent passes no model, so the header decides.

The specification says that nobody needs to configure every role today (line 242). One role is different. A team may want another review agent, or another model for it, in one repository. The review is the last check before a pull request opens, so it is the role where that choice matters most.

## Options

1. Keep the headers only. The settings file never names an agent or a model. This is the simplest option, but a team can never change the review without editing the skill.
2. Let the settings file change the review agent and its model only. Every other role keeps its header. The thinking level of the review stays in its header.
3. Let the settings file configure every role. This gives the most control. It also gives a lot of keys to check and to document, and nobody asks for them today.

## Decision

We use option 2.

The settings file has a `review` key with two values, `agent` and `model`. When the file says nothing, the review agent is Claude, and its model is the one in the header of `pr-reviewer.md`. This is the third acceptance rule of user story US-10. Another agent runs only in a repository whose settings file names it.

Every other role keeps the model and the thinking level of its header. The thinking level of the review also stays in the header.

The settings file has a `version` key. A new key keeps version 1. A key that is renamed, removed or changed in meaning moves the format to version 2. A reader that sees an unknown key refuses the file, and tells the user to update cstack in case the key comes from a newer version.

## Consequences

The settled decision at line 210 is amended, not removed. The header stays the default for every role, and for the review when the file is silent.

Ticket #21 records this amendment next to the other settled decisions of the skill. Ticket #22 tells the executor how to apply it. The executor passes a model to the review only when the `review` value comes from the settings file.

A team can now change the review agent and its model with one small edit. A team cannot change any other role without a new decision. If a later need appears, a new record can take option 3 for that role.
