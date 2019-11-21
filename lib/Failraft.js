const Failboat = require("failboat");
const createConsumeError = require("./consumeError");

function isStore(store) {
  return store && typeof store.dispatch === "function";
}

function wrapThunkFactory(thunkFactory, store) {
  return function(...args) {
    const thingToDispatch = thunkFactory(...args);
    if (!thingToDispatch) {
      // allow empty functions as a means to "ignore"
      return;
    }
    store.dispatch(thingToDispatch);
  };
}

function wrapRoutesForDispatch(routes, store) {
  const wrappedRoutes = {};
  for (const [route, thunkFactory] of Object.entries(routes)) {
    switch (typeof thunkFactory) {
      case "string":
        wrappedRoutes[route] = thunkFactory;
        break;
      case "function":
        wrappedRoutes[route] = wrapThunkFactory(thunkFactory, store);
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
  constructor(routes, options, parent) {
    super(routes, null, parent);

    if (parent && isStore(parent.store)) {
      this.attachStore(parent.store);
    }

    this.consumeOptions = options;
    this.consumeError = createConsumeError({ ...options, failraft: this });
  }

  get store() {
    return this._context;
  }

  attachStore(store) {
    if (!isStore(store)) {
      throw new Error("Context did not contain a dispatch function.");
    } else if (isStore(this.store)) {
      throw new Error("Context already bound to a dispatch function.");
    }

    this._context = store;

    this.routes = wrapRoutesForDispatch(this.routes, store);

    return this;
  }

  extend(routes) {
    return new Failraft(routes, this.options, this);
  }
};
