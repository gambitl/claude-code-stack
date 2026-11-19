# Answers of glab 1.119.0

No file in this folder was recorded. No GitLab sandbox exists, and the `glab` of the recording machine reaches a private instance. So every file here was written by hand.

The files follow the GitLab API documentation and the help of `glab` 1.119.0. The project is `example-group/example-project` and the only login is `example-person`. The hosts are `gitlab.com`.

- `issue-view.opened.json` comes from the "Issues" page, "Single project issue". The command behind it is `glab issue view 7 -F json`. It is issue 7, open, and its footer line says `Blocked by: #3`.
- `issue-list.page-1.json` comes from the "Issues" page, "List project issues". The command behind it is `glab issue list --milestone "cstack recording" -F json --per-page 100`. It holds three issues of one milestone, and one of them is closed.
- `api-issue-links.blocked-by.json` comes from the "Issue links" page, "List issue relations". The command behind it is `glab api projects/example-group%2Fexample-project/issues/7/links`. It holds one `is_blocked_by` link and one `relates_to` link.
- `api-issue-links.relates-to.json` comes from the same page and the same command. It holds only a `relates_to` link.
- `api-label.found.json` comes from the "Labels" page, "Get a single project label". The command behind it is `glab api projects/example-group%2Fexample-project/labels/in%20progress`.
- `api-label.not-found.txt` is the error text of `glab api` when GitLab answers `404 Not Found`. The command is the one of the previous file, for a label that does not exist.
- `issue-update.ok.txt` is the output of `glab issue update 7 --label "in progress"`.
- `issue-note.ok.txt` is the output of `glab issue note 7 --message "text"`.
