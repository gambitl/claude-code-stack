---
name: resolve-issue
description: Take one ticket, from any tracker (Linear, Jira, GitLab, GitHub), all the way to a merge-ready pull request, then document the outcome in the ticket, its dependent tickets and the team's documentation tool. Use it whenever the user gives a ticket id or URL and asks to "resolve", "implement", "take", "start" or "work on" it.
argument-hint: ticket id or URL
---

# Resolve Issue

You are taking one ticket all the way to a pull request or merge request that is ready to review. The user has provided: $ARGUMENTS

The tool `cstack` does every mechanical step of the run. It tracks the phases and prints each guide. You do the thinking and the writing. The files of this skill are in the skill folder, which Claude Code names when it loads this skill.

## How a run goes

1. Read the conventions file first.
2. Run `cstack next`. It prints the settings of the repository and then the guide of the phase.
3. Follow that guide. At the end of the phase, run the `cstack next --done <phase>` command that the guide gives.
4. Never read a guide ahead. Never do by hand a step that a `cstack` command does.

If `cstack next` prints a run line that names the plan file of another ticket, run `cstack next --new`. Then tell the user which plan file you set aside, because that run may be waiting for an answer.

If a guide is no longer in the conversation, run `cstack guide <phase>` to print it again. That command changes nothing in the run.

## Exit codes

- `1`: the command refused. Read the message, fix the cause and run the command again. Never work around a refusal.
- `2`: the command line is wrong. Fix it as the usage message says.
- `3`: an input is invalid. Fix the plan file or the settings file as the message says.
- `4`: a tool is missing. Tell the user what to install.
- `5`: a tool failed. Read its output and try once more. If it fails again, report the problem to the user.

If `cstack` itself is missing, say so, give this install command and stop: `npm install -g https://github.com/gambitl/claude-code-stack/releases/download/v<version>/gambitl-cstack-<version>.tgz`. Use the latest release as the version. This skill has no fallback without `cstack`.

## Settings

`cstack next` prints the values of `.cstack/settings.json` above each guide. These values win over any default that a guide gives. If the repository has no `.cstack/settings.json`, tell the user and point to the example `templates/settings.json` in the skill folder. The example has no `testCommands`, so tell the user to add their own, or a command that runs tests exits with `3`.

## Vocabulary

- **The conventions file**: the markdown file at the repository root that says how the team works there, usually `CLAUDE.md`, `AGENTS.md` or `CONTRIBUTING.md`. If there are none, or it is unclear which applies, ask the user.
- **The tracker**: the tool that holds the ticket, such as Linear, Jira, GitLab or GitHub. Use its direct connection, an MCP server or a client such as `gh`. Never scrape a web page.
- **The forge**: the service that hosts the code, such as GitHub or GitLab.
- **The plan file**: the markdown file in the repository that records everything about this ticket. It must always be complete enough to resume from.
- **A blocking question**: a question whose answer can change what the ticket builds, or whether its acceptance criteria are met. When in doubt, treat the question as blocking.
- **A fresh sub-agent**: a helper that starts with an empty context and receives only the prompt and inputs you give it.

## Helpers

Launch helpers as named agents, such as `resolve-issue:cto-review`. Do not pass a model, because the header of the prompt decides. The one exception is the independent review, which uses the agent and the model of the `review` setting.

## Writing

Follow the user's language in the conversation. Write every record in the records language that `cstack next` prints from the settings.

Write the way a colleague talks at their desk. Start with the outcome or with what you need. Put one idea in each sentence, in plain words. Use prose, not lists, unless the items are alike. Never mention the roles of this skill to the reader. A guide tells you when to read the full `writing.md` in the skill folder.

## Planned stops

The planned stops for the user are a blocked ticket, the question round and the approval gate. Two more stops happen only when needed. One is waiting for the answer to a blocking question that nobody in the conversation can answer. The other is a blocking question found after the build, which stops the run before the pull request opens.
