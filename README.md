# Failraft

This module extends [`Failboat`](https://github.com/One-com/failboat) to
make it work in conjunction with redux.

Error handlers registered with Failraft are dispatched via the store to which
it is attached - this essentialy allows actions to be triggered in response
to error conditions in the application.

## Usage

Once imported the module is instantiated with an object consisting of handlers
to be executed when it consumes an error.

## Configuring error handlers

The handler object is keyed by strings that match any "tags" that are attached
to the error, while tagging itself is customisable by supplying a function that
can be used to decode the error and return an array of appropriate tags.

Let's look at an example:

```js
const Failraft = require("failraft");

const instanceOptions = {
  determineErrorTags: error => [error.name]
};

const instance = new Failraft({
  Error: error => ({ type: "WARNING_ACTION", payload: error.message }),
  SyntaxError: error => ({ type: "ALARM_ACTION", payload: error.message })
});
```

Here we configure Failraft to use the error name when looking up which
error handler to fire. If we have code that catches invalid JSON responses
from the server (a SyntaxError is typically thrown when parsing such data)
we can arrange two different messages to be shown in this case.

## Attaching a store

As you might have noticed, the handlers we declared above are actually redux
actions. In an appliction that uses redux, this is important because changes
in state are represented by actions and applied by reducers.

In order to "activate" the error handler, it must be linked to the application
redux store. There are two methods are provided for doing this:

### attachStore()

This hints the Failraft instance that actions should be dispatched via a
particular store:

```js
const redux = require("redux");
const store = redux.createStore(state => state, {});

new Failraft({
  /* error routes */
}).attachStore(store);
```

### createReduxMiddleware()

This method returns a middleware that is suitable for direct inclusion as
a middleware in the store:

```js
const failraftInstance = new Failraft({
  /* error routes */
});

const { createStore, applymiddleware } = require("redux");
const storeWithFailraftMiddleware = redux.createStore(
  state => state,
  {},
  applyMiddleware(failraftInstance.createReduxMiddleware())
);
```

The middleware watches actions passing through the store and any that are
idenfied as errors will be passed into Failraft for handling.

Currently, error actions can be of any type but the dispatched object must
have the following to properties:

- error: &lt;error object&gt;
- errorAction: true

In practice, that actions representing errors look something like:

```js
{ type: 'SOME_FAILURE', error: new Error(), errorAction: true }
```

If actions that count as errors have a different structure in your redux
store, the `identifyErrorAction` function can be supplied to the middleware
to customise this. The example below matches error actions by type name:

```js
{ type: '@ERROR/some_condition', error: new Error() }

const customMiddleware = new Failraft({
  /* error routes */
}).createReduxMiddleware({
  identifyErrorAction: action => action.type.startsWith('@ERROR/')
})
```

## Triggering errors

In order for an error error handled correctly we must provide Failraft with a
function that is able to decode an error to a set of "tags" that represent it
which are used to discover the correct handler. We do this by including the
`determineErrorTags` function in the second options argument.

As in our first example, in order to use the name of an error as a match against
handlers we would return it as follows:

```js
new Failraft(
  {
    /* error routes */
  },
  {
    determineErrorTags: error => [error.name]
  }
);
```

The only requirement placed on determineErrorTags() is that is returns an
array contain single strings that will be matched.

Error can be directly passed for handling by calling the `consumeError(error)`
method, attached to the Failraft instance, while users of the middleware will
have this automitically arranged for them.

### Extended error handlers

There are cases where, in a particular situation, some custom handling is
required - perhaps a message being shown that is specific for one portion
of the application.

This can be achieved by including additional error handlers on the action
being dispatched - the middleware will match these first and the handler
fired is successful. If none is found we fall back and attempt to find a
match in the globally registered handlers.

```js
const failureAction = error => ({
  type: "ACTION_TYPE_ON_ERROR",
  error,
  errorAction: true,
  additionalErrorHandlers: {
    Error: () => ({})
  }
});

storeWithFailraftMiddleware.dispatch(failureAction(new Error("some failure")));
```

## License

Failraft is licensed under a standard 3-clause BSD
license -- see the `LICENSE`-file for details.
