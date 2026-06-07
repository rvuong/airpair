Invoke the `linkedin-writer` agent to draft a LinkedIn episode.

Decision or milestone to cover: $ARGUMENTS

Expected format for $ARGUMENTS: a decision number (ex: D03) or a milestone description (ex: "résultat proto 0a — tilt validé, critère 3/4 atteint").

The agent will:
1. Read only the relevant Dxx entry from `docs/decisions.md` (or use the milestone info provided)
2. Read the first 30 lines of `docs/linkedin.md`
3. Write the draft to `docs/episodes/`

The episode number should follow the sequence in `docs/linkedin.md`. If no episodes exist yet, start at 01.
