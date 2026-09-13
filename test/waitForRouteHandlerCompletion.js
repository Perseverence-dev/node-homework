/**
 * Run an Express route handler and wait until it sends a response
 * or calls next().
 *
 * func - Controller or middleware being tested.
 * req - Mock Express request.
 * res - Mock Express response.
 * Promise<Function> - The mocked next function.
 */
const waitForRouteHandlerCompletion = async (func, req, res) => {
  let next;

  // Wait until the handler sends a response or calls next().
  // The promise will resolve when the response is finished or next() is called.
  const completionPromise = new Promise((resolve, reject) => {
    // next(error) represents failure, while next() represents completion.
    // The next function is mocked to resolve or reject the promise.
    next = jest.fn((error) => {
      if (error) {
        return reject(error);
      }

      return resolve();
    });

    // json() and send() cause the response to emit a finish event.
    // The promise will resolve when the response is finished.
    res.on("finish", resolve);
  });

  // Run and await the asynchronous controller.
  // The controller may call next() or send a response, which will resolve the promise.
  await func(req, res, next);

  // Wait for either the response or next() to complete.
  // If the controller calls next(error), the promise will reject and throw an error.
  await completionPromise;

  return next;
};

module.exports = waitForRouteHandlerCompletion;