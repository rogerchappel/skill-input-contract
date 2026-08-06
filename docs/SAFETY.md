# Safety Model

`skill-input-contract` is a preflight helper. It identifies risk signals but does not grant permission for an agent to act.

## Blocking Conditions

- No clear outcome
- External side effects without an approval requirement

Approval-related words alone do not satisfy the requirement. The constraint must
affirmatively require approval, confirmation, permission, authorization, or
consent. For example, `approval is required` and `ask for confirmation` satisfy
the gate, while `no approval is required` and `publish without approval` do not.
The latter forms produce an `approval_gap` when an external side effect exists.

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
