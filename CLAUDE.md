# Conventions for this repository

This file tells Claude and the skills how work is organised in this repository. Read it before you plan or create anything here.

## Where things live

- **Tracker.** The tickets are GitHub issues in this repository. A project is an epic, which is a parent issue with the `epic` label. The tickets of an epic are its sub-issues. A wave is a set of tickets that can start at the same time. Each wave is a GitHub milestone.
- **Specification pages.** Each project has one specification page, at `docs/projects/<project-slug>.md`. The epic links to it, and it links back to the epic.
- **Architecture decision records.** An architecture decision record (ADR) explains one technical choice and its reasons. ADRs live in `docs/decisions/`.
- **Layer labels.** `cstack` is the command-line tool that this repository builds. The `cli` label marks work on its code. The `skill` label marks work on the prose of skills and agent prompts. The `tests` label marks work on tests and continuous integration.
- **Language.** Everything written in this repository and in its issues is in English.
- **Design.** No project here has a user interface. Every project is a command-line tool or prose. No design stage applies.

## Public text rule

This repository is public. Never write the name of an employer or a client in it or in its issues. Never quote a ticket key from work. Never give a count taken from work retrospectives. The token and time results of a comparison are the only figures from work that you may publish. Keep any copy of a work ticket in a private repository.
