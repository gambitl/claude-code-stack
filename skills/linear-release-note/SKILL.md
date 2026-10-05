---
name: linear-release-note
description: Generate a technical release-notes page in Notion from a closed/shipped Linear PROJECT — enumerating its completed issues (OWL-NN), resolving the GitHub PR that shipped each one via Linear's auto-linked attachments, and diffing against the previous release-notes page to highlight additions, evolutions and removals. Use whenever the user asks to "write release notes", "document the release/project", "publish the changelog", "résumer le projet", "ship the release notes" and the tickets live in a Linear project. Trigger on requests conflating "project/release closure + changelog + diff vs previous version" in a Linear-tracked repo.
---

# Linear Release Notes

Aggregate every completed issue of a **Linear project**, resolve the GitHub PR that closed each one (via Linear's auto-linked attachments), cross-reference with the project's Notion spec page, diff against the previous release-notes page, and publish a **technical release-notes page** in Notion under the project's "Releases & changelog" section.

This skill enumerates completed **issues of a Linear project**. It assumes the ticket store is Linear (Owlaris since the Linear-first shift: Linear = single ticket store, Notion = prose/ADR, GitHub = code only — PRs link back via `Fixes OWL-NN`, not labels).

The skill is **conversational and gated** — 5 phases, each ending with explicit user approval. Don't run the next phase until the current one is signed off. Release notes are a public commitment; publishing wrong or partial notes is more expensive to fix than to delay.

Output language: **French** by default (Owlaris convention); auto-detect from the previous release-notes page if it's in another language and confirm.

## When this skill runs

The user wants to turn a shipped Linear project into a documented artefact. Inputs accepted in `$ARGUMENTS`:

- A **Linear project** — name (e.g. `CATE grey-box robustness`), URL (`https://linear.app/<org>/project/<slug>`), or slug.
- A **Notion URL** of the project's spec page (the prose page produced by `design-project`) — the skill resolves the linked Linear project from it.
- **Empty** — the skill asks the user which project to document (it does **not** guess from `git`, because a repo can host several Linear projects).

Trigger phrases: "release notes", "changelog", "documenter la release", "documenter le projet", "résumer le projet CATE", "publier les notes de version".

> ⚠️ **Linear only.** If the repo's `CLAUDE.md` says tickets live somewhere else (for example forge issues with a release label), this skill does not apply as is: tell the user and stop. It assumes Linear is the ticket store.

## Phase 1 — Preflight & resolve project

The skill is global; it adapts to the project it runs in. Read **once** at startup:

1. `CLAUDE.md` at the repo root (cwd) — extract:
   - **Documentation-of-record** — Notion vs `.md`. Default for this skill: **Notion** when MCP is connected, otherwise abort (this skill does not produce `.md` release notes — release notes are a publication artefact, not a draft).
   - **Which Notion connection** — honour any guardrail in `CLAUDE.md` (Owlaris: use `notion-local` / "Victor Di Stefano's Space" for all Owlaris docs, **never** `claude_ai_Notion`; the §9.3 ADR DB is `d6b16a40-c021-46d8-ae9e-1f46c7e9c1d9`). If an ADR/spec search surfaces unrelated content, you're on the wrong connection — switch.
   - **Release-notes parent page** — where releases live (Owlaris: §9.7 Releases & Changelog under `📚 owlaris-docs`). If unclear, ask the user once for the parent (URL or ID).
   - **Releases / Specs / ADR databases** — title keywords `releases`, `changelog`, `specs`, `ADR` under the engineering parent. Cache their `data_source_id` for Phase 5 + the §Liens queries.
2. **Linear MCP preflight** — verify a Linear MCP tool is callable (`mcp__linear__list_projects` / `mcp__linear__get_project`). If absent, **abort**: the skill needs to enumerate the project's issues. The repo host (GitHub via `gh`) is still needed for PR bodies — `which gh`; if absent, degrade (PR titles come from Linear attachment names, bodies are skipped).
3. **Notion MCP preflight** — if a `mcp__*Notion*` search/fetch tool is callable, Notion mode is ready. Else if only an `authenticate` tool is visible, run the OAuth flow. Else abort with "Notion MCP unavailable — release notes require Notion. Connect it and re-run."

**Resolve the project**:

- From `$ARGUMENTS` (name / URL / slug) → `mcp__linear__get_project`. If a name is ambiguous, `list_projects` and `AskUserQuestion` to disambiguate.
- If `$ARGUMENTS` is a **Notion spec URL** → fetch it, follow the cross-link to the Linear project (the `design-project` flow stores it), then `get_project`.
- Capture: project name, state (the skill warns if not `Completed`/`Done` — see edge cases), description, milestone list, the linked Notion spec page URL, and the **release tag** if the project maps to a versioned cut in §9.7 (ask the user for the tag when it's not derivable from the project title).
- **Schema-mismatch heads-up (common).** The Releases DB may still be **version-cut and GitHub-shaped** (rows `Release Notes — V1.X`, columns `Ticket range (T-NN)`, `GH issue range (#NN)`, `Branch prefix`) while you're documenting a **Linear project** (OWL-NN, no contiguous GH range, no V-tag). Don't force a wrong fit: ask the user how to identify the release — (a) a new project-named row, or (b) the next version number in sequence (compute it: the highest existing `Release Notes — V<x>.<y>` + 1). Whichever they pick, fill the Linear-native fields and put `Projet Linear (pas de range GH) — PRs #a–#b` in the GH-range column rather than leaving it blank or fabricating a `T-NN` range.

**The diff is scope-relative, not page-relative.** The "Diff" section answers a single question: *for the surface this project touched, what did it change compared to before the project existed?* That is **intrinsic to the project's own change set** — the union of its merged PRs against the pre-project state of those same paths — and is computed from git (Phase 2 step 8), not by comparing two Notion pages. It does **not** require any previous release-notes page to exist.

**Resolve the structural reference** (a *previous* release-notes page — for tone/structure only):

- Search the release-notes parent (Owlaris: §9.7) for the **most recent existing** `Release Notes — …` page. Its sole roles: (a) mirror its section order / tone / detail level for cross-release consistency, and (b) receive the forward backlink in Phase 5. It is **not** the diff baseline.
- If none exists (first release ever), that's fine — no structural template to mirror, no forward backlink to write. The Diff section is unaffected (it's git-derived regardless).

Read-back in 4-6 lines: Linear project (+ state), release tag (if any), Notion spec page URL, structural-reference RN page URL (or "first release"), parent page where the new note will live, FR/other language. User confirms before Phase 2.

## Phase 2 — Collect inputs (read-only, batched)

Parallelise the independent queries:

1. **Completed issues of the project** — `mcp__linear__list_issues` filtered by `project` + state category `completed` (Done/Released). Pull `identifier` (OWL-NN), `title`, `description`, `labels`, `completedAt`, `url`, `assignee`, `projectMilestone`, and `attachments`. Page through if the project is large. If the completed count is suspiciously low (< 3) or the project has many `started`/`backlog` issues still open, surface a warning before continuing.
2. **Non-completed issues of the project** — same query, state category `started` / `backlog` / `unstarted`. Don't fail; keep them aside for §"Reporté".
3. **PRs that shipped each issue** — **note: `list_issues` does NOT return attachments** (only `get_issue` per issue does, which is 1 call/issue — too costly for a 30+ issue project). The robust path is to **resolve from GitHub by `OWL-NN`**: list the repo's merged PRs in the ship window once (`gh pr list --repo <owner>/<repo> --state merged --search "merged:>=<window-start>" --json number,title,headRefName,mergedAt,url`), then join each issue to its PR(s) by matching `owl[-\s]?<n>` in the PR **branch name or title** (Linear-first branches are `…/owl-NN-…`; PR titles carry `OWL-NN` / `Fixes OWL-NN`). This single-list-then-join is far cheaper than per-issue attachment lookups and catches PRs whose tag is a typo (e.g. branch `owl-56` but title says `OWL-55` — match the branch). Watch for PRs tagging an `OWL-NN` that isn't in *this* project (another project's issue) — exclude those. Cap each PR body excerpt to ~30 lines. If `gh` is unavailable, mark the bullet `(PR non récupérée)`.
4. **Notion project spec page** — fetch the prose spec (Contexte / Why / USs / Impact architecture / milestones). Source of the "Highlights" and the per-issue user-facing one-liner.
5. **Notion structural-reference release-notes page** (if one exists) — fetch the whole body. Capture its structure (section order, detail level, tone) — the new page mirrors it for cross-release consistency. **Do not** mine it for diff content; the diff is git-derived (step 8).
6. **Linear project milestones** — `mcp__linear__list_milestones` for the project; use them as the "waves" grouping inside layers when a project has > ~8 issues.
7. **Optional `git log`** — if release tags exist as git tags: `git log <prev>..<curr> --oneline --no-merges` as a sanity check. Skip silently otherwise.
8. **Project scope change-set** (drives §4 Diff) — aggregate the **per-file change status** across every merged PR of the project's completed issues. For each PR: `gh api repos/<owner>/<repo>/pulls/<n>/files --jq '.[] | {path, status}'` (status ∈ `added`/`modified`/`removed`/`renamed` — the `gh pr view --json files` shape lacks `status`, so use the API). Collapse to one **net status per path** across the whole project set:
   - a path whose **earliest** project-PR status is `added`, and that did not exist before the project → **Ajout** (new this project);
   - a path that **pre-existed** the project and was `modified`/`renamed` → **Évolution**;
   - a path `removed` and not re-added → **Retrait**.
   "Pre-existed the project" = the path's earliest status across the project's own PRs is not `added`. This is exactly "what changed on the project's scope vs before the project" — no commit-range gymnastics needed, the PR set *is* the project's footprint. Group paths into modules/capabilities for the readout (don't list every file).
   - **Run the per-PR `gh api …/files` calls from a small script with a per-call timeout** (e.g. a Python loop over the PR list, `subprocess` with `timeout=30`, writing a `pr⇥status⇥path` TSV), not a bare shell `for`-loop — the latter hung repeatedly under the harness's command backgrounding. Then aggregate the TSV in one pass.

**Operational note — large MCP payloads.** `mcp__linear__list_issues` (a 30+ issue project) and `mcp__notion-local__API-post-search` routinely exceed the tool-result token cap and get spilled to a file. Don't try to read them whole: extract the few fields you need with `jq`/python over the saved file (issue `id`/`statusType`/`completedAt`/`labels`/`gitBranchName`; page `id`/title/`url`/`parent.data_source_id`). Note `list_issues` exposes state as `status`/`statusType` (not a nested `state` object) and omits `projectMilestone` on issues that have none.

Build an in-memory join table: `OWL-NN | issue title | milestone | PR # | PR title | layer | labels | completedAt`. **The join key is `OWL-NN ↔ PR`** — there is no `T-NN ↔ #issue` indirection anymore. Keep the scope change-set (step 8) as a separate net-status-per-path map.

**Layer inference** (Front / Back / Data-ML / Infra-Tools), in priority order: (a) Linear label if the team uses a layer taxonomy (Owlaris OWL team labels, cf. the product-structuring convention); else (b) the dominant top-level directory of the PR's changed files (`front/` → Front, `back/` → Back, `data/` → Data-ML, root configs/scripts → Infra-Tools); else (c) ask in Phase 4.

## Phase 3 — Categorize & draft

The page is **technical** (single audience: devs / lead / future-me). Section structure:

1. **Contexte** — 2-3 phrases. Source: the Notion spec's context/why, condensed. End with the project name, release tag (if any), and ship date.
2. **Highlights** — 3-5 bullets, the most load-bearing changes (architecture-impacting, or a new capability for a whole layer). Pull from the spec's goals + impact section.
3. **Changements par couche** — one subsection per layer that has issues in this release. Default layers: `Front`, `Back`, `Data / ML`, `Infra / Outils`. Skip a layer with zero issues.
   - Each subsection is a bullet list, one bullet per issue:
     - **`OWL-NN — <titre>`** (technical wording). 1 line on what was implemented (paraphrased from the acceptance criteria + PR title). Closing: `(PR #<pr>)`, and `[OWL-NN](<linear-url>)` link.
     - When the project has milestones, group bullets by **milestone** inside the layer (each milestone = a "wave"); otherwise group by sub-theme if > 4 bullets.
4. **Diff de périmètre — avant ce projet → après** — what the project changed *on its own scope*, derived from the Phase 2 step 8 change-set (net status per path), grouped into modules/capabilities (not raw file lists). Three sub-blocks:
   - **Ajouts** — capacités/modules qui **n'existaient pas avant ce projet** (`added` paths; new packages from the spec's impact section; new endpoints/pages). These are net-new surface the project created.
   - **Évolutions** — zones qui **existaient déjà avant le projet** et que celui-ci a modifiées (`modified`/`renamed` paths), en priorisant les fichiers core/partagés. Dire en une ligne *ce qui change* dans le comportement, pas juste "fichier touché".
   - **Retraits / déprécations** — surface **supprimée ou dépréciée par ce projet** (`removed` paths; `feat!:` Conventional Commits; "removed"/"deprecated" in PR titles; deprecation labels).

   This block is **about the project's footprint**, computed from git — it does not compare against any previous release-notes page. The frame is always "voici l'état du périmètre touché avant le projet, voici ce que le projet en a fait".
5. **Schéma / migrations** — only if the release touched DB or contracts. Pull from the spec's "DB surface" + any Alembic / migration files in the PRs. Small table: `Cible | Changement | Migration`.
6. **Tests / qualité** — short paragraph. New integration/E2E test files, test-infra issues.
7. **Sécurité** — bullets factuels, sourcés. List security-relevant changes:
   - **Nouveaux contrôles d'autorisation** — endpoints ajoutés/durcis (tenant-isolation, rôles, scope). Source: issues labellisées `security`/`authz`, PRs dont le titre/corps mentionne `403`/`404`/`tenant`/`authz`, ADRs §9.3 d'autorisation dans la fenêtre release.
   - **Nouvelle surface exposée** — endpoints/pages publiques ajoutés, croisés avec la spec.
   - **Bumps de dépendances pour CVE** — entrées `package-lock.json`/`go.sum`/`uv.lock` modifiées dans une PR mentionnant un CVE. Citer le CVE-ID si dispo.
   - **Changements secret/PII** — rotation, nouvelle var d'env, scrubbing Sentry, retrait d'un champ PII des logs.

   Source: issues/PRs avec label `security`/`authz`/`dependencies` **et** ADRs §9.3 dont les triggers security ont été activés sur la fenêtre. Rien à signaler → `(aucun changement security-relevant)`. Un bullet = un fait sourcé (PR, issue ou ADR cité), pas d'interprétation.
8. **Process / docs** — new conventions introduced (ADR, runbook, slash-command), with links.
9. **Reporté à la prochaine release** — the non-completed issues from Phase 2 step 2, listed by `OWL-NN` + a one-line "why deferred" if the issue body says. This section must stay consistent with the Phase 5 leftover-issue reconciliation: record each issue's **disposition** (→ backlog, → successor project `<name>`, or canceled). Don't list an issue here as "reporté" while Phase 5 cancels it — same decision, one place.
10. **Liens** — bullet list of canonical references. **Build by query** (don't trust memory):
   - Linear project URL (captured Phase 1).
   - Linear filtered view of the project's completed issues (project URL with state filter).
   - Notion project spec page (URL captured Phase 1).
   - Baseline release notes (URL captured Phase 1).
   - GitHub PR search for the release: `https://github.com/<owner>/<repo>/pulls?q=is%3Apr+is%3Amerged+OWL-NN…` (or a date-windowed merged-PR query).
   - **ADRs created during this release** — query the ADR DB (Owlaris: §9.3) filtered by `Date` within the release window (start = first issue's `completedAt`; end = ship date), or by string-search on the project name / `OWL-NN` ids. Enumerate by ID + Title + Notion URL. None → `(aucune ADR sur cette release)`.
   - **Post-mortems referenced** — query the Incidents DB (Owlaris: §9.8) for posts in the release window or mentioning any issue/PR of this release. None → `(aucun incident)`.
   - **Specs DB filter** — direct Notion query URL for the spec(s) of this project in the Specs DB (Owlaris: §9.6).

**Drafting rules**:

- One-liner per issue, not a paragraph. The page must be scannable in 2 minutes.
- Use the **PR title** when clearer than the issue title (PR titles follow Conventional Commits).
- Quote the **`OWL-NN` id**, the **PR number**, and link the Linear issue. Two identifiers + a link; cheap to add; load-bearing later.
- Never fabricate. If a layer's issues are too thin to write meaningfully, link the Linear issues and move on.

**Do NOT** create the Notion page yet. Hold the draft in memory.

## Phase 4 — Review

Present a structural summary (10-15 lines):

- Projet Linear (+ état) · release tag éventuel · RN de référence structurelle (ou "première release")
- N issues complétées · M PRs jointes · J issues sans PR résolue
- Périmètre §4 : X ajouts · Y évolutions · Z retraits (modules, depuis le change-set git)
- K issues non complétées reportées (§"Reporté")
- Couches couvertes · jalons (milestones) couverts
- Sections produites
- Page parent Notion où sera publié

`AskUserQuestion`:

> Le brouillon est prêt. Comment veux-tu procéder ?

Options:
- **`Publier sous <parent>`** — passe en Phase 5.
- **`Corriger la catégorisation`** — re-AskUserQuestion ciblé sur les entrées ambiguës (issues que tu hésites à classer Ajouts/Évolutions, ou layer mal inféré). Batched par type d'ambiguïté, ≤ 4 questions par tour.
- **`Réécrire la section <X>`** — précise quelle section; repasse en Phase 3 sur ce sous-périmètre.
- **`Annuler`** — stop, rien n'est créé.

## Phase 5 — Publish & cross-link

1. **Create the Notion page** under the resolved parent. Title: `Release Notes — <project ou release tag> — <YYYY-MM-DD>` (date = ship date — today for forward-mode, the historical date for backfill). Write the page with proper Notion blocks (headings, tables, to-do, code blocks). Note the project guardrail: `insert_content` does **not** parse markdown tables/headings — use `create-pages` (parses) or build typed blocks; raw-API `patch-block-children` forwards full block JSON in chunks.
2. **Append blocks** in batches of ≤ 100 (Notion API cap). On partial failure, surface the page URL and offer retry-append / archive-restart / abort.
3. **Backlinks (bidirectional)** — non-negotiable, this is the whole reason the page exists:
   - **Previous release-notes page** (the structural reference, if one exists) → append a "Release suivante → [Release Notes — `<tag>`](url)" callout at the top. Skip if first release.
   - **Notion project spec page** → append a "Release notes → [Release Notes — `<tag>`](url)" line in its header/metadata section.
   - **Linear project** → add a comment (`mcp__linear__save_comment` on the project, or update the project description's links block) pointing at the release-notes page. Do **not** create a duplicate GitHub-URL attachment (cf. the auto-link guardrail — manual same-URL attachment dedups against and blocks the native link).
4. **Project-side artefacts — Notion documentation harness** — non-negotiable when CLAUDE.md flags Notion as documentation-of-record. These flip the release to "shipped" across the docset:
   - **Releases-DB entry** (Owlaris: §9.7) — find the row matching the release tag / project. For a Linear project there's usually **no pre-existing `In Dev` row** (the old GitHub ticketing skill that created them isn't in the Linear-first flow), so you'll typically **create the row fresh** — the release-notes page you just made under the §9.7 data source *is* that row. Set `Statut = Shipped`, `Date cible` (start/end = ship window), `Notes DB = <release-notes-URL>`, and the Linear-native `Ticket range` / GH-range fields per the Phase 1 schema-mismatch note. If a matching row already exists, update it in place rather than duplicating.
   - **Specs-DB bulk-update** (Owlaris: §9.6) — query specs for this project/release; flip `Statut → Shipped`; fill an empty `GH PR` from the join table (never overwrite a non-empty value). Use the `userDefined:` prefix only for columns literally named `id`/`url` (cf. Notion column convention).
   - **Documentary index** (optional) — add one row for the release-notes page if a transverse index DB exists.
5. **Linear-side project closure** — closing a project on Linear is a ritual, not just a state flip. Run it as one gated block (the user can opt out of the whole block and keep the project open). Order matters — reconcile issues **before** flipping state:

   a. **Reconcile leftover issues** — the non-completed issues from Phase 2 step 2. A project should not flip to `Completed` with open issues silently attached. Present them as a batch with the **default disposition = move to Backlog or a successor project** (`mcp__linear__save_issue` to repoint `project` / clear it to backlog), per-issue override available. Alternatives offered: cancel (set Canceled state) for genuinely abandoned work, or leave-and-document. Whatever the choice, it must match what §"Reporté" says — list where each leftover issue went (target project / backlog / canceled). Never cancel an issue without explicit confirmation.

   b. **Verify milestones** — `list_milestones`; every milestone should be complete. Any incomplete milestone is surfaced and noted in §"Reporté" (its remaining issues were just reconciled in step a).

   c. **Post the final project update** — `mcp__linear__save_status_update` (`type: "project"`) with a short closing narrative (health on-track / completed-tone) linking the release-notes page. This is Linear's canonical "the project shipped" signal — it lands in the project's update feed, which the state flip alone does not. **Degradation chain** (workspace-dependent): if it errors `Project status updates are not enabled for this workspace`, fall back to a project comment; if project-scoped comments aren't available either (some workspaces only allow issue comments), fall back to appending a "Release notes → <url>" line to the project description's links block (careful: a full-description rewrite of a shared project can hit a classifier denial — append minimally, don't rewrite). If none works, rely on the release-notes → project link (always present in §10 + the top callout) and **state the Linear-side backlink couldn't be posted** in the final summary — don't claim it silently.

   d. **Set project state → `Completed`** — `AskUserQuestion`: "Marquer le projet Linear comme `Completed` ?" If yes and not already, `mcp__linear__save_project` to set the completed state (stamps completion). Never silently change project state. If the user declines, stop here — steps a–c still stand, the project just stays open.
6. **CLAUDE.md `Active release` block** — if the repo tracks the current release there, prompt: "Marquer `<tag>` comme publiée et passer à la prochaine ?" If yes, edit + commit `docs: mark <tag> released, link release notes`.
7. **Optional — GitHub Release** — `AskUserQuestion`: "Publier aussi une GitHub Release ?" Default `Non` (Notion is canon). If yes: render the Notion page to markdown, write a tmp file, `gh release create <tag> --title "<tag>" --notes-file <tmp.md>`.
8. **Architecture-map refresh (best-effort, NON-BLOCKING)** — shipping a project also refreshes the living architecture map (OWL-150). This step **must never abort the release-notes publish**: every failure below degrades to a warning in the final summary, the notes still ship.
   - **Guard first.** Only attempt this when the repo actually has the generator + manifest: `architecture-map/manifest/` and the `tools/architecture_map` module exist (e.g. `test -d architecture-map/manifest`). If absent (a repo that never adopted the map), skip silently — not every repo has one.
   - **Regenerate the WHOLE map** (not just the shipping project — the generator reads the entire manifest): write the live Linear projects + initiatives you already enumerated to a temp file, then run, capturing the exit code:
     ```bash
     # projects.json = [{"name","url"}, …] from list_projects + list_initiatives
     uv run python -m tools.architecture_map \
       --release "<release tag>" \
       --generated-label "regenerated <YYYY-MM-DD>" \
       --check-drift --linear-projects /tmp/archmap-projects.json
     ```
   - **Failure = warn, don't fail.** If the command exits non-zero (or `uv`/repo missing), do **not** retry-block and do **not** touch the release-notes page — record `architecture-map refresh failed (non-blocking): <stderr tail>` for the final summary and move on.
   - **Drift is informational.** The `--check-drift` stderr lists live Linear projects absent from the manifest. Surface them to the user as a non-blocking note ("the map is missing: …; add a fragment under `architecture-map/manifest/`"), never as an error.
   - **Commit the refreshed artifact** if it changed and you're on a branch where that's appropriate: `git add docs/architecture-map.html && git commit -m "docs: refresh architecture map for <tag>"`. The file is `-merge` in `.gitattributes`, so never hand-resolve it — regenerate. If committing isn't appropriate (detached/main-protected), just report that the map changed.

## Idempotency, edge cases, and safety

- **Project not `Completed`** → warn loudly, list the still-open issues, and ask whether to proceed (documenting a mid-flight project) or abort. Don't silently produce notes for an unfinished project.
- **Release-notes page already exists** at the parent → ask: `Écraser (archiver + recréer)`, `Suffixer (v2)`, `Abandonner`. Default `(v2)`.
- **Zero completed issues** → bail: "Aucune issue complétée dans le projet `<name>`. Vérifier le projet/état." Don't write an empty page.
- **Notion spec page not found** → ask the user to point at it (URL). Without it, Highlights/Contexte fall back to the Linear project description alone — note the degradation.
- **No previous release-notes page** (first release ever) → the §4 Diff is **unaffected** (it's git-derived from the project's own change-set, not from a prior page). Only consequences: no structural template to mirror (use the default 10-section order) and no forward backlink to write in Phase 5.
- **Project's PRs can't be enumerated** (no `gh`, or no merged PRs auto-linked) → §4 Diff degrades to capability-level only, sourced from the spec's impact section; mark it `(périmètre fichier non calculé — gh indisponible)`. Don't silently emit an empty Diff.
- **A completed issue has no PR** (closed manually, or PR not auto-linked and `OWL-NN` search empty) → keep it, mark `(sans PR)`. Don't drop silently.
- **A PR closes multiple issues** → list under the primary `OWL-NN`; mention the others as "lié à OWL-XX, OWL-YY".
- **Wrong Notion connection** (Owlaris: an ADR/spec query returns Kardinal content) → switch to `notion-local`; the §9.3 ADR DB 404 is the tell. Never read/write `claude_ai_Notion` for Owlaris.
- **Notion API failure mid-write** → surface the partial page URL; offer retry-append, archive-and-restart, or abort.

## Anti-patterns to avoid

- **Don't use this skill for a release tracked outside Linear.** It assumes a Linear project is the source of truth.
- **Don't write user-facing marketing copy.** This is a technical page. "We're excited to announce…" has no place here.
- **Don't fabricate impact statements.** Sparse issue body → terse bullet. Don't invent acceptance criteria.
- **Don't paste the entire issue/PR body.** One line per issue, with `OWL-NN` + PR # + Linear link. More detail is one click away.
- **Don't manual-attach the release-notes URL as a GitHub-URL attachment on Linear** — it dedups against and blocks the native PR auto-link. Use a comment or the description links block.
- **Don't compute the §4 Diff against a previous release-notes page.** The diff is *scope-relative*: it describes what THIS project changed on its own footprint vs the state before the project, derived from the union of its PRs (Phase 2 step 8). A previous RN page only lends structure/tone and receives the forward backlink. Two parallel projects (e.g. CATE vs Elasticity) each have their own footprint and their own correct diff — chronological order between them is irrelevant.
- **Don't skip the backlinks step.** A release-notes page without "previous", "spec", and "Linear project" links rots into a floating document.
- **Don't auto-publish a GitHub Release** when the user hasn't asked — Notion is canon, the GH release is opt-in.
- **Don't change Linear project state without asking.** Flipping a project to Completed is a visible team-wide signal.
- **Don't flip a project to Completed with open issues still attached.** Reconcile them first (Phase 5 step 5a) — default move-to-backlog/successor, never silent cancel. A "Completed" project trailing open issues reads as broken hygiene and orphans the work.
- **Don't skip the final project update.** The state flip alone is invisible in the project feed; the closing `save_status_update` is what signals "shipped" to the team and carries the release-notes link.
- **Don't skip the project-side artefacts in Phase 5 step 4.** Publishing without flipping the Releases-DB `Statut` and bulk-updating the Specs-DB leaves the docset half-shipped: later spec lookups from the ticket-resolution command return stale rows.
- **Don't mix languages.** FR by default (or the baseline page's language) — every header and bullet.
- **Don't fabricate ADR/incident references.** §Liens must come from real DB queries. Empty is valid — write "(aucune)".

## Output contract

Final state after a successful Phase 5:

- A Notion page `Release Notes — <project/tag> — <YYYY-MM-DD>` exists under the project's "Releases & changelog" parent (Owlaris: §9.7).
- The page is structured per the 10 sections above, each filled or explicitly marked "rien à signaler".
- The previous release-notes page (if any) links forward to it; the Notion spec page and the Linear project both link to it.
- **The Releases-DB entry** is `Statut: Shipped`, `Date cible:end` set, `Notes DB` linking to the page.
- **Every Specs-DB entry** for this project/release is `Statut: Shipped`, `GH PR` populated where the join table found one.
- **Linear closure ritual** (gated, opt-out as a block): leftover issues reconciled (default → backlog/successor project, never silently canceled) and consistent with §Reporté; a final project update posted linking the release notes; project state set to `Completed` on explicit opt-in.
- (Optional) A documentary-index entry exists for the page.
- (Optional) A GitHub Release of the same name exists, if the user opted in.
- The user has a chat summary: page URL, OWL issue count, layers covered, reporté count + their disposition, specs flipped to Shipped, Linear project state + final-update posted y/n, GH release y/n.
