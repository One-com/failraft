const unexpected = require("unexpected");
const unexpectedSinon = require("unexpected-sinon");
const sinon = require("sinon");

const Failraft = require("../lib/Failraft");

const expect = unexpected.clone().use(unexpectedSinon);

describe("Failraft", () => {
  it("should error if no dispatch function was supplied", () => {
    return expect(
      () => {
        // eslint-disable-next-line no-new
        new Failraft({}, {});
      },
      "to throw",
      "Context did not contain a dispatch function."
    );
  });

  it("should report missing handlers", () => {
    const context = {
      dispatch: error => {
        expect(error, "to be", expectedError);
      }
    };
    sinon.spy(context, "dispatch");
    const expectedError = new Error("Any old error");

    const failraft = new Failraft(null, context);
    failraft.attachErrorRouted(error => error);

    return expect(() => {
      failraft.routeError(["AnError"], expectedError);
    }, "not to error").then(() => {
      expect(context.dispatch, "was called");
    });
  });

  it("should dispatch the identified handler", () => {
    const context = {
      dispatch: error => {
        expect(error, "to be", expectedError);
      }
    };
    const errorRoutes = {
      "*": sinon
        .stub()
        .named("handler")
        .returnsArg(0)
    };
    const expectedError = new Error("Any old error");

    const failraft = new Failraft(errorRoutes, context);

    return expect(() => {
      failraft.routeError(["AnError"], expectedError);
    }, "not to error").then(() => {
      expect(errorRoutes["*"], "to have a call satisfying", [expectedError]);
    });
  });

  it("should allow ignoring error handlers for dispatch the return falsy", () => {
    const context = {
      dispatch: arg => {
        expect(arg, "to be undefined");
      }
    };
    sinon.spy(context, "dispatch");
    const errorRoutes = {
      IgnoreMe: () => {}
    };
    const expectedError = new Error("Any old error");

    const failraft = new Failraft(errorRoutes, context);

    return expect(() => {
      failraft.routeError(["IgnoredError"], expectedError);
    }, "not to error").then(() => {
      expect(context.dispatch, "was not called");
    });
  });

  describe("with aliased errors", () => {
    it("should dispatch correctly with string aliases", () => {
      const context = {
        dispatch: error => {
          expect(error, "to be", "AN_ERROR");
        }
      };
      sinon.spy(context, "dispatch");
      const errorRoutes = {
        AnError: sinon
          .stub()
          .named("anErrorHandler")
          .returns("AN_ERROR"),
        OtherError: "AnError"
      };
      const expectedError = new Error("OtherError");

      const failraft = new Failraft(errorRoutes, context);

      return expect(() => {
        failraft.routeError(["OtherError"], expectedError);
      }, "not to error").then(() => {
        expect(errorRoutes.AnError, "to have a call satisfying", [
          expectedError
        ]);
      });
    });
  });

  describe("when extended", () => {
    it("should dispatch the identified handler", () => {
      const context = {
        dispatch: error => {
          expect(error, "to be", "SOMETHING_ELSE");
        }
      };
      sinon.spy(context, "dispatch");
      const errorRoutes = {
        "*": error => error
      };
      const errorRoutesExtension = {
        AnError: sinon
          .stub()
          .named("anErrorHandler")
          .returns("SOMETHING_ELSE")
      };

      const failraft = new Failraft(errorRoutes, context).extend(
        errorRoutesExtension
      );

      const expectedError = new Error("AnError");

      return expect(() => {
        failraft.routeError(["AnError"], expectedError);
      }, "not to error").then(() => {
        expect(errorRoutesExtension.AnError, "to have a call satisfying", [
          expectedError
        ]);
      });
    });
  });
});
