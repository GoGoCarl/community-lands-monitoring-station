/*!
 * Capture - simple screenshot tool using PhantomJS
 * Copyright(c) 2013 Mike Moulton <mike@meltmedia.com>
 * MIT Licensed
 *
 * PhantomJS script for captureing a screenshot of a single URL
 * Waits for all resources to load on the page before attempting the capture
 *
 * CS: Added total resource count check, verify screenshot available
 */

var page = require('webpage').create(),
    system = require('system'),
    auth, address, output, resources = {};

var TIMEOUT = 60000,
    RESOURCE_LOAD_WINDOW = 5,
    RESOURCE_CHECK_SLEEP = 2000;

var TOTAL_RESOURCES = 0;

// Remove the path to the script from the arguments if it's included
var mutableArgs = JSON.parse(JSON.stringify(system.args))
if (mutableArgs[0].indexOf('capture.js') >= 0) {
  mutableArgs.shift();
}

if (mutableArgs.length <= 2 || mutableArgs.length % 2 !== 0) {
  phantom.exit(1);
}

// Processes the arguments and set them up for Phantom
options = argsToObject(mutableArgs);
address = options.address;
output = options.output;
//page.settings.userName = options.username || '';
//page.settings.password = options.password || '';

page.settings.userAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36'
page.settings.webSecurityEnabled = false
page.settings.ignoreSslErrors = true

page.viewportSize = {
    width: options.viewportWidth || 2000,
    height: options.viewportHeight || 600,
  };

page.paperSize = {
  format: options.paperFormat || 'A4',
  orientation: options.paperOrientation || 'portrait',
  margin: options.paperMargin || '2.5mm'
};

// handle resource loads, tracking each outstanding request
page.onResourceRequested = function (req) {
  // Match only http(s) protocols
  if (req.url.match(/^http(s)?:\/\//i)) {
    resources[req.id] = true;
  }
};

// handle resource load completions, marking the resource as received
page.onResourceReceived = function (res) {
  if (resources[res.id]) {
    TOTAL_RESOURCES++;
    delete resources[res.id];
  }
};

page.onConsoleMessage = function(msg, lineNum, sourceId) {
  // console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
};

// open the page
page.open(address, function (status) {

  var elapsedSinceLastResource = 0;

  // fail fast if their was an error loading the initial page
  if (status !== 'success') {
    console.log('Unable to load the address: ' + address);
    phantom.exit();
  }

  var capturePage = function () {

    window.setTimeout(function () {
      // no resources currently pending, might be ready to capture
      if (TOTAL_RESOURCES > 0 && Object.keys(resources).length == 0) {
        // no pending resources and waiting period has expired
        // so we can assume page is ready to be captured
        if (elapsedSinceLastResource >= RESOURCE_LOAD_WINDOW) {
          var screenshotAvailable = false, attempts = 0;
          var interval = setInterval(function() {
            attempts++;
            screenshotAvailable = page.evaluate(function() {
              // FIXME: this is specific to mapfilter
              if (window.app.mapPane.isLoaded())
                return true;
              else
                return false;
            })
            if (screenshotAvailable || attempts > 120) {
              clearInterval(interval);
              if (screenshotAvailable)
                page.render(output);
              phantom.exit();
            }
          }, 1000);
        // no pending resources, but still in waiting period
        } else {
          elapsedSinceLastResource += RESOURCE_CHECK_SLEEP;
        }

      // their are pending resources, not in waiting period
      } else {
        elapsedSinceLastResource = 0;
      }

      // we did not capture this iteration, sleep
      capturePage();

    }, RESOURCE_CHECK_SLEEP);
  };

  // set failsafe incase of failed resource load, 404, slow pages, etc.
  window.setTimeout(function () {
    console.log('Timeout loading: ' + address);
    phantom.exit();
  }, TIMEOUT);

  // capture the screenshot
  capturePage();

});

function takeScreenshot(page, output, phantom) {
  page.render(output);
  phantom.exit();
}

/**
 * Transform an array to an object literal
 * @param {Array} args Array with seperate arguments
 * @return {Object}
 */
function argsToObject(args) {
  var options = {};
  options.address = args.shift();
  options.output = args.shift();

  // Pair two arguments, while transforming the key to camelCase
  for (i = 0; i < args.length; i = i + 2) {
    options[toCamelCase(args[i].substr(2))] = args[i + 1];
  }

  return options;
}


/**
 * Take a hypen seperated string and turn it into camel case
 * @param {String} str The input string
 * @return {String}
 */
function toCamelCase(str) {
  return str.replace(/-([a-z])/g, function (match) {
    return match[1].toUpperCase()
  });
}
