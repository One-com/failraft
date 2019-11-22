const unexpected = require("unexpected");
const unexpectedSinon = require("unexpected-sinon");
const sinon = require("sinon");

const Failraft = require("../lib/Failraft");

const expect = unexpected.clone().use(unexpectedSinon);

describe("Failraft", () => {
  it("should report missing handlers", () => {
    const expectedError = new Error("Any old error");

    const failraft = new Failraft();
    failraft.onErrorRouted = sinon.stub().named("onErrorRouted");

    return expect(() => {
      failraft.routeError(["AnError"], expectedError);
    }, "not to error").then(() => {
      expect(failraft.onErrorRouted, "was called");
    });
  });

  it("should dispatch the identified handler", () => {
    const errorRoutes = {
      "*": sinon
        .stub()
        .named("handler")
        .returnsArg(0)
    };
    const expectedError = new Error("Any old error");

    const failraft = new Failraft(errorRoutes);

    return expect(() => {
      failraft.routeError(["AnError"], expectedError);
    }, "not to error").then(() => {
      expect(errorRoutes["*"], "to have a call satisfying", [expectedError]);
    });
  });

  describe("with a store attached", () => {
    it("should throw on an invalid store", () => {
      expect(
        () => {
          new Failraft(null).attachStore(null);
        },
        "to throw",
        "Context did not contain a dispatch function."
      );
    });

    it("should throw on an attempt to attach a second time", () => {
      expect(
        () => {
          new Failraft(null)
            .attachStore({ dispatch: () => {} })
            .attachStore({ dispatch: () => {} });
        },
        "to throw",
        "Context already bound to a dispatch function."
      );
    });

    it("should allow ignoring error handlers if the handler returns falsy", () => {
      const context = {
        dispatch: sinon.stub().named("dispatch")
      };
      const errorRoutes = {
        IgnoreMe: () => null
      };
      const expectedError = new Error("Any old error");

      const failraft = new Failraft(errorRoutes);
      failraft.attachStore(context);

      return expect(() => {
        failraft.routeError(["IgnoreMe"], expectedError);
      }, "not to error").then(() => {
        expect(context.dispatch, "was not called");
      });
    });
  });

  describe("with aliased errors", () => {
    it("should route correctly with string aliases", () => {
      const errorRoutes = {
        AnError: sinon
          .stub()
          .named("anErrorHandler")
          .returns("AN_ERROR"),
        OtherError: "AnError"
      };
      const expectedError = new Error("OtherError");

      const failraft = new Failraft(errorRoutes);

      return expect(() => {
        failraft.routeError(["OtherError"], expectedError);
      }, "not to error").then(() => {
        expect(errorRoutes.AnError, "to have a call satisfying", [
          expectedError
        ]);
      });
    });

    it("should dispatch correctly with string aliases", () => {
      const context = {
        dispatch: sinon.stub().named("dispatch")
      };
      const errorRoutes = {
        AnError: sinon
          .stub()
          .named("anErrorHandler")
          .returns({ type: "@handler/AN_ERROR" }),
        OtherError: "AnError"
      };
      const expectedError = new Error("OtherError");

      const failraft = new Failraft(errorRoutes);
      failraft.attachStore(context);

      return expect(() => {
        failraft.routeError(["OtherError"], expectedError);
      }, "not to error").then(() => {
        expect(context.dispatch, "to have a call satisfying", [
          { type: "@handler/AN_ERROR" }
        ]);
      });
    });
  });

  describe("when extended", () => {
    it("should dispatch the identified handler", () => {
      const errorRoutes = {
        "*": error => error
      };
      const errorRoutesExtension = {
        AnError: sinon
          .stub()
          .named("anErrorHandler")
          .returns("SOMETHING_ELSE")
      };

      const failraft = new Failraft(errorRoutes).extend(errorRoutesExtension);

      const expectedError = new Error("AnError");

      return expect(() => {
        failraft.routeError(["AnError"], expectedError);
      }, "not to error").then(() => {
        expect(errorRoutesExtension.AnError, "to have a call satisfying", [
          expectedError
        ]);
      });
    });

    it("should attach a previously registered store", () => {
      const context = {
        dispatch: sinon.stub().named("dispatch")
      };
      const errorRoutes = {
        "*": error => error
      };
      const errorRoutesExtension = {
        AnError: () => ({ type: "@handler/MY_EXTENDED_HANDLER" })
      };

      const parent = new Failraft(errorRoutes);
      parent.attachStore(context);
      const failraft = parent.extend(errorRoutesExtension);

      const expectedError = new Error("AnError");

      return expect(() => {
        failraft.routeError(["AnError"], expectedError);
      }, "not to error").then(() => {
        expect(context.dispatch, "to have a call satisfying", [
          { type: "@handler/MY_EXTENDED_HANDLER" }
        ]);
      });
    });
  });

  describe("when creating a middleware", () => {
    it("should return a middleware", () => {
      const middleware = new Failraft().createReduxMiddleware();

      expect(middleware, "to be a function");
    });

    it("should throw a middleware was already created", () => {
      const failraft = new Failraft();
      expect(
        () => {
          failraft.createReduxMiddleware();
          failraft.createReduxMiddleware();
        },
        "to throw",
        "Cannot create multiple middleware instances."
      );
    });
  });
});
