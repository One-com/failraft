const Failboat = require("failboat");

function wrapThunkFactory(thunkFactory) {
  return function(...args) {
    const thingToDispatch = thunkFactory(...args);
    if (!thingToDispatch) {
      // allow empty functions as a means to "ignore"
      return;
    }
    this.dispatch(thingToDispatch);
  };
}

function wrapRoutesForDispatch(routes) {
  const wrappedRoutes = {};
  for (const [route, thunkFactory] of Object.entries(routes)) {
    switch (typeof thunkFactory) {
      case "string":
        wrappedRoutes[route] = thunkFactory;
        break;
      case "function":
        wrappedRoutes[route] = wrapThunkFactory(thunkFactory);
        break;
      default:
        throw new Error("Invalid error handler.");
    }
  }
  return wrappedRoutes;
}

/**
 * Wrapper around Failboat for use with redux.
 */
module.exports = class Failraft extends Failboat {
  constructor(routes, store, parent) {
    if (typeof store.dispatch !== "function") {
      throw new Error("Context did not contain a dispatch function.");
    }

    super(routes, store, parent);

    this.routes = wrapRoutesForDispatch(this.routes);
  }

  get store() {
    return this._context;
  }

  attachErrorRouted(thunkFactory) {
    this.onErrorRouted = wrapThunkFactory(thunkFactory);
  }

  extend(routes) {
    return new Failraft(routes, this.store, this);
  }
};
