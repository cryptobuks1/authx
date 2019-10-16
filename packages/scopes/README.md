# Scopes

This is a small collection of utility functions for AuthX scopes. These scopes are human-readable, fully OAuth2-compatible, and support both pattern matching and set algebra.

---

[Anatomy of a Scope](#anatomy-of-a-scope) | [Installation](#installation) | [API](#api) | [Development](#development)

---

## Anatomy of a Scope

Scopes are composed of 3 domains, separated by the `:` character:

```
AuthX:role.abc:read
|___| |______| |__|
  |      |       |
realm  context  action

```

Each domain can contain segments, separated by the `.` character. Domain segments can be `/[a-zA-Z0-9_-]*/` strings or glob pattern identifiers `*` or `**`:

```
role.abc
role.*
**
```

## Installation

Install with `npm install --save @authx/scopes`

## API

Please see [the tests](src/index.test.ts) for complete examples.

### validate

- ```ts
  validate(scope: string): boolean`
  ```

Validate that a scope is correctly formatted.

```js
import { validate } from "@authx/scopes";

validate("realm:context.identifier:action.**");
// => true

validate("realm:context.***:action");
// => false
```

### normalize

- ```ts
  normalize(scope: string): string
  ```
- **_throws `InvalidScopeError` if the scope is invalid._**

Normalize a scope into its simplest representation.

```js
import { normalize } from "@authx/scopes";

normalize("realm:**.**:action");
// => 'realm:*.**:action'
```

### simplify

- ```ts
  simplify(collection: string[]): string[]
  ```
- **_throws `InvalidScopeError` if any scopes in `collection` are invalid._**

Simplify the collection of scopes in `collection` by omiting any scopes that are a made redundant by another scope in the collection. All scopes in the returned collection are normalized.

```js
import { simplify } from "@authx/scopes";

simplify(["realm:resource.*:action", "realm:**:action"]);
// => ["realm:**:action"]
```

### isEqual

- ```ts
  isEqual(scopeOrCollectionA: string[] | string, scopeOrCollectionB: string[] | string): boolean
  ```
- **_throws `InvalidScopeError` if any scopes in `scopeOrCollectionA` or `scopeOrCollectionB` are invalid._**

Check whether `scopeOrCollectionA` and `scopeOrCollectionB` are the same, ignoring redundant scopes.

```js
import { getIntersection } from "@authx/scopes";

getIntersection(["realm:**:*"], ["realm:**:action", "realm:**:*"]);
// => true
```

### isSuperset

- ```ts
  isSuperset(scopeOrCollectionA: string[] | string, scopeOrCollectionB: string[] | string): boolean
  ```
- **_throws `InvalidScopeError` if any scopes in `scopeOrCollectionA` or `scopeOrCollectionB` are invalid._**

Check whether `scopeOrCollectionA` is equal to, or a superset of `scopeOrCollectionB`. This is appropriate for checking if a user can perform a particular action.

```js
import { isSuperset } from "@authx/scopes";

isSuperset(["realm:**:*"], ["realm:**:action", "realm:**:*"]);
// => true
```

### isStrictSuperset

- ```ts
  isStrictSuperset(scopeOrCollectionA: string[] | string, scopeOrCollectionB: string[] | string): boolean
  ```
- **_throws `InvalidScopeError` if any scopes in `scopeOrCollectionA` or `scopeOrCollectionB` are invalid._**

Check whether `scopeOrCollectionA` is a strict superset of `scopeOrCollectionB`.

```js
import { isStrictSuperset } from "@authx/scopes";

isStrictSuperset(["realm:**:*"], ["realm:**:action", "realm:**:*"]);
// => false
```

### isSubset

- ```ts
  isSubset(scopeOrCollectionA: string[] | string, scopeOrCollectionB: string[] | string): boolean
  ```
- **_throws `InvalidScopeError` if any scopes in `scopeOrCollectionA` or `scopeOrCollectionB` are invalid._**

Check whether `scopeOrCollectionA` is equal to, or a subset of `scopeOrCollectionB`.

```js
import { isSubset } from "@authx/scopes";

isSubset(["realm:**:action", "realm:**:*"], ["realm:**:*"]);
// => true
```

### isStrictSubset

- ```ts
  isStrictSubset(scopeOrCollectionA: string[] | string, scopeOrCollectionB: string[] | string): boolean
  ```
- **_throws `InvalidScopeError` if any scopes in `scopeOrCollectionA` or `scopeOrCollectionB` are invalid._**

Check whether `scopeOrCollectionA` is a strict subset of `scopeOrCollectionB`.

```js
import { isStrictSubset } from "@authx/scopes";

isStrictSubset(["realm:**:action", "realm:**:*"], ["realm:**:*"]);
// => false
```

### getIntersection

- ```ts
  getIntersection(scopeOrCollectionA: string[] | string, scopeOrCollectionB: string[] | string): string[]
  ```
- **_throws `InvalidScopeError` if any scopes in `scopeOrCollectionA` or `scopeOrCollectionB` are invalid._**

Get the intersection of `scopeOrCollectionA` and `scopeOrCollectionB`, returning a collection of scopes that represent all intersections, or every ability common to both inputs.

```js
import { getIntersection } from "@authx/scopes";

getIntersection(["realm:resource.*:action.*"], ["realm:**:action.read"]);
// => ["realm:resource.*:action.read"]
```

### getDifference

- ```ts
  getDifference(collectionA: string[], collectionB: string[]): string[]
  ```
- **_throws `InvalidScopeError` if any scopes in `collectionA` or `collectionB` are invalid._**

Get the relative complement (or set difference) of `collectionA` and `collectionB`, returning a collection of scopes present in `collectionB` but NOT `collectionA`. The returned collection contains normalized scopes _as written in `collectionB`_, even if there is an intersection between the returned scope and `collectionA`.

```js
import { getDifference } from "@authx/scopes";

getDifference(
  ["realm:resource.*:action.*"],
  ["realm:resource.foo:action.read", "realm:other:action.read"]
);
// => ["realm:other:action.read"]
```

### hasIntersection

- ```ts
  hasIntersection(scopeOrCollectionA: string[] | string, scopeOrCollectionB: string[] | string): string[]
  ```
- **_throws `InvalidScopeError` if any scopes in `scopeOrCollectionA` or `scopeOrCollectionB` are invalid._**

Check whether `scopeOrCollectionA` and `scopeOrCollectionB` intersect. This is useful when checking if a user can perform any subset of the actions represented by the `subject` scope.

```js
import { hasIntersection } from "@authx/scopes";

hasIntersection(["realm:resource.*:action.*"], ["realm:**:action.read"]);
// => true
```

## Development

### Scripts

These scripts can be run using `npm run <script>` or `yarn <script>`.

#### `format`

Use prettier to format the code in this package.

#### `lint`

Check the contents of this package against prettier and eslint rules.

#### `prepare`

Build the files from `/src` to the `/dist` directory with optimizations.

#### `prepare:development`

Build the files from `/src` to the `/dist` directory, and re-build as changes are made to source files.

#### `test`

Run all tests from the `/dist` directory.

#### `test:development`

Run all tests from the `/dist` directory, and re-run a test when it changes.

### Files

#### [/src](src/)

This holds the source code for the library.

#### [/dist](dist/)

The compiled and bundled code ends up here for distribution. This is ignored by git.
