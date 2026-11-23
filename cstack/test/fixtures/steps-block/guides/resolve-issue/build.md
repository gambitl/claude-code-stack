<!-- mandatory steps
command: cstack tracker move '<key>' --to "in progress" --tracker <name>
command: cstack unit order --plan <plan file>
helper: resolve-issue:implementer | each-unit
command: cstack unit red <n> | each-unit-with-test
command: cstack unit green <n> | each-unit-with-test
action: break-the-rule | each-negative-criterion
command: cstack unit commit <n> | each-unit
helper: resolve-issue:implementer-escalation | each-stuck-unit
action: check-the-user-interface | user-interface
helper: resolve-issue:cto-review plan-delta | new-structural-decision
helper: resolve-issue:code-reviewer-deep security
command: cstack tracker comment '<key>' --body-file <file> --tracker <name> | each-dependent-ticket
command: cstack next --done build --plan <plan file>
-->

# Phase `build`: a fixture guide with a block of mandatory steps

This file is a test fixture, not a real guide. Tests read its block of mandatory steps.
