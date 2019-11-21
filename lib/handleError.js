const Failraft = require("./Failraft");

module.exports = function(options) {
  options = options || {};

  if (!(options.failraft instanceof Failraft)) {
    throw new Error("An instance of Failraft must be supplied.");
  }

  if (typeof options.determineErrorTags !== "function") {
    throw new Error('The "determineErrorTags" function must be supplied.');
  }

  const errorRouter = options.failraft;
  const determineErrorTags = options.determineErrorTags;
  const trackErrorEvent =
    typeof options.trackErrorEvent === "function"
      ? options.trackErrorEvent
      : () => {};
  const reportMissingHandler =
    typeof options.reportMissingHandler === "function"
      ? options.reportMissingHandler
      : () => {};

  const handleError = (error, additionalErrorHandlers = null) => {
    const tagsFromError = determineErrorTags(error);
    const tagsFromActions = error.getTags ? error.getTags() : [];
    const tags = [...tagsFromError, ...tagsFromActions];

    if (error.getTags) {
      delete error.getTags;
    }

    let errorHandler;
    if (additionalErrorHandlers !== null) {
      errorHandler = errorRouter.extend(additionalErrorHandlers);
    } else if (error.getHandlers) {
      errorHandler = errorRouter.extend(error.getHandlers());
    } else {
      errorHandler = errorRouter;
    }

    const wasHandled = errorHandler.routeError(tags, error);
    if (!wasHandled) {
      tags.push("MissingHandler");
    }

    const isError =
      !wasHandled ||
      tagsFromError.includes("AbnormalFailure") ||
      tagsFromError.includes("UnknownFailure");

    trackErrorEvent(error, tags, isError);

    if (isError) {
      reportMissingHandler(error, tags);
    }
  };

  return handleError;
};
