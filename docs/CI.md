# CI validation

The GitHub Actions workflow at `.github/workflows/agentsurface-validate.yml` has two
tiers. It always runs AgentSurface's test suite and build. If the target repository has
`.agentsurface/config.yaml`, Tier 1 inspects the current source and validates the checked-in
AgentSurface surfaces without requiring a running site. It does not run `generate`, commit
changes, or write back to the repository.

Tier 1 marks live route reachability and content drift unchecked because it has no preview
server. Route parity, discovery integrity, ownership, and config/model errors still fail
validation. The structured report is saved as `.agentsurface/validate-report.json` and
uploaded as the `agentsurface-validation-report` artifact when available.

Tier 2 runs only when it receives an explicit preview URL. Supply one as the
`AGENTSURFACE_PREVIEW_URL` repository variable, or start `workflow_dispatch` and enter
`preview_url`. The URL is passed to `validate --server`; it is not stored in the report.
Network failures remain unchecked. Canonical route failures and other truth or safety
failures fail the job. Live Markdown drift is reported but does not fail by default. Set
`strict_drift` on a manual run, or `AGENTSURFACE_STRICT_DRIFT=true`, to make drift fail.

To use this workflow in a website repository:

1. Add and review `.agentsurface/config.yaml`.
2. Commit the generated model and outputs that the repository wants to validate.
3. Copy the workflow into `.github/workflows/`.
4. If live checks are useful, configure a public preview URL and confirm it is safe to
   expose in workflow logs. The workflow does not transmit credentials or add them to
   generated artifacts.

The workflow uses read-only repository permissions. It does not regenerate public
outputs, modify pull requests, publish artifacts to the site, or commit changes.
