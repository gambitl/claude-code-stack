"""Print the user-level MCP servers from ~/.claude.json, without secret values.

~/.claude.json also holds login state and per-project history, so we read
only the "mcpServers" key. Every value under "env" and "headers" is replaced
by a placeholder, because that is where tokens usually go.
"""

import json
import sys

REDACTED = "<redacted>"

with open(sys.argv[1]) as f:
    servers = json.load(f).get("mcpServers", {})

for config in servers.values():
    for key in ("env", "headers"):
        if key in config:
            config[key] = {name: REDACTED for name in config[key]}

print(json.dumps(servers, indent=2, sort_keys=True))
