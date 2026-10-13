# GitHub write and deployment runbook

## Reliable routes

1. **Connected GitHub Contents API:** use `create_file` for new files and `update_file` with the latest blob SHA for existing files, explicitly targeting `main`. Each call makes a commit.
2. **Connected GitHub Git Data API:** fetch `main` head and its tree, create blobs/tree with `base_tree_sha`, create a commit with the old head as parent, then `update_ref` for `main` with `expected_sha` and `force:false`. This is the preferred atomic route for multi-file releases. A created blob or tree is not a published commit.
3. **Native `git` CLI:** only when the execution container has GitHub network access and credentials. This container currently fails DNS resolution for github.com; that does not prevent the connected GitHub API from writing.
4. **GitHub Actions:** for CI and deployment verification after the commit; an Actions success must be verified separately from Pages deployment.

## Release discipline

Only main. Increment app version and offline cache together. Re-read the branch head and changed files, inspect Actions results, and verify the live deployed interface. Never mark a library installed merely because its ZIP or Git blobs exist. On concurrent updates, re-fetch and reconcile rather than force push. Reuse existing connected GitHub authorisation; never copy server-side tokens into client code.
