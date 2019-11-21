const Failraft = require("./Failraft");
const createHandleError = require("./handleError");

const errorWasSeenSymbol = Symbol("errorWasSeen");

module.exports = (errorRoutes, config = {}) => store => {
  const failraft = new Failraft(errorRoutes, store);
  const handleError = createHandleError({ ...config, failraft });

  function executeHandleError(error, additionalErrorHandlers) {
    // record that the errors were previously seen
    error[errorWasSeenSymbol] = true;

    if (config.environment !== "production") {
      console.error(error);
    }

    handleError(error, additionalErrorHandlers)(store.dispatch, store.getState);
  }

  return next => action => {
    if (action.errorAction) {
      // ensure the error action reaches reducers that might act on it
      next(action);

      const { error } = action;

      if (!(error instanceof Error)) {
        throw new Error("Invalid error was dispatched.");
      }

      executeHandleError(error, action.additionalErrorHandlers, store);

      return null;
    }

    try {
      return next(action);
    } catch (err) {
      if (!err[errorWasSeenSymbol]) {
        executeHandleError(err, action.additionalErrorHandlers, store);
      } else {
        // if the error was marked as already dispatched
        // this must be en explicit rethrow situation..
        throw err;
      }

      return null;
    }
  };
};

module.exports.errorWasSeenSymbol = errorWasSeenSymbol;
