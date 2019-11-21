const { createStore, applyMiddleware } = require("redux");
const thunk = require("redux-thunk").default;
const sinon = require("sinon");
const unexpected = require("unexpected");
const unexpectedSinon = require("unexpected-sinon");

const Failraft = require("../lib/Failraft");
const errorHandlerMiddleware = require("../lib/reduxMiddleware");
const { errorWasSeenSymbol } = errorHandlerMiddleware;

const expect = unexpected.clone().use(unexpectedSinon);

const createErrorAction = type => error => ({ type, error, errorAction: true });

const createStoreWithMiddlewares = (...middlewares) => {
  return createStore(() => ({}), applyMiddleware(...middlewares));
};

describe("error handling middleware", () => {
  it("should pass standard actions on to further middleware", () => {
    const nextSpy = sinon.spy().named("next");

    const store = createStoreWithMiddlewares(
      errorHandlerMiddleware(new Failraft()),
      store => next => action => nextSpy(action)
    );

    store.dispatch({ type: "action/foo" });

    expect(nextSpy, "to have a call satisfying", [{ type: "action/foo" }]);
  });

  it("should allow error handlers to be specified on the action", () => {
    const error = new Error("HANDLE_ME_PLEASE");
    const throwingMiddleware = store => next => action => {
      throw error;
    };
    const store = createStoreWithMiddlewares(
      errorHandlerMiddleware(
        new Failraft(null, {
          determineErrorTags: error => [error.message]
        })
      ),
      thunk,
      throwingMiddleware
    );

    const handlerStub = sinon.stub();

    store.dispatch({
      type: "foo",
      additionalErrorHandlers: {
        HANDLE_ME_PLEASE: handlerStub
      }
    });

    expect(handlerStub, "to have a call satisfying", [error]);
  });

  describe("with a thunk", () => {
    it("should pass thunk actions on to further middleware", () => {
      const lastMiddlewareSpy = sinon.spy().named("next");

      const store = createStoreWithMiddlewares(
        errorHandlerMiddleware(new Failraft(), {
          determineErrorTags: error => [error.message]
        }),
        thunk,
        store => next => action => lastMiddlewareSpy(action)
      );

      store.dispatch((dispatch, getState) => {
        dispatch({ type: "action/foo" });
      });

      expect(lastMiddlewareSpy, "to have a call satisfying", [
        { type: "action/foo" }
      ]);
    });

    it("should handle a thrown error", () => {
      const handlerStub = sinon.stub();
      const error = new Error("THROWN_BAD_NEWS");
      const errorRoutes = {
        THROWN_BAD_NEWS: handlerStub
      };
      const store = createStoreWithMiddlewares(
        errorHandlerMiddleware(
          new Failraft(errorRoutes, {
            determineErrorTags: error => [error.message]
          })
        ),
        thunk
      );

      store.dispatch(() => {
        throw error;
      });

      expect(handlerStub, "to have a call satisfying", [error]);
    });
  });

  describe("with results provided via dispatch", () => {
    it("should return a resolved Promise", async () => {
      const store = createStoreWithMiddlewares(
        errorHandlerMiddleware(
          new Failraft(null, { determineErrorTags: error => [error.message] })
        ),
        thunk
      );

      const result = store.dispatch(() => {
        return Promise.resolve("success");
      });

      expect(result, "to be a", Promise);

      return expect(result, "to be fulfilled with", "success");
    });

    it("should return a rejected Promise", () => {
      const handlerStub = sinon.stub();
      const error = new Error("REJECTION");
      const errorRoutes = { REJECTION: () => handlerStub };
      const store = createStoreWithMiddlewares(
        errorHandlerMiddleware(
          new Failraft(errorRoutes, {
            determineErrorTags: error => [error.message]
          })
        ),
        thunk
      );
      const result = store.dispatch(() => {
        return Promise.reject(error);
      });

      expect(result, "to be a", Promise);

      return expect(result, "to be rejected with", error).then(() => {
        // NOTE this is the responsibility of the caller => unhandled
        expect(handlerStub, "was not called");
        expect(error[errorWasSeenSymbol], "to be falsy");
      });
    });
  });

  describe("with error actions", () => {
    it("should handle an error action directly", () => {
      const handlerStub = sinon.stub();
      const error = new Error("HANDLE_ME_PLEASE");
      const errorRoutes = { HANDLE_ME_PLEASE: () => handlerStub };

      const store = createStoreWithMiddlewares(
        errorHandlerMiddleware(
          new Failraft(errorRoutes, {
            determineErrorTags: error => [error.message]
          })
        ),
        thunk
      );

      const errorAction = createErrorAction("ACTION_ON_FAILURE");

      return expect(store.dispatch(errorAction(error)), "to be null").then(
        fulfilmentValue => {
          expect(error[errorWasSeenSymbol], "to be true");
          expect(handlerStub, "was called times", 1);
        }
      );
    });

    it("should handle an error from any action", () => {
      const trackErrorEvent = sinon.stub().named("trackErrorEvent");
      const store = createStoreWithMiddlewares(
        errorHandlerMiddleware(
          new Failraft(null, {
            determineErrorTags: error => [error.message],
            trackErrorEvent
          })
        ),
        thunk
      );

      const error = new TypeError();
      const typeErrorAction = () => (dispatch, getState) => {
        throw error;
      };

      return expect(store.dispatch(typeErrorAction()), "to be null").then(
        fulfilmentValue => {
          expect(error[errorWasSeenSymbol], "to be true");
          expect(trackErrorEvent, "was called");
        }
      );
    });

    it("should pass an error actions to the next middleware", () => {
      const error = new Error("ACTION_ON_FAILURE");
      const nextSpy = sinon.spy().named("next");

      const store = createStoreWithMiddlewares(
        errorHandlerMiddleware(
          new Failraft(null, { determineErrorTags: error => [error.message] })
        ),
        store => next => action => nextSpy(action)
      );

      const errorAction = createErrorAction("ACTION_ON_FAILURE");

      return expect(store.dispatch(errorAction(error)), "to be null").then(
        fulfilmentValue => {
          expect(error[errorWasSeenSymbol], "to be true");
          expect(nextSpy, "to have a call satisfying", [
            { type: "ACTION_ON_FAILURE", errorAction: true }
          ]);
        }
      );
    });

    it("should throw the error to the caller on an explicit rethrow", () => {
      const handlerStub = sinon.stub();
      const error = new Error("HANDLE_ME_PLEASE");
      const errorRoutes = { HANDLE_ME_PLEASE: () => handlerStub };

      const store = createStoreWithMiddlewares(
        errorHandlerMiddleware(
          new Failraft(errorRoutes, {
            determineErrorTags: error => [error.message]
          })
        ),
        thunk.withExtraArgument({ trackEvent: () => {} })
      );

      const errorAction = createErrorAction("ACTION_ON_FAILURE");

      const throwingAction = e => (dispatch, getState) => {
        dispatch(errorAction(e));
        throw e;
      };

      return expect(
        () => {
          // NOTE this is an explicit throw to ensure the caller is cancelled
          store.dispatch(throwingAction(error));
        },
        "to throw",
        error
      ).then(fulfilmentValue => {
        expect(error[errorWasSeenSymbol], "to be true");
        expect(handlerStub, "was called times", 1);
      });
    });
  });

  describe("when a reducer changes state based on an error", () => {
    it("should ensure error actions are applied to reducers", () => {
      const error = new Error("ACTION_ON_FAILURE");
      const reducerSpy = sinon
        .stub()
        .named("reducer")
        .returns({});

      const store = createStore(
        reducerSpy,
        applyMiddleware(
          errorHandlerMiddleware(
            new Failraft(null, { determineErrorTags: error => [error.message] })
          ),
          thunk.withExtraArgument({ trackEvent: () => {} })
        )
      );

      const errorAction = createErrorAction("ACTION_ON_FAILURE");

      return expect(store.dispatch(errorAction(error)), "to be null").then(
        fulfilmentValue => {
          expect(error[errorWasSeenSymbol], "to be true");
          expect(reducerSpy, "to have a call satisfying", [
            {},
            { type: "ACTION_ON_FAILURE", errorAction: true }
          ]);
        }
      );
    });
  });
});
