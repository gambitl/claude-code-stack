# Recorded answers of gh 2.101.0

These files were recorded with `gh` 2.101.0 on a private sandbox repository. The sandbox holds no work data. Every file was recorded on 2026-11-19, and then a placeholder pass replaced the private values.

The sandbox had one milestone, `cstack recording`, with four issues. Issue 3 is the epic. Issue 4 is the blocker. Issue 5 is blocked by issue 4 through the `blockedBy` relation. Issue 6 has its blocker only in its footer line. Issues 4 and 5 are sub-issues of issue 3.

## Placeholders

- The sandbox owner and name are written `example-owner/example-repo`.
- Every node id is written `id-placeholder`.
- Every login is written `example-person`.
- Hosts are only `github.com`, so no host needed a replacement.

`<repo>` below means the sandbox repository. Every command ran with `--repo <repo>`.

## Files and commands

Here `<fields>` means `number,title,body,url,state,stateReason,labels,blockedBy`.

- `issue-view.blocked-by.json` is the standard output of `gh issue view 5 --repo <repo> --json <fields>`. The exit code was 0.
- `issue-view.footer-only.json` is the standard output of `gh issue view 6 --repo <repo> --json <fields>`. The exit code was 0.
- `issue-view.in-progress.json` is the same command as the first file for issue 5, run after the successful edit. The exit code was 0.
- `issue-view.state.json` is the standard output of `gh issue view 4 --repo <repo> --json number,state,labels`. The exit code was 0.
- `issue-view.sub-issues.json` is the standard output of `gh issue view 3 --repo <repo> --json subIssues`. The exit code was 0.
- `issue-view.not-found.txt` is the standard error of `gh issue view 9999 --repo <repo> --json number,state,labels`. The exit code was 1.
- `issue-list.milestone.json` is the standard output of `gh issue list --repo <repo> --milestone "cstack recording" --state all --limit 500 --json <fields>`. The exit code was 0.
- `issue-list.parent-issue.json` is the standard output of `gh issue list --repo <repo> --search "parent-issue:<repo>#3" --state all --limit 500 --json <fields>`. The exit code was 0. The first try answered with one issue only, because the search index was not ready. This file comes from a second try 20 seconds later.
- `issue-edit.missing-label.txt` is the standard error of `gh issue edit 5 --repo <repo> --add-label "in progress" --remove-label "in review"`, run while the label `in review` did not exist. The exit code was 1. The answer names only the first missing label that `gh` finds, here `in review`.
- `issue-edit.ok.txt` is the standard output of the same command, after `gh label create "in progress"` and `gh label create "in review"`. The exit code was 0.
- `issue-comment.ok.txt` is the standard output of `gh issue comment 5 --repo <repo> --body-file <file>` with the text `Recording comment.`. The exit code was 0.

`gh auth status` is not recorded, because its answer holds the account name. The tests need only its exit code.
