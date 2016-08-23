const delayms = 1;

function getCurrentCity(callback) {
  setTimeout(function () {

    const city = "New York, NY";
    callback(null, city);

  }, delayms)
}

function getWeather(city, callback) {
  setTimeout(function () {

    if (!city) {
      callback(new Error("City required to get weather"));
      return;
    }

    const weather = {
      temp: 50
    };

    callback(null, weather)

  }, delayms)
}

const expectedForcast = {
  fiveDay: [60, 70, 80, 45, 50]
};

function getForecast(city, callback) {
  setTimeout(function () {

    if (!city) {
      callback(new Error("City required to get forecast"));
      return;
    }

    const fiveDay = expectedForcast;

    callback(null, fiveDay)

  }, delayms)
}

suite.only("operations");



function fetchCurrentCity() {
  const operation = new Operation();

  getCurrentCity(operation.nodeCallback);
  return operation;
}

function fetchWeather(city) {
  const operation = new Operation();

  getWeather(city, operation.nodeCallback);
  return operation;
}

function fetchForecast(city) {
  const operation = new Operation();

  getForecast(city, operation.nodeCallback);
  return operation;
}

function Operation(executor){
  const operation = {
    successReactions: [],
    errorReactions: [],
  };

  operation.reject = function reject(error) {
    if(operation.resolved){
      return;
    }
    operation.resolved = true;
    internalReject(error);
  };
  operation.fail = operation.reject;

  function internalReject(error) {
    operation.state = 'failed';
    operation.error = error;
    operation.errorReactions.forEach(r => r(error));
  }

  function internalResolve(value) {
    // could be a promise or a result
    if(value && value.then){
      value.then(internalResolve, internalReject);
      return;
    }
    operation.state = 'succeeded';
    operation.result = value;
    operation.successReactions.forEach(r => r(value))
  }

  operation.resolve = function resolve(value) {
    if(operation.resolved){
      return;
    }
    operation.resolved = true;
    internalResolve(value);
  };

  operation.onCompletion = function setCallbacks(onSuccess, onError) {
    const proxyOp = new Operation();

    function successHandler() {
      doLater(function () {
        if(onSuccess) {
          let callbackResult;
          try {
            callbackResult = onSuccess(operation.result);
          } catch (e) {
            proxyOp.fail(e);
            return;
          } proxyOp.resolve(callbackResult);
        } else {
          proxyOp.resolve(operation.result);
        }
      });
    }

    function errorHandler() {
      doLater(function () {
        if(onError) {
          let callbackResult;
          try {
            callbackResult = onError(operation.error);
          } catch (e) {
            proxyOp.fail(e);
            return;
          }
          proxyOp.resolve(callbackResult);
        } else {
          proxyOp.fail(operation.error);
        }
      });
    }

    if(operation.state == "succeeded") {
      successHandler();
    } else if (operation.state == "failed") {
      errorHandler();
    } else {
      operation.successReactions.push(successHandler);
      operation.errorReactions.push(errorHandler);
    }

    return proxyOp;
  };
  operation.then = operation.onCompletion;

  operation.onFailure = function onFailure(onError) {
    return operation.then(null, onError);
  };
  operation.catch = operation.onFailure;

  operation.nodeCallback = function nodeCallback(error, result) {
    if (error) {
      operation.reject(error);
      return;
    }
    operation.resolve(result);
  };

  if(executor) {
    executor(operation.resolve, operation.reject);
  }

  return operation;
}

function doLater(func) {
  setTimeout(func, 1);
}

function fetchCurrentCityIndecisive() {
  const operation = new Operation();
  doLater(function () {
    operation.resolve("NYC");
    operation.resolve("Philly");
  });
  return operation;
}

function fetchCurrentCityRepeatedFailures() {
  const operation = new Operation();
  doLater(function () {
    operation.fail(new Error("Fail!"));
    operation.fail(new Error("Fail again!"));
  });
  return operation;
}

function fetchCurrentCityThatFails() {
  let operation = new Operation();
  doLater(() => operation.fail("GPS is Broken"));
  return operation;
}

// function fetchCurrentCity2(){
//   let operation = new Operation();
//   console.log("Getting city");
//   operation.succeed("New York, NY");
//   return operation;
// }

test("what is resolve?", function (done) {

  const fetchCurrentCity = new Operation();
  fetchCurrentCity.resolve("NYC");

  const fetchClone = new Operation();
  fetchClone.resolve(fetchCurrentCity);

  fetchClone.then(function (city) {
    expect(city).toBe("NYC");
    done();
  })
});

test("ensure success handlers are async", function (done) {
  let operation = new Operation(function executor(resolve, reject) {
    resolve("New York, NY");
  });
  operation.then(function (city) {
    doneAlias();
  });

  const doneAlias = done;
});

test("ensure error handlers are async", function (done) {
  let operation = new Operation(function executor(resolve, reject) {
    reject(new Error("oh noes!"));
  });
  operation.catch(function (error) {
    doneAlias();
  });

  const doneAlias = done;
});

// test("what does this print out?", function (done) {
//   let ui;
//
//   fetchCurrentCity2()
//     .then(function (city) {
//       ui = `You are from ${city}`;
//     })
//
//   ui = "loading...";
//
//   // assume we are a human looking at the screen 1sec later
//   setTimeout(function () {
//     expect(ui).toBe('You are from New York, NY');
//     done();
//   }, 1000);
// });

test("protect from doubling up on failures", function (done) {
  fetchCurrentCityRepeatedFailures()
    .catch(error => done())
});

test("protect from doubling up success", function (done) {
  fetchCurrentCityIndecisive()
    .then(e => done());
});

test("thrown error recovery", function () {
  return fetchCurrentCity()
    .then(function (city) {
      throw new Error("oh noes!");
      return fetchWeather(city);
    })
    .catch(e => console.log(e))
});

test("sync result transformation", function () {
  return fetchCurrentCity()
    .then(function (city) {
      return "10019";
    })
    .then(function (zip) {
      expect(zip).toBe("10019");
    })
});

test("async error recovery", function () {
  return fetchCurrentCityThatFails()
    .catch(function () {
      return fetchCurrentCity();
    })
    .then(function (city) {
      expect(city).toBe("New York, NY");
    })
});

test("sync error recovery", function (done) {
  fetchCurrentCityThatFails()
    .catch(function (error) {
      console.log(error);
      return "default city";
    })
    .then(function (city) {
      expect(city).toBe("default city");
      done();
    })
});

test("error, error recovery", function (done) {
  fetchCurrentCity()
    .then(function (city) {
      throw new Error("oh noes!");
      return fetchWeather(city);
    })
    .catch(function (error) {
      expect(error.message).toBe("oh noes!");
      throw new Error("Error from error handler, oh my!");
    })
    .catch(function (error) {
      expect(error.message).toBe("Error from error handler, oh my!");
      done();
    })
})

test("error recovery bypassed if not needed", function (done) {
  fetchCurrentCity()
    .catch(error => "default city")
    .then(function (city) {
      expect(city).toBe("New York, NY");
      done();
    });
});

test("allow errors to fall through", function (done) {
  fetchCurrentCityThatFails()
    .then(function (city) {
      console.log(city);
      return fetchForecast(city);
    })
    .then(function (forecast) {
      expect(forecast).toEqual(expectedForcast);
    })
    .catch(function (error) {
      done();
    })
});

test("reusing error handlers - errors anywhere!", function (done) {
  fetchCurrentCity()
    .then(function (city) {
      console.log(city);
      return fetchForecast();
    })
    .then(function (forecast) {
      expect(forecast).toBe(expectedForcast);
    })
    .catch(function (error) {
      done();
    })
})

test("life is full of async, nesting is inevitable, let's do something about it", function (done) {
  let weatherOp = fetchCurrentCity()
    .then(fetchWeather)
    .then(printTheWeather);

  function printTheWeather(weather) {
    console.log("weather >>> ", weather);
    done();
  }
});

test("lexical parallelism", function (done) {
  const city = "NYC"
  const weatherOp = fetchWeather(city);
  const forecastOp = fetchForecast(city);

  weatherOp.onCompletion(function(weather) {

    forecastOp.onCompletion(function (forecast) {
      console.log(`It is currently ${weather.temp} in ${city} with a five day forcast of ${forecast.fiveDay}`);
      done();
    });
  });

});

test("register error callback async", function (done) {
  const operationThatErrors = fetchWeather();

  doLater(function () {
    operationThatErrors.onFailure(() => done());
  })
});

test("register success callback async", function (done) {
  let operationsThatSucceeds = fetchCurrentCity();

  doLater(function () {
    operationsThatSucceeds.onCompletion(function (city) {
      fetchWeather(city);
      done();
    });
  });
});

test("noop if no success handler passed", function(done) {

  const operation = fetchCurrentCity();

  // noop should register for success handler
  operation.onFailure(error => done(error));

  // trigger success to make sure noop registered
  operation.onCompletion(result => done());
});

test("noop if no error handler passed", function(done) {

  const operation = fetchWeather();

  // noop should register for failure handler
  operation.onCompletion(result => done(new Error("shouldn't succeed")));

  // trigger failure to make sure noop registered
  operation.onFailure(error => done());
});

test("pass multiple callbacks - all of them are called", function(done) {

  const operation = fetchCurrentCity();

  const multiDone = callDone(done).afterTwoCalls();

  operation.onCompletion(result => multiDone());
  operation.onCompletion(result => multiDone());
});

test("fetchCurrentCity pass the callbacks later on", function(done) {

  // initiating operation
  const operation = fetchCurrentCity();

  // register callbacks
  operation.onCompletion(
    result => done(),
    error => done(error)
  );
});