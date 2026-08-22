# Feature Specification: Project Scaffold

**Feature Branch**: `000-scaffold`

**Created**: 2026-08-22

**Status**: Draft

**Input**: User description: "do 000-scaffold"

**Context**: `specs/001-deck-runs/` has a complete specification and implementation plan and
cannot be built, because the repository contains no application code — no package manifest, no
build tooling, no test runner, no continuous integration. This feature creates the thing 001
gets built inside.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clone it and see it run (Priority: P1)

Someone with a working machine and nothing else project-specific installed clones the repository,
runs a small number of documented commands, and has the application open in a browser. They did
not have to read source code, install anything system-wide, or ask anyone what the missing step
was.

**Why this priority**: Nothing else in this feature matters if the project cannot be started.
Every other story assumes a developer already got this far.

**Independent Test**: On a machine that has never built this project, clone it, follow the
README, and confirm a page renders in a browser. Count the commands and time it.

**Acceptance Scenarios**:

1. **Given** a machine with only the documented prerequisites, **When** a developer clones and
   follows the README, **Then** the application renders in a browser with no undocumented step.
2. **Given** a fresh clone, **When** the developer installs dependencies, **Then** the versions
   installed are exactly those recorded in the repository, not whatever is newest that day.
3. **Given** a developer whose default runtime version differs from the project's, **When** they
   follow the README, **Then** the correct version is selected for this project without changing
   their machine's default.
4. **Given** the running application, **When** the developer edits a source file, **Then** the
   browser reflects the change without a manual restart.

---

### User Story 2 - Every change gets an automatic verdict (Priority: P2)

A developer pushes a branch and opens a pull request. Without asking anyone or running anything
locally, they learn whether the change installs, lints, typechecks, tests, and builds. A change
that breaks any of those cannot be merged.

**Why this priority**: This is the constitution's core enforcement mechanism. Without it, every
rule in the project is advisory. It depends on Story 1 existing but is what keeps the repository
trustworthy over time.

**Independent Test**: Open a pull request containing a deliberate failure of each gate in turn
and confirm each one is reported and blocks merging.

**Acceptance Scenarios**:

1. **Given** a pull request, **When** it is opened or updated, **Then** all quality gates run
   automatically with no manual trigger.
2. **Given** a change that fails any single gate, **When** the checks complete, **Then** the
   failure is reported and merging is blocked.
3. **Given** a change that passes every gate, **When** the checks complete, **Then** merging is
   permitted.
4. **Given** a push directly to the main branch, **When** it lands, **Then** the same gates run.
5. **Given** an environment that has never built this project before, **When** the checks run,
   **Then** they succeed without any manually pre-installed project tooling.

---

### User Story 3 - It leaves no trace on the machine (Priority: P3)

A developer finishes with the project and deletes the folder. Nothing about their machine has
changed: no tools left installed system-wide, no configuration written outside the project, no
version of anything silently upgraded.

**Why this priority**: Valuable and explicitly required, but the project is usable before it is
proven. It is placed last because verifying it properly means using a machine that has never seen
the project.

**Independent Test**: On a machine that has never built this project, record what exists outside
the project folder, build and test the project, delete the folder, and confirm nothing outside it
changed other than package caches.

**Acceptance Scenarios**:

1. **Given** a clean machine with only the documented prerequisites, **When** the project is
   installed, built, and tested, **Then** nothing is installed system-wide.
2. **Given** a completed build, **When** the project folder is deleted, **Then** nothing about the
   machine remains changed apart from package-manager caches.
3. **Given** an empty package cache, **When** the project is built, **Then** it still succeeds.

---

### Edge Cases

- A contributor whose default runtime version is newer or older than the project's pin.
- A contributor on a different operating system than the maintainer's.
- A completely cold dependency cache, with nothing pre-downloaded.
- A dependency publishing a new version between the moment the lockfile is committed and the
  moment continuous integration installs: the installed versions must not change.
- A developer who "fixes" a broken environment by installing something system-wide, making the
  project work on their machine and nowhere else.
- A test that passes locally and fails in continuous integration because of timezone, locale, or
  wall-clock differences.
- Automated formatting and automated linting disagreeing with each other, so that satisfying one
  breaks the other.
- Build output that quietly changes how a static host serves the application.
- A dependency whose license is outside the allowed set being introduced without anyone noticing.
- A quality gate that is slow enough that people start bypassing it.
- The declared runtime version drifting out of agreement between the places that declare it.

## Requirements *(mandatory)*

### Functional Requirements

**Starting the project**

- **FR-001**: Repository MUST contain everything needed to install, run, test, and build the
  application, other than the documented host prerequisites.
- **FR-002**: Host prerequisites MUST be limited to source control and a language runtime, and
  MUST be stated in the README.
- **FR-003**: A single documented command MUST install all project dependencies.
- **FR-004**: A single documented command MUST start the application locally in a browser.
- **FR-005**: Editing a source file MUST update the running application without a manual restart.
- **FR-006**: README MUST document every command a contributor needs, with no step discoverable
  only by reading source or configuration.

**Reproducible installs**

- **FR-007**: Exact dependency versions MUST be recorded in the repository and committed.
- **FR-008**: Installing MUST use those recorded versions rather than resolving fresh ones, so
  that two people installing on different days get identical dependency trees.
- **FR-009**: Installing into an empty environment from the recorded versions MUST succeed.

**Quality gates**

- **FR-010**: The project MUST provide four separately runnable gates: lint, typecheck, test, and
  build.
- **FR-010a**: Code formatting MUST be checkable as part of the lint gate, so that formatting drift
  fails continuous integration rather than accumulating silently.
- **FR-011**: Each gate MUST be a single command.
- **FR-012**: Every gate MUST pass on a fresh clone before any feature work begins.
- **FR-013**: Type checking MUST run in the strictest mode the language offers.
- **FR-014**: Tests MUST run without network access, and MUST NOT depend on wall-clock time,
  timezone, or locale.
- **FR-015**: The build gate MUST use the same command the production deployment will use.

**Continuous integration**

- **FR-016**: All four gates MUST run automatically on every pull request and on every push to the
  main branch, with no manual trigger.
- **FR-017**: Failure of any gate MUST block merging.
- **FR-018**: Continuous integration MUST install from the recorded versions, in a clean
  environment, with no pre-installed project tooling.
- **FR-019**: Continuous integration MUST run only on cost-free infrastructure available to a
  public repository.
- **FR-020**: A verdict MUST arrive quickly enough that contributors wait for it rather than route
  around it.

**Runtime version**

- **FR-021**: The project MUST declare one runtime version, and every place that declares it MUST
  agree.
- **FR-022**: A contributor MUST be able to adopt that version for this project without altering
  their machine's default.
- **FR-023**: Disagreement between the declared versions MUST be detectable rather than silently
  tolerated.

**Containment**

- **FR-024**: No part of installing, testing, or building the project may install anything
  system-wide.
- **FR-025**: One-off tools MUST be run without being permanently installed.
- **FR-026**: Nothing outside the project folder may be written to or depended upon, other than
  package-manager caches.
- **FR-027**: Deleting the project folder MUST leave nothing behind beyond those caches.

**Proving the pipes work**

- **FR-028**: The scaffold MUST contain enough working application code to demonstrate that each
  capability actually functions — that something renders, that navigation between addresses works,
  that a test runs and can fail, and that a build produces a working artifact.
- **FR-029**: That demonstration content MUST be recognizably temporary and MUST be removable
  without disturbing any configuration.
- **FR-030**: The scaffold MUST NOT implement any part of the flashcard feature.

**Build output**

- **FR-031**: The build MUST produce a self-contained directory that runs from any static file
  host, with no server-side execution.
- **FR-032**: Requesting a nested address directly — rather than reaching it by navigating inside
  the running application — MUST render that address rather than an error.
- **FR-033**: The build output MUST NOT contain files that change how a static host serves the
  application, since the deployment target's behavior depends on their absence.

**Dependency policy**

- **FR-034**: Every dependency's license MUST be recorded once a real dependency tree exists.
- **FR-035**: A dependency whose license falls outside the allowed set MUST stop the work and be
  raised, rather than being added and noted.

**Styling foundation**

- **FR-036**: The scaffold MUST establish the styling foundation and the component library's
  initialization — the shared configuration both depend on — while vendoring no actual components.
- **FR-037**: Adding a component from the library afterwards MUST require no configuration change,
  only the command that adds it.
- **FR-038**: The demonstration content MUST exercise the styling foundation enough to prove it is
  wired correctly, rather than leaving it configured but unproven.

**Repository**

- **FR-039**: The repository MUST carry an MIT license, since it is public and currently reserves
  all rights by default.
- **FR-040**: Blocking a failing change from merging MUST be enforced by the hosting platform's own
  controls, not by convention or reviewer memory.
- **FR-041**: That enforcement MUST NOT require an approving review from a second person, because
  a sole maintainer would have to bypass it on every merge, which converts the gate into a
  formality.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with only the documented prerequisites goes from clone to a rendered
  page in under 5 minutes and no more than 3 commands.
- **SC-002**: All four quality gates pass on a fresh clone, before any feature work is added.
- **SC-003**: Two developers installing on different days, weeks apart, get byte-identical
  dependency versions.
- **SC-004**: 100% of pull requests receive an automatic verdict with no manual trigger.
- **SC-005**: A change that breaks any single gate is blocked 100% of the time.
- **SC-006**: A verdict arrives in under 5 minutes.
- **SC-007**: Installing, testing, and building the project changes nothing outside the project
  folder except package-manager caches.
- **SC-008**: Deleting the project folder returns the machine to its prior state.
- **SC-009**: A build from a completely cold cache succeeds.
- **SC-010**: The declared runtime version is identical in 100% of the places that declare it.
- **SC-011**: Requesting a nested address directly renders that address, 0% error rate, verified
  against the built output rather than the development server.
- **SC-012**: The build output runs correctly when served by a plain static file server with no
  application logic.
- **SC-013**: Removing the temporary demonstration content requires no configuration change and
  leaves every gate passing.
- **SC-014**: 100% of dependencies have a recorded license drawn from the allowed set.
- **SC-015**: Continuous integration succeeds on infrastructure that has never built this project.
- **SC-016**: Adding a component from the component library requires 0 configuration changes.
- **SC-017**: The repository states terms under which its code may be reused.
- **SC-018**: A pull request with a failing gate cannot be merged, enforced by the platform rather
  than by the person clicking the button.

## Assumptions

- **Production deployment is out of scope for this feature.** Connecting the repository to a
  hosting provider, configuring the production build, and verifying a live deployment are
  deliberately deferred to their own feature. Decided 2026-08-22. The consequence is accepted
  explicitly: two risks stay unverified until then — whether direct addressing works on the real
  host, and whether the host can supply the pinned runtime version. This feature reduces both to
  configuration questions by making the build output correct in advance (FR-031, FR-032, FR-033).
- **Demonstration content is two throwaway addresses, not the flashcard screens.** Enough to prove
  navigation and direct addressing work, recognizably disposable, and deleted by 001. Chosen so
  that the routing capability is proven without this feature pre-building 001's navigation design.
- **Linting uses the tool the project's own framework ships by default.** Checked 2026-08-22
  rather than assumed: the framework's official starter template has moved to a single-binary
  linter, with its highest-value correctness rules enabled out of the box. That satisfies "best
  industry practice" and the minimal-dependency principle at the same time, which is why no
  separate justification is offered. The specific tool is named in this feature's implementation
  plan, not here.
- **The styling foundation and component-library initialization belong to this feature; components
  do not.** Decided 2026-08-22. Initialization rewrites shared build and type configuration, so
  doing it inside a product feature's pull request would mix scaffolding into product work. Actual
  components arrive with the screens that render them.
- **The repository is licensed MIT.** Decided 2026-08-22. It is the license the constitution's own
  dependency allowlist leads with, so the project and its dependencies sit under consistent terms.
- **Merge blocking is configured after this feature lands, not during it.** The hosting platform
  can only require a check that has already run at least once, so the enforcement in FR-040 is
  switched on once continuous integration has produced its first result.
- **The maintainer is the only contributor today.** "A contributor" in this document means any
  future one, including the maintainer on a different machine. No access control, code ownership,
  or review-assignment automation is implied.
- **A README is the documentation surface.** No documentation site, no architecture decision
  records, no contribution guide beyond what the README needs to carry.
- **Formatting and linting are separate tools.** Checked 2026-08-22: the linter chosen for this
  project does not format, so the earlier assumption that one tool would cover both was wrong.
  A dedicated formatter is used. Conflict risk is low rather than absent, because the linter's
  rules are correctness-focused rather than stylistic; where the two ever disagree, the formatter
  wins and the linter's stylistic rule is disabled.
- **Continuous integration runs on the version control host's own free tier**, since the
  repository is public.
- **No release process.** No versioning, changelog, tagging, or publishing. The application is
  deployed, not distributed.
- **Cross-platform support is best-effort.** The project should not gratuitously depend on one
  operating system, but only the maintainer's platform is verified.

## Out of Scope

Named so their absence is a decision rather than an oversight:

- Production hosting setup, preview deployments, and live verification — their own feature.
- Any part of the flashcard application: decks, runs, ladders, progress, storage.
- Vendored components from the component library. Its initialization is in scope (FR-036); the
  components themselves arrive with the screens that use them.
- End-to-end or browser-automation testing. The gates are lint, typecheck, unit test, build.
- Test coverage thresholds, performance budgets, and bundle-size limits.
- Dependency update automation, security scanning, and license-checking automation.
- Error reporting, analytics, and telemetry.
- Offline support and installability.
- Containers, virtual machines, and development environment images.
- Pre-commit hooks and other local automation that runs without being asked.
- Issue and pull request templates, labels, and project boards.
