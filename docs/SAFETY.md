# Safety Model

`skill-input-contract` is a preflight helper. It identifies risk signals but does not grant permission for an agent to act.

## Blocking Conditions

- No clear outcome
- External side effects without an approval requirement

## Negated Actions

An explicit prohibition such as `do not send`, `never publish`, or `without
uploading` does not request an external side effect and therefore does not create
an approval gap. The negation boundary is clause-scoped: a contrasting clause
introduced by `but`, `however`, or `yet` is evaluated independently, so “Do not
send the draft, but publish the approved report” still requires approval for the
publication.

External action matching covers common inflections and uses whole-word
boundaries. This keeps actions such as `sending`, `published`, and `uploaded`
consistent without treating unrelated words such as `emailer` as actions.

## Warning Conditions

- No explicit inputs
- No verification steps
- Open questions in the brief
