const { createStore, applyMiddleware } = require("redux");
const thunk = require("redux-thunk").default;
const sinon = require("sinon");
const unexpected = require("unexpected");
const unexpectedSinon = require("unexpected-sinon");
const httpErrors = require("httperrors");

const Failraft = require("../lib/Failraft");

const createConsumeError = require("../lib/consumeError");

const expect = unexpected.clone().use(unexpectedSinon);

describe("consumeError", () => {
  let options;
  let store;

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
  });

  it("should throw if determineErrorTags was not a function", () => {
    expect(
      () => {
        createConsumeError({ determineErrorTags: null });
      },
      "to throw",
      'The "determineErrorTags" function must be supplied.'
    );
  });

  describe("with warnings", () => {
    it("should issue a warning event if a known failure was handled", () => {
      const failraft = new Failraft(
        { NotFound: () => ({ type: "@error/NOT_FOUND" }) },
        store
      );
      const handleError = createConsumeError({ ...options, failraft });

      const error = new httpErrors.NotFound();
      handleError(error);

      expect(
        options.trackErrorEvent,
        "to have a call exhaustively satisfying",
        [error, ["NotFound"], true]
      );
    });

    it("should issue a warning event even without additional tags", () => {
      const failraft = new Failraft(
        { NotFound: () => ({ type: "@error/NOT_FOUND" }) },
        store
      );
      const handleError = createConsumeError({ ...options, failraft });

      const error = new httpErrors.NotFound();
      error.getTags = () => ["OtherTag"];
      handleError(error);

      expect(
        options.trackErrorEvent,
        "to have a call exhaustively satisfying",
        [error, ["NotFound", "OtherTag"], true]
      );
    });

    it("should not report the handler missing", () => {
      const failraft = new Failraft(
        { NotFound: () => ({ type: "@error/NOT_FOUND" }) },
        store
      );
      const handleError = createConsumeError({ ...options, failraft });

      const error = new httpErrors.NotFound();
      handleError(error);

      expect(options.trackErrorEvent, "to have a call satisfying", [
        error,
        expect.it("not to contain", "MissingHandler"),
        true
      ]);
    });
  });

  describe("with a missing handler", () => {
    it("should report the handler missing", () => {
      const failraft = new Failraft({}, store);
      const handleError = createConsumeError({ ...options, failraft });

      const error = new httpErrors.BadRequest();
      error.getTags = () => ["OtherTag"];
      handleError(error);

      expect(
        options.trackErrorEvent,
        "to have a call exhaustively satisfying",
        [
          expect.it("to be", error).and("not to have property", "getTags"),
          expect.it("to contain", "MissingHandler"),
          false
        ]
      );
    });
  });

  describe("when extending handlers", () => {
    it("should allow them to be supplied as an argument to handleError", () => {
      const failraft = new Failraft({}, store);
      const handleError = createConsumeError({
        ...options,
        failraft
      });

      const error = new httpErrors.NotFound();
      error.getTags = () => ["OtherTag"];
      const extendedHandlers = {
        OtherTag: sinon
          .stub()
          .named("OtherTag")
          .returns({ type: "@error/OTHER_TAG" })
      };

      handleError(error, extendedHandlers);

      expect(extendedHandlers.OtherTag, "was called");
    });

    it("should allow them to be supplied by a function on the error", () => {
      const failraft = new Failraft({}, store);
      const handleError = createConsumeError({
        ...options,
        failraft
      });

      const extendedHandlers = {
        OtherTag: sinon
          .stub()
          .named("OtherTag")
          .returns({ type: "@error/OTHER_TAG" })
      };
      const error = new httpErrors.NotFound();
      error.getHandlers = () => extendedHandlers;
      error.getTags = () => ["OtherTag"];

      handleError(error, extendedHandlers);

      expect(extendedHandlers.OtherTag, "was called");
    });
  });
});
