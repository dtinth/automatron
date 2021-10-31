# @dtinth/automatron-core

The core service of automatron. Provides:

- Chat bot interface (LINE, Slack)
- REST API interface
- Cron jobs

## secrets

The secret data required to run the automation are defined in [BotSecrets.ts](./src/BotSecrets.ts).

## development workflow

### developing

Watches for file changes and deploy the compiled code. Since it is my personal bot (I am the only one using it), I want a save-and-deploy workflow; there is no dev/staging environment at all.

```sh
node dev
```

### configuration

```sh
# download
gsutil cp gs://$GOOGLE_CLOUD_PROJECT-evalaas/evalaas/automatron.env automatron.env

# upload
gsutil cp automatron.env gs://$GOOGLE_CLOUD_PROJECT-evalaas/evalaas/automatron.env
```
