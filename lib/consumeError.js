module.exports = function(options) {
  options = options || {};

  let determineErrorTagsFn = options.determineErrorTags;
  if (typeof determineErrorTagsFn !== "undefined") {
    if (typeof determineErrorTagsFn !== "function") {
      throw new Error('The "determineErrorTags" function must be supplied.');
    }
  } else {
    determineErrorTagsFn = () => [];
  }

  const errorRouter = options.failraft;
  const determineErrorTags = determineErrorTagsFn;
  const trackErrorEvent =
    typeof options.trackErrorEvent === "function"
      ? options.trackErrorEvent
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
    trackErrorEvent(error, tags, wasHandled);
  };

  return handleError;
};
