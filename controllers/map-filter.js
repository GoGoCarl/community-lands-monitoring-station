var settings = require('../helpers/settings')
var storage = require('../helpers/community-storage')

var fs = require('fs')
var path = require('path')
var moment = require('moment')

const FILTERS_FOLDER = settings.getFiltersDirectory()

var childProcess = require('child_process')
var phantom = require('phantomjs-prebuilt')
var urlUtil = require('url'),
  async = require('async')


function saveFilter (req, res, next) {
  var name = moment().format('YYYYMMDDHHmmss')
  var json = req.body
  fs.writeFile(path.join(FILTERS_FOLDER, name), JSON.stringify(json), function (err) {
    if (err) {
      res.json({error: true, code: 'save_failed', message: 'File did not save'})
    } else {
      screenshot(name);
      res.json({error: false, message: 'Save successful'})
    }
  })
}

function listFilters (req, res, next) {
  fs.readdir(FILTERS_FOLDER, function (err, files) {
    var names = []
    for (var index in files) {
      var location = path.join(FILTERS_FOLDER, files[index]);
      if (files[index].endsWith(".png"))
        continue;
      try {
        file = JSON.parse(fs.readFileSync(location, 'utf8'));
        date = fs.statSync(location).mtime;
        names.push({id: files[index], name: file.name, date: date});
      } catch (e) { }
    }
    names.sort(function(a, b) { return a.date.getTime() == b.date.getTime() ? 0 : a.date.getTime() < b.date.getTime() ? 1 : -1 });
    res.json({filters: names})
  })
}

function deleteFilter (req, res, next) {
  fs.unlink(path.join(FILTERS_FOLDER, req.params.id), function (err) {
    if (err)
      res.json({error: true, code: 'save_failed', message: 'File did not delete'});
    else
      res.json({error: false, message: 'Delete successful'});
  });
}

function config (req, res, next) {
  var data = {
    canSaveFilters: true,
    saveFilterTargets: [
      { name: 'Local', path: '/mapfilter/filters/local', value: 'local' }
    ],
    bingProxy: '/bing-proxy',
    bingMetadata: '/bing-metadata',
    tiles: {
      url: '/tileLayers',
      tilesPath: '/monitoring-files/Maps/Tiles'
    }
  };
  data['tracks'] = {
    url: '/tracks',
    soundsPath: '/sounds',
    iconPath: '/mapfilter'
  }
  if (process.env.mapLayer)
    data['baseLayer'] = process.env.mapLayer
  var mapFilterSettings = settings.getMapFilterSettings();
  if (mapFilterSettings.mapZoom) {
    try {
      data['mapZoom'] = parseInt(mapFilterSettings.mapZoom, 10)
    } catch (e) {}
  }
  if (mapFilterSettings.mapCenterLat) {
    try {
      data['mapCenterLat'] = parseFloat(mapFilterSettings.mapCenterLat)
    } catch (e) {}
  }
  if (mapFilterSettings.mapCenterLong) {
    try {
      data['mapCenterLong'] = parseFloat(mapFilterSettings.mapCenterLong)
    } catch (e) {}
  }
  var filter = req.query.filter
  if (filter) {
    var file = path.join(settings.getFiltersDirectory(), filter)
    fs.access(file, fs.F_OK | fs.R_OK, function (err) {
      if (err) {
        res.json(data)
      } else {
        fs.readFile(file, 'utf8', function (err, contents) {
          var filterJson = JSON.parse(contents)
          data['filters'] = filterJson.value
          if (filterJson.baseLayer)
            data['baseLayer'] = filterJson.baseLayer
          if (filterJson.zoom)
            data['mapZoom'] = filterJson.zoom
          if (filterJson.latitude)
            data['mapCenterLat'] = filterJson.latitude
          if (filterJson.longitude)
            data['mapCenterLong'] = filterJson.longitude
          data['dataUrl'] = '/mapfilter/json/mapfilter-locations.geojson?filter=' + filter
          res.json(data)
        })
      }
    })
  } else {
    res.json(data)
  }
}

function locations(req, res, next) {
  var filter = req.query.filter;
  if (filter) {
    var file = path.join(settings.getFiltersDirectory(), filter)
    fs.access(file, fs.F_OK | fs.R_OK, function (err) {
      if (err) {
        filterGeoJSON([], res);
      } else {
        fs.readFile(file, 'utf8', function (err2, contents) {
          if (err2)
            filterGeoJSON([], res);
          else {
            var filterJson = JSON.parse(contents)
            filterGeoJSON(filterJson.locations || [], res);
          }
        })
      }
    });
  } else
    filterGeoJSON([], res);
}

function filterGeoJSON(locations, res) {
  storage.getMap('Monitoring.geojson', function (err, data) {
    if (err) {
      res.status(500);
      res.render('error', {
        message: err.message,
        error: err
      });
    } else if (locations.length == 0) {
      res.json(JSON.parse(data).features);
    } else {
      res.json(JSON.parse(data).features.filter(function (value) {
        var allowed = true;
        if (value["type"] == 'Feature') {
          /*var coords = null; //lat, long
          if (value["geometry"] && value["geometry"]["type"] == 'Point') {
            //Transpose, as these are long/lat
            coords = [value.geometry.coordinates[1], value.geometry.coordinates[0]];
          } else if (value["properties"] && value["properties"]["location"]) {
            coords = [value.properties.location.latitude, value.properties.location.longitude];
          }

          allowed = hasLocation(locations, coords);*/

          if (value["properties"] && value["properties"]["meta"]) {
            allowed = locations.indexOf(value.properties.meta["instanceId"]) > -1;
          }
        }
        return allowed;
      }));
    }
  });
}

function hasLocation(locations, coords) {
  if (coords == null || coords.length != 2)
    return false;
  for (var i = 0; i < locations.length; i++) {
    var current = locations[i];
    if (current[0] == coords[0] && current[1] == coords[1])
      return true;
  }
  return false;
}

function exists(path) {
  try {
    fs.accessSync(path, fs.F_OK | fs.R_OK);
  } catch (err) {
    return false;
  }
  return true;
}

/*
 * Use the special screenshot version of MapFilter to capture the map
 */
function screenshot(name) {
  var fileUrl = settings.getBaseUrl() + "/mapfilter/screenshot.html?locale=" + settings.getLocale() + "&filter="+name;
  var capture_args = {
    out: path.join(FILTERS_FOLDER, name+".png"),
    phantomBin: phantom.path,
    format: "png"
  };
  try {
    capture([fileUrl], capture_args, function(err) {
      if (err)
        console.log("Failed to capture screenshot");
      else
        console.log("Saved screenshot for filter " + name);
    });
  } catch (e) {
    console.log(e);
  }
}

function capture(urls, options, callback) {

  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  options = options || {};

  var captureScript = path.join(path.dirname(__dirname), 'helpers', 'capture.js'),
      phantomPath = options.phantomBin,
      outPath = options.out,
      format = options.format,
      viewportWidth = options.viewportWidth || 1024,
      viewportHeight = options.viewportHeight || 768,
      paperOrientation = options.paperOrientation || "portrait",
      paperFormat = options.paperFormat || "A4",
      paperMargin = options.paperMargin || "2.5mm",
      username = options.username || false,
      password = options.password || false,
      verbose = options.verbose || false;

  // throttle phantom processes spawns to 10
  async.forEachLimit(urls, 10,

    // For each url
    function(url, done) {

      var urlParts = urlUtil.parse(url, true),
          filename = urlParts.pathname,
          auth = urlParts.auth;

      var cmdargs = [ "--debug=true" ]

      args = [cmdargs, captureScript, url, outPath, '--username', username,
        '--password', password, '--paper-orientation', paperOrientation,
        '--paper-margin', paperMargin, '--paper-format', paperFormat,
        '--viewport-width', viewportWidth, '--viewport-height', viewportHeight];

      //args = [captureScript, url, outPath]

      var phantom = childProcess.execFile(phantomPath, args, { maxBuffer: 1024*1000000 }, function(err, stdout, stderr) {
        if (verbose && stdout) console.log("---\nPhantomJS process stdout [%s]:\n" + stdout + "\n---", phantom.pid);
        if (verbose && stderr) console.log("---\nPhantomJS process stderr [%s]:\n" + stderr + "\n---", phantom.pid);
        if (verbose) console.log("Rendered %s to %s", url, outPath);
        done(err);
      });

      if (verbose)
        console.log("Spawning PhantomJS process [%s] to rasterize '%s' to '%s'", phantom.pid, url, outPath);
    },

    // Once all urls are processes
    function(err) {
      callback(err);
    });

}

module.exports = {
  listFilters: listFilters,
  saveFilter: saveFilter,
  deleteFilter: deleteFilter,
  config: config,
  locations: locations
}
