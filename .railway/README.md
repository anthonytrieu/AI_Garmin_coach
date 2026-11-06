# GarminCoach infrastructure

Run `npm ci` at the repository root, then `npm run infra:plan` to review changes.
`npm run infra:apply` applies the reviewed configuration to the linked Railway project.
Link the GarminCoach production project and coach-api service before either command.

The configuration retains one service and its 500 MB volume mounted at `/data`.
Variables are unmanaged: configure secrets directly in Railway, never in this file.
Review every plan for volume deletion or replacement before applying it.
Source deployment is separate: `railway up` builds the root Dockerfile.
The deprecated railway.json configuration has been replaced by this configuration.
