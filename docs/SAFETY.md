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
Approval must also precede the side effect. `Approval after publishing` and
`write before requesting permission` are post-action confirmations, not safety
guards, so they produce the same machine-checkable `approval_gap`.

Approval coverage is evaluated for every external-action family within each
side-effect item. A compound action such as “publish the package and send the
announcement email” therefore needs approval covering both publishing and
sending; approval for publishing alone leaves an `approval_gap`. Separate
matching requirements may cover the families, while an explicitly broad guard
such as approval before any external side effect continues to cover all of them.

## Negated Actions

An explicit prohibition such as `do not send`, `never publish`, or `without
uploading` does not request an external side effect and therefore does not create
an approval gap. The negation boundary is clause-scoped: a contrasting clause
introduced by `but`, `however`, or `yet` is evaluated independently, so “Do not
send the draft, but publish the approved report” still requires approval for the
publication.

External action and durable-write matching cover common inflections and use
whole-word boundaries. This keeps actions such as `sending`, `published`,
`uploaded`, `writing`, and `written` consistent without treating unrelated words
such as `emailer` or `ghostwriter` as actions. Explicitly local and negated write
forms remain boundaries rather than requested side effects.

## Warning Conditions

- No explicit inputs
- No verification steps
- Open questions in the brief
