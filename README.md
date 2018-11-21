# SharePoint Day 2018 - SharePoint JS API Consumption Examples

## Configuration

### Dependencies

```bash
npm install
```

### Artifacts

```bash
npm run pnp:deploy
```

### Connections

```bash
npm run connect
```

Provide environments parameters.

## Samples

### 01 Console

#### 01-rest

Copy script to Chrome SP Editor PnPjs console. `Ctrl+D` to execute.

#### 02-graph

Copy script to Chrome SP Editor PnPjs console. `Ctrl+D` to execute. A Modern page should be opened.

### 02 Node.js

#### 01-basic

Reuse `01 Basics` example in Node.js environment.

**Run:**

```bash
ts-node ./src/02-Advanced/01-basic
```

#### 02-multi-context

Orchestrates multiple environment contexts.

**Run:**

```bash
ts-node ./src/02-Advanced/02-multi-context
```

#### 03-batches

Batches usage in REST.

**Run:**

```bash
ts-node ./src/02-Advanced/03-batches
```

#### 04-system-update

System update like behavior using `validateUpdateListItem` method.

**Run:**

```bash
ts-node ./src/02-Advanced/04-system-update
```

### 03 SPFx

### 04 ADAL.js, CRA

### 05 Azure Functions

### 06 Electron