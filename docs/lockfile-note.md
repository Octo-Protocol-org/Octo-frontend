# Note to maintainers: lockfile guard

`package-lock.json` is already absent on `dev`, so there is nothing left to
remove for #625. This change adds the guard: `package-lock.json` and
`yarn.lock` are in `.gitignore`, and CI fails if either file exists.
