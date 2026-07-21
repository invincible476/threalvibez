# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListSurveys*](#listsurveys)
  - [*GetSurvey*](#getsurvey)
- [**Mutations**](#mutations)
  - [*CreateUser*](#createuser)
  - [*UpdateSurveyStatus*](#updatesurveystatus)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListSurveys
You can execute the `ListSurveys` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listSurveys(): QueryPromise<ListSurveysData, undefined>;

interface ListSurveysRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListSurveysData, undefined>;
}
export const listSurveysRef: ListSurveysRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listSurveys(dc: DataConnect): QueryPromise<ListSurveysData, undefined>;

interface ListSurveysRef {
  ...
  (dc: DataConnect): QueryRef<ListSurveysData, undefined>;
}
export const listSurveysRef: ListSurveysRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listSurveysRef:
```typescript
const name = listSurveysRef.operationName;
console.log(name);
```

### Variables
The `ListSurveys` query has no variables.
### Return Type
Recall that executing the `ListSurveys` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListSurveysData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListSurveysData {
  surveys: ({
    id: UUIDString;
    title: string;
    description?: string | null;
  } & Survey_Key)[];
}
```
### Using `ListSurveys`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listSurveys } from '@dataconnect/generated';


// Call the `listSurveys()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listSurveys();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listSurveys(dataConnect);

console.log(data.surveys);

// Or, you can use the `Promise` API.
listSurveys().then((response) => {
  const data = response.data;
  console.log(data.surveys);
});
```

### Using `ListSurveys`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listSurveysRef } from '@dataconnect/generated';


// Call the `listSurveysRef()` function to get a reference to the query.
const ref = listSurveysRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listSurveysRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.surveys);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.surveys);
});
```

## GetSurvey
You can execute the `GetSurvey` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getSurvey(): QueryPromise<GetSurveyData, undefined>;

interface GetSurveyRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetSurveyData, undefined>;
}
export const getSurveyRef: GetSurveyRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSurvey(dc: DataConnect): QueryPromise<GetSurveyData, undefined>;

interface GetSurveyRef {
  ...
  (dc: DataConnect): QueryRef<GetSurveyData, undefined>;
}
export const getSurveyRef: GetSurveyRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getSurveyRef:
```typescript
const name = getSurveyRef.operationName;
console.log(name);
```

### Variables
The `GetSurvey` query has no variables.
### Return Type
Recall that executing the `GetSurvey` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetSurveyData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetSurveyData {
  survey?: {
    id: UUIDString;
    title: string;
    description?: string | null;
    questions_on_survey: ({
      id: UUIDString;
      text: string;
      order: number;
    } & Question_Key)[];
  } & Survey_Key;
}
```
### Using `GetSurvey`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getSurvey } from '@dataconnect/generated';


// Call the `getSurvey()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getSurvey();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getSurvey(dataConnect);

console.log(data.survey);

// Or, you can use the `Promise` API.
getSurvey().then((response) => {
  const data = response.data;
  console.log(data.survey);
});
```

### Using `GetSurvey`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getSurveyRef } from '@dataconnect/generated';


// Call the `getSurveyRef()` function to get a reference to the query.
const ref = getSurveyRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getSurveyRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.survey);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.survey);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateUser
You can execute the `CreateUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createUser(): MutationPromise<CreateUserData, undefined>;

interface CreateUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<CreateUserData, undefined>;
}
export const createUserRef: CreateUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createUser(dc: DataConnect): MutationPromise<CreateUserData, undefined>;

interface CreateUserRef {
  ...
  (dc: DataConnect): MutationRef<CreateUserData, undefined>;
}
export const createUserRef: CreateUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createUserRef:
```typescript
const name = createUserRef.operationName;
console.log(name);
```

### Variables
The `CreateUser` mutation has no variables.
### Return Type
Recall that executing the `CreateUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateUserData {
  user_insert: User_Key;
}
```
### Using `CreateUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createUser } from '@dataconnect/generated';


// Call the `createUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createUser();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createUser(dataConnect);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
createUser().then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

### Using `CreateUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createUserRef } from '@dataconnect/generated';


// Call the `createUserRef()` function to get a reference to the mutation.
const ref = createUserRef();

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createUserRef(dataConnect);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

## UpdateSurveyStatus
You can execute the `UpdateSurveyStatus` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateSurveyStatus(): MutationPromise<UpdateSurveyStatusData, undefined>;

interface UpdateSurveyStatusRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<UpdateSurveyStatusData, undefined>;
}
export const updateSurveyStatusRef: UpdateSurveyStatusRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateSurveyStatus(dc: DataConnect): MutationPromise<UpdateSurveyStatusData, undefined>;

interface UpdateSurveyStatusRef {
  ...
  (dc: DataConnect): MutationRef<UpdateSurveyStatusData, undefined>;
}
export const updateSurveyStatusRef: UpdateSurveyStatusRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateSurveyStatusRef:
```typescript
const name = updateSurveyStatusRef.operationName;
console.log(name);
```

### Variables
The `UpdateSurveyStatus` mutation has no variables.
### Return Type
Recall that executing the `UpdateSurveyStatus` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateSurveyStatusData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateSurveyStatusData {
  survey_update?: Survey_Key | null;
}
```
### Using `UpdateSurveyStatus`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateSurveyStatus } from '@dataconnect/generated';


// Call the `updateSurveyStatus()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateSurveyStatus();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateSurveyStatus(dataConnect);

console.log(data.survey_update);

// Or, you can use the `Promise` API.
updateSurveyStatus().then((response) => {
  const data = response.data;
  console.log(data.survey_update);
});
```

### Using `UpdateSurveyStatus`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateSurveyStatusRef } from '@dataconnect/generated';


// Call the `updateSurveyStatusRef()` function to get a reference to the mutation.
const ref = updateSurveyStatusRef();

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateSurveyStatusRef(dataConnect);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.survey_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.survey_update);
});
```

