const errorWasSeenSymbol = Symbol("errorWasSeen");

module.exports = (failraft, options) => store => {
  failraft.attachStore(store);

  function executeHandleError(error, additionalErrorHandlers) {
    // record that the errors were previously seen
    error[errorWasSeenSymbol] = true;

    failraft.consumeError(error, additionalErrorHandlers);
  }

  options = options || {};
  const idenfityErrorAction =
    typeof options.idenfityErrorAction === "function"
      ? options.idenfityErrorAction
      : action => !!action.errorAction;

  return next => action => {
    if (idenfityErrorAction(action)) {
      // ensure the error action reaches reducers that might act on it
      next(action);

      const { error } = action;

      if (!(error instanceof Error)) {
        throw new Error("Invalid error was dispatched.");
      }

      executeHandleError(error, action.additionalErrorHandlers);

      return null;
    }

    try {
      return next(action);
    } catch (err) {
      if (!err[errorWasSeenSymbol]) {
        executeHandleError(err, action.additionalErrorHandlers);
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
