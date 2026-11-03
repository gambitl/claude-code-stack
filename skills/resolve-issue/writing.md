# Writing guide

Read this guide before you write anything a person will read. That covers your messages in the conversation, the blocks of the plan file that the user sees, the pull request, ticket comments and decision records. A helper that only reports to another agent, such as an implementer or a code reviewer, does not need it.

The team that uses this skill likes its workflow. What they complain about is how it writes. Its texts are so long and so formal that nobody reads them to the end. A question that nobody reads is a question nobody answered, so this guide matters as much as the tests.

## Who reads

The reader is a developer of the team. They know the stack and the usual tools, such as git, pull requests, databases, tests and the languages of the repository. They have not read what you read during this run, and they do not know this part of the code as well as you do now. Several of them read English as a second language.

So do not explain what a developer already knows, such as what a merge commit, a tenant or a 403 is. Do explain what only exists in this project, such as a name, a rule from a decision record, or the reason a number matters.

## Language

Write your messages in the conversation in the language the user writes in. Match their tone too: if they say "tu" in French, say "tu". The plan file header records this language under "Conversation language".

Everything that stays is written in English, unless the conventions file says otherwise. That means the plan file, commits, the pull request, ticket comments, decision records and the retrospective. A question drafted for someone outside the conversation is written in the language of the place where it will be sent, and the user sees it in that language.

## Talk like a colleague

Write the way a senior colleague explains things out loud at their desk. Before you send a text, read each sentence and ask yourself whether a person would say it out loud. If not, rewrite it.

- Start with what you need from the reader, or with the outcome. Context comes after, and only the context that changes their answer.
- Put one idea in each sentence, and keep sentences under about 20 words when you can.
- Write prose by default. Use a list only for several items of the same kind, such as questions to answer.
- Never put a label in front of each paragraph, such as "What this is about." or "Why it matters here.". Say it in the sentence instead.
- Name a ticket by what it does, followed by its id, the first time you mention it: "the ticket that deletes the old tenants (OWL-288)". Put at most two ids in one sentence.
- Say "I" when you talk about yourself. Never mention "the main agent", "the executor", "the advisor" or "the run": the reader does not know these roles.
- Do not announce what you are about to say, and do not sum up what you just said.
- Never write "Note that", "It is worth noting", "Importantly", "Crucially" or "Let me".

## Words that stay inside the skill

The skill uses its own words so that its agents understand each other. The reader does not know these words. Never write them in a text meant for a person, and say the plain thing instead.

| Do not write | Write instead |
|---|---|
| blocking question, non-blocking question | "I need your answer before I can plan", "this can wait, the work is correct whatever the answer" |
| lens, surface, "no strategic surface, skip" | nothing: do not mention what does not apply |
| moment, before-plan, plan-delta, after-build | nothing |
| hand-down, hand-off | "the comment I will leave on the ticket that adds the export (OWL-301)" |
| needs-decision, done report, published report | "I need a decision", "the work is finished", "the pull request is open" |
| tested answer | "I checked it: …" |
| one-way door, blast radius | "this cannot be undone", "what breaks if this is wrong" |

## Length

The reader has to read all of your text. If it takes more than two minutes to read, it is too long. Put the detail in the plan file and tell the reader where it is.

## Example

This question comes from a real plan. The full original took 286 words:

> **4. When this pull request merges, will you click "Create a merge commit" and never "Squash and merge"?**
>
> *What this is about.* Git can bring one branch into another in two ways. A merge commit keeps the full history, so git remembers that `main`'s commits are now part of the integration branch. A squash flattens everything into one new commit, and git forgets where that content came from.
>
> *Why it matters here.* This pull request carries the merge of `main` into the integration branch. `main` has 51 commits that the integration branch does not have, and 13 files conflict. The project's default merge button is squash. The integration branch receives `main` twice a day, and it goes back into `main` at the end (M4-8).
>
> *What happens if we ignore it.* After a squash, git still believes `main`'s 51 commits are missing from the integration branch. The next sync and the final merge into `main` would meet the same 13 conflicts again, and someone else would resolve them, possibly differently. Several of those conflicts sit in the code that decides who may run what (see question 8).
>
> *Default if nothing is decided.* GitHub shows the repository's default button, which may be squash.
>
> *My recommendation.* Merge this pull request with "Create a merge commit". Write that instruction as the first line of the pull request description, because you will click the button yourself (auto mode cannot merge). [...]

The same point, written for a developer of the team, takes 79 words:

> **Merge this pull request with "Create a merge commit", not with "Squash and merge".** It brings 51 commits of `main` into the integration branch, with 13 conflicts resolved. A squash would make git forget that those commits are already in. The next sync would then hit the same 13 conflicts again, and several of them are in the access checks. The default button is squash, so I will write this on the first line of the pull request description.

The second version keeps every fact that changes the decision. It drops the explanation of what a squash is, the labels, and the default that nobody needed.
