const { createStore, applyMiddleware } = require("redux");
const thunk = require("redux-thunk").default;
const sinon = require("sinon");
const unexpected = require("unexpected");
const unexpectedSinon = require("unexpected-sinon");
const httpErrors = require("httperrors");

const Failraft = require("../lib/Failraft");

const createHandleError = require("../lib/handleError");

const expect = unexpected.clone().use(unexpectedSinon);

describe("handleError", () => {
  let options;
  let dispatch;
  let store;
  let handleError;

  beforeEach(() => {
    options = {
      determineErrorTags: error => [error.name],
      trackErrorEvent: sinon.stub().named("trackErrorEvent"),
      reportMissingHandler: sinon.stub().named("reportMissingHandler")
    };
    const intialState = {
      session: {
        username: "someone@example.com"
      }
    };
    store = createStore(state => state, intialState, applyMiddleware(thunk));
    dispatch = sinon.spy(store, "dispatch");

    handleError = createHandleError(options);
  });

  describe("with warnings", () => {
    it("should issue a warning event if a known failure was handled", () => {
      const failraft = new Failraft(
        { NotFound: () => ({ type: "@error/NOT_FOUND" }) },
        store
      );

      const error = new httpErrors.NotFound();
      dispatch(handleError(error, failraft));

      expect(
        options.trackErrorEvent,
        "to have a call exhaustively satisfying",
        [error, ["NotFound"], false]
      );
    });

    it("should issue a warning event even without additional tags", () => {
      const failraft = new Failraft(
        { NotFound: () => ({ type: "@error/NOT_FOUND" }) },
        store
      );

      const error = new httpErrors.NotFound();
      error.getTags = () => ["OtherTag"];
      dispatch(handleError(error, failraft));

      expect(
        options.trackErrorEvent,
        "to have a call exhaustively satisfying",
        [error, ["NotFound", "OtherTag"], false]
      );
    });

    it("should not report any handler missing", () => {
      const failraft = new Failraft(
        { NotFound: () => ({ type: "@error/NOT_FOUND" }) },
        store
      );
      const error = new httpErrors.NotFound();

      dispatch(handleError(error, failraft));

      expect(options.reportMissingHandler, "was not called");
    });
  });

  describe("with a missing handler", () => {
    it("should track an error error", () => {
      const error = new httpErrors.BadRequest();
      error.getTags = () => ["OtherTag"];

      const failraft = new Failraft({}, store);
      dispatch(handleError(error, failraft));

      expect(
        options.trackErrorEvent,
        "to have a call exhaustively satisfying",
        [error, ["BadRequest", "OtherTag", "MissingHandler"], true]
      );
    });

    it("should report a missing handler", () => {
      const error = new httpErrors.BadRequest();
      error.getTags = () => ["OtherTag"];

      const failraft = new Failraft({}, store);
      dispatch(handleError(error, failraft));

      expect(
        options.reportMissingHandler,
        "to have a call exhaustively satisfying",
        [
          expect.it("to be", error).and("not to have property", "getTags"),
          ["BadRequest", "OtherTag", "MissingHandler"]
        ]
      );
    });

    it("should always issue an event and crash report on an unknown failure", () => {
      const failraft = new Failraft(
        { "*": () => ({ type: "@error/CATCH_ALL" }) },
        store
      );
      handleError = createHandleError({
        ...options,
        determineErrorTags: () => ["UnknownFailure"]
      });

      const error = new Error();
      dispatch(handleError(error, failraft));

      expect(
        options.trackErrorEvent,
        "to have a call exhaustively satisfying",
        [error, ["UnknownFailure"], true]
      );

      expect(
        options.reportMissingHandler,
        "to have a call exhaustively satisfying",
        [
          expect.it("to be", error).and("not to have property", "getTags"),
          ["UnknownFailure"]
        ]
      );
    });

    it("should always issue an event and crash report on an abnormal failure", () => {
      const failraft = new Failraft(
        { "*": () => ({ type: "@error/CATCH_ALL" }) },
        store
      );
      handleError = createHandleError({
        ...options,
        determineErrorTags: error => [error.name, "AbnormalFailure"]
      });

      const error = new TypeError();
      dispatch(handleError(error, failraft));

      expect(
        options.trackErrorEvent,
        "to have a call exhaustively satisfying",
        [error, ["TypeError", "AbnormalFailure"], true]
      );

      expect(
        options.reportMissingHandler,
        "to have a call exhaustively satisfying",
        [expect.it("to be", error), ["TypeError", "AbnormalFailure"]]
      );
    });
  });

  describe("when extending handlers", () => {
    it("should allow them to be supplied as an argument to handleError", () => {
      const error = new httpErrors.NotFound();
      error.getTags = () => ["OtherTag"];

      const extendedHandlers = {
        OtherTag: () => ({ type: "@error/OTHER_TAG" })
      };

      const failraft = new Failraft({}, store);

      dispatch(handleError(error, failraft, extendedHandlers), "to be true");
    });

    it("should allow them to be supplied by a function on the error", () => {
      const error = new httpErrors.NotFound();
      error.getHandlers = () => extendedHandlers;
      error.getTags = () => ["OtherTag"];

      const extendedHandlers = {
        OtherTag: () => ({ type: "@error/OTHER_TAG" })
      };

      const failraft = new Failraft({}, store);

      dispatch(handleError(error, failraft), "to be true");
    });
  });
});
