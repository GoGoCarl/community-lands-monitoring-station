/*
 * Baseline testing utility for making screenshots, strips away all the
 * complexities.
 *
 * Replace URL below with the URL to screenshot. TODO: make this a system input param
 */

// Change this URL to something.
var URL = 'http://192.168.2.9:4444/mapfilter/screenshot.html?locale=en';

// Amount of time to wait AFTER the page says it has loaded to take screenshot
var SCREENSHOT_DELAY = 250;

var mapLoaded = false;

var waitFor = function (testFx, onReady, timeOutMillis) {
  var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 10000, //< Default Max Timout is 3s
    start = new Date().getTime(),
    condition = false,
    interval = setInterval(function() {
        if ( (new Date().getTime() - start < maxtimeOutMillis) && !condition ) {
            // If not time-out yet and condition not yet fulfilled
            condition = (typeof(testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
        } else {
            if(!condition) {
                // If condition still not fulfilled (timeout but condition is 'false')
                console.log("'waitFor()' timeout");
                phantom.exit(1);
            } else {
                // Condition fulfilled (timeout and/or condition is 'true')
                console.log("'waitFor()' finished in " + (new Date().getTime() - start) + "ms.");
                typeof(onReady) === "string" ? eval(onReady) : onReady(); //< Do what it's supposed to do once the condition is fulfilled
                clearInterval(interval); //< Stop this interval
            }
        }
    }, 250); //< repeat check every 250ms
};

var printArgs = function() {
    var i, ilen;
    for (i = 0, ilen = arguments.length; i < ilen; ++i) {
        console.log("    arguments[" + i + "] = " + JSON.stringify(arguments[i]));
    }
    console.log("");
}

var page = require('webpage').create();
page.onConsoleMessage = function(msg) {
  console.log("CONSOLE: " + msg);
};
page.viewportSize = { width: 1024, height: 768 };

page.open(URL, function(status) {
  if (status !== "success") {
    console.log("Unable to access network for " + URL + ": " + status);
    phantom.exit(1);
  } else {
    waitFor(function() {
        return page.evaluate(function() {
          var ready = window.app.mapPane.isLoaded();
          console.log(" --- CHECK WINDOW SCREENSHOT?? " + ready);
          if (ready)
            return true;
          else
            return false;
        });
      }, function() {
        console.log("Page LOADED, screenshotting...");
        setTimeout(function() {
          page.render('output.png');
          phantom.exit();
        }, SCREENSHOT_DELAY);
      });
  }
});
