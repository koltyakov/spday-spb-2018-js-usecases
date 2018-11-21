# Workfront Proxy - Azure Functions

## Project prepare

### Prerequisites

* Node.js (ver. 8.*, 10.* or higher)
* NPM (ver. 6.* or higher)
* Azure Functions Core tools (ver. 1.*) for Node.js

```bash
npm i -g azure-functions-core-tools@1
```

### Dependencies

```bash
npm install
```

### Project build

```bash
npm run build
```

Build transpiles TypeScript into JavaScript and bundle the solution for optimal cold run as Azure Functions.

## Local development

### Environment variables

Setup actual variables in `./src/local.settings.json`.

### Project compile

```bash
npm run tsc
```

or:

```bash
npm run tsc -- -w
```

The second command compiles the project sources with watch mode.

### Start a local Azure emulator

```bash
func host start
```

## Publishing functions

* [Continuous deployment](https://docs.microsoft.com/en-us/azure/azure-functions/functions-continuous-deployment)
* [Zip deployment](https://docs.microsoft.com/en-us/azure/azure-functions/deployment-zip-push)
* Or using VSCode Azure extension

### Publishing using Azure Functions Core tools

```bash
npm run build # Build
func azure login # Login to Azure
func azure subscriptions list # Show available subscription
func azure subscriptions set c854bd7e-ad32-41a5-b562-6504d7ebe3c6 # Switch a subscription
func azure functionapp list # Show available function apps
cd ./build && func azure functionapp publish SPDay2018 && cd .. # Publish project
```

`SPDay2018` should be changed to actual Functions App name.

## Configuring Azure Functions App

### Azure configure: Environment variables

In `Application settings` section in Azure Function app, these environment variables are requires:

Name | Description
-----|------------
SPO_SITE_URL | SharePoint site URL
SPO_APP_CLIENT_ID | Add-In Client ID
SPO_APP_CLIENT_SECRET | Add-In Secret

### Azure configure: CORS

Use `*` or specify application URL strictly to enable CORS requests.