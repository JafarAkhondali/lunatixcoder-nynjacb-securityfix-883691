/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/*jshint scripturl:true */
(function () {

  var defaultConfiguration = {
    // Disables clicks for a certain element.
    // (e.g., 'canvas' would not show clicks on canvas elements.)
    // Setting this to true will disable clicks globally.
    dontShowClicks: false,
    // Experimental feature to echo clicks to certain elements across clients:
    cloneClicks: false,
    // Enable Mozilla or Google analytics on the page when NynjaCB is activated:
    // FIXME: these don't seem to be working, and probably should be removed in favor
    // of the hub analytics
    enableAnalytics: false,
    // The code to enable (this is defaulting to a Mozilla code):
    analyticsCode: "UA-35433268-28",
    // The base URL of the hub (gets filled in below):
    hubBase: null,
    // A function that will return the name of the user:
    getUserName: null,
    // A function that will return the color of the user:
    getUserColor: null,
    // A function that will return the avatar of the user:
    getUserAvatar: null,
    // The siteName is used in the walkthrough (defaults to document.title):
    siteName: null,
    // Whether to use the minimized version of the code (overriding the built setting)
    useMinimizedCode: undefined,
    // Append cache-busting queries (useful for development!)
    cacheBust: true,
    // Any events to bind to
    on: {},
    // Hub events to bind to
    hub_on: {},
    // Enables the alt-T alt-T NynjaCB shortcut; however, this setting
    // must be enabled early as NynjaCBConfig_enableShortcut = true;
    enableShortcut: false,
    // The name of this tool as provided to users.  The UI is updated to use this.
    // Because of how it is used in text it should be a proper noun, e.g.,
    // "MySite's Collaboration Tool"
    toolName: null,
    // Used to auto-start NynjaCB with a {prefix: pageName, max: participants}
    // Also with findRoom: "roomName" it will connect to the given room name
    findRoom: null,
    // If true, starts NynjaCB automatically (of course!)
    autoStart: false,
    // If true, then the "Join NynjaCB Session?" confirmation dialog
    // won't come up
    suppressJoinConfirmation: false,
    // If true, then the "Invite a friend" window won't automatically come up
    suppressInvite: false,
    // A room in which to find people to invite to this session,
    inviteFromRoom: null,
    // This is used to keep sessions from crossing over on the same
    // domain, if for some reason you want sessions that are limited
    // to only a portion of the domain:
    storagePrefix: "nynjacb",
    // When true, we treat the entire URL, including the hash, as the identifier
    // of the page; i.e., if you one person is on `http://example.com/#view1`
    // and another person is at `http://example.com/#view2` then these two people
    // are considered to be at completely different URLs
    includeHashInUrl: false,
    // When true, the WebRTC-based mic/chat will be disabled
    disableWebRTC: false,
    // When true, youTube videos will synchronize
    youtube: true,
    // Ignores the following console messages, disables all messages if set to true
    ignoreMessages: ["cursor-update", "keydown", "scroll-update"],
    // Ignores the following forms (will ignore all forms if set to true):
    ignoreForms: [":password"],
    // When undefined, attempts to use the browser's language
    lang: undefined,
    fallbackLang: "en-US"
  };

  var styleSheet = "/nynjacb/nynjacb.css";

  var baseUrl = "";
  if (baseUrl == "__" + "baseUrl__") {
    // Reset the variable if it doesn't get substituted
    baseUrl = "";
  }
  // Allow override of baseUrl (this is done separately because it needs
  // to be done very early)
  if (window.NynjaCBConfig && window.NynjaCBConfig.baseUrl) {
    baseUrl = window.NynjaCBConfig.baseUrl;
  }
  if (window.NynjaCBConfig_baseUrl) {
    baseUrl = window.NynjaCBConfig_baseUrl;
  }
  defaultConfiguration.baseUrl = baseUrl;

  // True if this file should use minimized sub-resources:
  var min = "yes" == "__" + "min__" ? false : "yes" == "yes";

  var baseUrlOverride = localStorage.getItem("nynjacb.baseUrlOverride");
  if (baseUrlOverride) {
    try {
      baseUrlOverride = JSON.parse(baseUrlOverride);
    } catch (e) {
      baseUrlOverride = null;
    }
    if ((! baseUrlOverride) || baseUrlOverride.expiresAt < Date.now()) {
      // Ignore because it has expired
      localStorage.removeItem("nynjacb.baseUrlOverride");
    } else {
      baseUrl = baseUrlOverride.baseUrl;
      var logger = console.warn || console.log;
      logger.call(console, "Using NynjaCB baseUrlOverride:", baseUrl);
      logger.call(console, "To undo run: localStorage.removeItem('nynjacb.baseUrlOverride')");
    }
  }

  var configOverride = localStorage.getItem("nynjacb.configOverride");
  if (configOverride) {
    try {
      configOverride = JSON.parse(configOverride);
    } catch (e) {
      configOverride = null;
    }
    if ((! configOverride) || configOverride.expiresAt < Date.now()) {
      localStorage.removeItem("nynjacb.configOverride");
    } else {
      var shownAny = false;
      for (var attr in configOverride) {
        if (! configOverride.hasOwnProperty(attr)) {
          continue;
        }
        if (attr == "expiresAt" || ! configOverride.hasOwnProperty(attr)) {
          continue;
        }
        if (! shownAny) {
          console.warn("Using NynjaCB configOverride");
          console.warn("To undo run: localStorage.removeItem('nynjacb.configOverride')");
        }
        window["NynjaCBConfig_" + attr] = configOverride[attr];
        console.log("Config override:", attr, "=", configOverride[attr]);
      }
    }
  }

  var version = "unknown";
  // FIXME: we could/should use a version from the checkout, at least
  // for production
  var cacheBust = "";
  if ((! cacheBust) || cacheBust == "") {
    cacheBust = Date.now() + "";
  } else {
    version = cacheBust;
  }

  // Make sure we have all of the console.* methods:
  if (typeof console == "undefined") {
    console = {};
  }
  if (! console.log) {
    console.log = function () {};
  }
  ["debug", "info", "warn", "error"].forEach(function (method) {
    if (! console[method]) {
      console[method] = console.log;
    }
  });

  if (! baseUrl) {
    var scripts = document.getElementsByTagName("script");
    for (var i=0; i<scripts.length; i++) {
      var src = scripts[i].src;
      if (src && src.search(/nynjacb(-min)?.js(\?.*)?$/) !== -1) {
        baseUrl = src.replace(/\/*nynjacb(-min)?.js(\?.*)?$/, "");
        console.warn("Detected baseUrl as", baseUrl);
        break;
      } else if (src && src.search(/nynjacb-min.js(\?.*)?$/) !== -1) {
        baseUrl = src.replace(/\/*nynjacb-min.js(\?.*)?$/, "");
        console.warn("Detected baseUrl as", baseUrl);
        break;
      }
    }
  }
  if (! baseUrl) {
    console.warn("Could not determine NynjaCB's baseUrl (looked for a <script> with nynjacb.js and nynjacb-min.js)");
  }

  function addStyle() {
    var existing = document.getElementById("nynjacb-stylesheet");
    if (! existing) {
      var link = document.createElement("link");
      link.id = "nynjacb-stylesheet";
      link.setAttribute("rel", "stylesheet");
      link.href = baseUrl + styleSheet +
	(cacheBust ? ("?bust=" + cacheBust) : '');
      document.head.appendChild(link);
    }
  }

  function addScript(url) {
    var script = document.createElement("script");
    script.src = baseUrl + url +
      (cacheBust ? ("?bust=" + cacheBust) : '');
    document.head.appendChild(script);
  }

  var NynjaCB = window.NynjaCB = function NynjaCB(event) {
    var session;
    if (NynjaCB.running) {
      session = NynjaCB.require("session");
      session.close();
      return;
    }
    NynjaCB.startup.button = null;
    try {
      if (event && typeof event == "object") {
        if (event.target && typeof event) {
          NynjaCB.startup.button = event.target;
        } else if (event.nodeType == 1) {
          NynjaCB.startup.button = event;
        } else if (event[0] && event[0].nodeType == 1) {
          // Probably a jQuery element
          NynjaCB.startup.button = event[0];
        }
      }
    } catch (e) {
      console.warn("Error determining starting button:", e);
    }
    if (window.TowTruckConfig) {
      console.warn("TowTruckConfig is deprecated; please use NynjaCBConfig");
      if (window.NynjaCBConfig) {
        console.warn("Ignoring TowTruckConfig in favor of NynjaCBConfig");
      } else {
        window.NynjaCBConfig = TowTruckConfig;
      }
    }
    if (window.NynjaCBConfig && (! window.NynjaCBConfig.loaded)) {
      NynjaCB.config(window.NynjaCBConfig);
      window.NynjaCBConfig.loaded = true;
    }

    // This handles loading configuration from global variables.  This
    // includes NynjaCBConfig_on_*, which are attributes folded into
    // the "on" configuration value.
    var attr;
    var attrName;
    var globalOns = {};
    for (attr in window) {
      if (attr.indexOf("NynjaCBConfig_on_") === 0) {
        attrName = attr.substr(("NynjaCBConfig_on_").length);
        globalOns[attrName] = window[attr];
      } else if (attr.indexOf("NynjaCBConfig_") === 0) {
        attrName = attr.substr(("NynjaCBConfig_").length);
        NynjaCB.config(attrName, window[attr]);
      } else if (attr.indexOf("TowTruckConfig_on_") === 0) {
        attrName = attr.substr(("TowTruckConfig_on_").length);
        console.warn("TowTruckConfig_* is deprecated, please rename", attr, "to NynjaCBConfig_on_" + attrName);
        globalOns[attrName] = window[attr];
      } else if (attr.indexOf("TowTruckConfig_") === 0) {
        attrName = attr.substr(("TowTruckConfig_").length);
        console.warn("TowTruckConfig_* is deprecated, please rename", attr, "to NynjaCBConfig_" + attrName);
        NynjaCB.config(attrName, window[attr]);
      }


    }
    // FIXME: copy existing config?
    // FIXME: do this directly in NynjaCB.config() ?
    // FIXME: close these configs?
    var ons = NynjaCB.config.get("on");
    for (attr in globalOns) {
      if (globalOns.hasOwnProperty(attr)) {
        // FIXME: should we avoid overwriting?  Maybe use arrays?
        ons[attr] = globalOns[attr];
      }
    }
    NynjaCB.config("on", ons);
    for (attr in ons) {
      NynjaCB.on(attr, ons[attr]);
    }
    var hubOns = NynjaCB.config.get("hub_on");
    if (hubOns) {
      for (attr in hubOns) {
        if (hubOns.hasOwnProperty(attr)) {
          NynjaCB.hub.on(attr, hubOns[attr]);
        }
      }
    }
    if (!NynjaCB.config.close('cacheBust')) {
      cacheBust = '';
      delete NynjaCB.requireConfig.urlArgs;
    }

    if (! NynjaCB.startup.reason) {
      // Then a call to NynjaCB() from a button must be started NynjaCB
      NynjaCB.startup.reason = "started";
    }

    // FIXME: maybe I should just test for NynjaCB.require:
    if (NynjaCB._loaded) {
      session = NynjaCB.require("session");
      addStyle();
      session.start();
      return;
    }
    // A sort of signal to session.js to tell it to actually
    // start itself (i.e., put up a UI and try to activate)
    NynjaCB.startup._launch = true;

    addStyle();
    var minSetting = NynjaCB.config.get("useMinimizedCode");
    NynjaCB.config.close("useMinimizedCode");
    if (minSetting !== undefined) {
      min = !! minSetting;
    }
    var requireConfig = NynjaCB._extend(NynjaCB.requireConfig);
    var deps = ["session", "jquery"];
    var lang = NynjaCB.getConfig("lang");
    // [igoryen]: We should generate this value in Gruntfile.js, based on the available translations
    var availableTranslations = {
      "en-US": true,
      "en": "en-US",
      "es": "es-BO",
      "es-BO": true,
      "ru": true,
      "ru-RU": "ru",
      "pl": "pl-PL",
      "pl-PL": true,
      "de-DE": true,
      "de": "de-DE"
    };

    if(lang === undefined) {
      // BCP 47 mandates hyphens, not underscores, to separate lang parts
      lang = navigator.language.replace(/_/g, "-");
    }
    if (/-/.test(lang) && !availableTranslations[lang]) {
      lang = lang.replace(/-.*$/, '');
    }
    if (!availableTranslations[lang]) {
      lang = NynjaCB.config.get("fallbackLang");
    } else if (availableTranslations[lang] !== true) {
      lang = availableTranslations[lang];
    }
    NynjaCB.config("lang", lang);

    var localeTemplates = "templates-" + lang;
    deps.splice(0, 0, localeTemplates);
    function callback(session, jquery) {
      NynjaCB._loaded = true;
      if (! min) {
        NynjaCB.require = require.config({context: "nynjacb"});
        NynjaCB._requireObject = require;
      }
    }
    if (! min) {
      if (typeof require == "function") {
        if (! require.config) {
          console.warn("The global require (", require, ") is not requirejs; please use nynjacb-min.js");
          throw new Error("Conflict with window.require");
        }
        NynjaCB.require = require.config(requireConfig);
      }
    }
    if (typeof NynjaCB.require == "function") {
      // This is an already-configured version of require
      NynjaCB.require(deps, callback);
    } else {
      requireConfig.deps = deps;
      requireConfig.callback = callback;
      if (! min) {
        window.require = requireConfig;
      }
    }
    if (min) {
      addScript("/nynjacb/nynjacbPackage.js");
    } else {
      addScript("/nynjacb/libs/require.js");
    }
  };

  NynjaCB.pageLoaded = Date.now();

  NynjaCB._extend = function (base, extensions) {
    if (! extensions) {
      extensions = base;
      base = {};
    }
    for (var a in extensions) {
      if (extensions.hasOwnProperty(a)) {
        base[a] = extensions[a];
      }
    }
    return base;
  };

  NynjaCB._startupInit = {
    // What element, if any, was used to start the session:
    button: null,
    // The startReason is the reason NynjaCB was started.  One of:
    //   null: not started
    //   started: hit the start button (first page view)
    //   joined: joined the session (first page view)
    reason: null,
    // Also, the session may have started on "this" page, or maybe is continued
    // from a past page.  NynjaCB.continued indicates the difference (false the
    // first time NynjaCB is started or joined, true on later page loads).
    continued: false,
    // This is set to tell the session what shareId to use, if the boot
    // code knows (mostly because the URL indicates the id).
    _joinShareId: null,
    // This tells session to start up immediately (otherwise it would wait
    // for session.start() to be run)
    _launch: false
  };
  NynjaCB.startup = NynjaCB._extend(NynjaCB._startupInit);
  NynjaCB.running = false;

  NynjaCB.requireConfig = {
    context: "nynjacb",
    baseUrl: baseUrl + "/nynjacb",
    urlArgs: "bust=" + cacheBust,
    paths: {
      jquery: "libs/jquery-1.11.1.min",
      walkabout: "libs/walkabout/walkabout",
      esprima: "libs/walkabout/lib/esprima",
      falafel: "libs/walkabout/lib/falafel",
      tinycolor: "libs/tinycolor",
      whrandom: "libs/whrandom/random"
    }
  };

  NynjaCB._mixinEvents = function (proto) {
    proto.on = function on(name, callback) {
      if (typeof callback != "function") {
        console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
        throw "Error: .once() called with non-callback";
      }
      if (name.search(" ") != -1) {
        var names = name.split(/ +/g);
        names.forEach(function (n) {
          this.on(n, callback);
        }, this);
        return;
      }
      if (this._knownEvents && this._knownEvents.indexOf(name) == -1) {
        var thisString = "" + this;
        if (thisString.length > 20) {
          thisString = thisString.substr(0, 20) + "...";
        }
        console.warn(thisString + ".on('" + name + "', ...): unknown event");
        if (console.trace) {
          console.trace();
        }
      }
      if (! this._listeners) {
        this._listeners = {};
      }
      if (! this._listeners[name]) {
        this._listeners[name] = [];
      }
      if (this._listeners[name].indexOf(callback) == -1) {
        this._listeners[name].push(callback);
      }
    };
    proto.once = function once(name, callback) {
      if (typeof callback != "function") {
        console.warn("Bad callback for", this, ".once(", name, ", ", callback, ")");
        throw "Error: .once() called with non-callback";
      }
      var attr = "onceCallback_" + name;
      // FIXME: maybe I should add the event name to the .once attribute:
      if (! callback[attr]) {
        callback[attr] = function onceCallback() {
          callback.apply(this, arguments);
          this.off(name, onceCallback);
          delete callback[attr];
        };
      }
      this.on(name, callback[attr]);
    };
    proto.off = proto.removeListener = function off(name, callback) {
      if (this._listenerOffs) {
        // Defer the .off() call until the .emit() is done.
        this._listenerOffs.push([name, callback]);
        return;
      }
      if (name.search(" ") != -1) {
        var names = name.split(/ +/g);
        names.forEach(function (n) {
          this.off(n, callback);
        }, this);
        return;
      }
      if ((! this._listeners) || ! this._listeners[name]) {
        return;
      }
      var l = this._listeners[name], _len = l.length;
      for (var i=0; i<_len; i++) {
        if (l[i] == callback) {
          l.splice(i, 1);
          break;
        }
      }
    };
    proto.emit = function emit(name) {
      var offs = this._listenerOffs = [];
      if ((! this._listeners) || ! this._listeners[name]) {
        return;
      }
      var args = Array.prototype.slice.call(arguments, 1);
      var l = this._listeners[name];
      l.forEach(function (callback) {

        callback.apply(this, args);
      }, this);
      delete this._listenerOffs;
      if (offs.length) {
        offs.forEach(function (item) {
          this.off(item[0], item[1]);
        }, this);
      }

    };
    return proto;
  };

  /* This finalizes the unloading of NynjaCB, including unloading modules */
  NynjaCB._teardown = function () {
    var requireObject = NynjaCB._requireObject || window.require;
    // FIXME: this doesn't clear the context for min-case
    if (requireObject.s && requireObject.s.contexts) {
      delete requireObject.s.contexts.nynjacb;
    }
    NynjaCB._loaded = false;
    NynjaCB.startup = NynjaCB._extend(NynjaCB._startupInit);
    NynjaCB.running = false;
  };

  NynjaCB._mixinEvents(NynjaCB);
  NynjaCB._knownEvents = ["ready", "close"];
  NynjaCB.toString = function () {
    return "NynjaCB";
  };

  var defaultHubBase = "https://hub.togetherjs.com";
  if (defaultHubBase == "__" + "hubUrl"+ "__") {
    // Substitution wasn't made
    defaultHubBase = "https://cobrowse.nynja.net";
  }
  defaultConfiguration.hubBase = defaultHubBase;

  NynjaCB._configuration = {};
  NynjaCB._defaultConfiguration = {
    // Disables clicks for a certain element.
    // (e.g., 'canvas' would not show clicks on canvas elements.)
    // Setting this to true will disable clicks globally.
    dontShowClicks: false,
    // Experimental feature to echo clicks to certain elements across clients:
    cloneClicks: false,
    // Enable Mozilla or Google analytics on the page when NynjaCB is activated:
    // FIXME: these don't seem to be working, and probably should be removed in favor
    // of the hub analytics
    enableAnalytics: false,
    // The code to enable (this is defaulting to a Mozilla code):
    analyticsCode: "UA-35433268-28",
    // The base URL of the hub
    hubBase: defaultHubBase,
    // A function that will return the name of the user:
    getUserName: null,
    // A function that will return the color of the user:
    getUserColor: null,
    // A function that will return the avatar of the user:
    getUserAvatar: null,
    // The siteName is used in the walkthrough (defaults to document.title):
    siteName: null,
    // Whether to use the minimized version of the code (overriding the built setting)
    useMinimizedCode: undefined,
    // Any events to bind to
    on: {},
    // Hub events to bind to
    hub_on: {},
    // Enables the alt-T alt-T NynjaCB shortcut; however, this setting
    // must be enabled early as NynjaCBConfig_enableShortcut = true;
    enableShortcut: false,
    // The name of this tool as provided to users.  The UI is updated to use this.
    // Because of how it is used in text it should be a proper noun, e.g.,
    // "MySite's Collaboration Tool"
    toolName: null,
    // Used to auto-start NynjaCB with a {prefix: pageName, max: participants}
    // Also with findRoom: "roomName" it will connect to the given room name
    findRoom: null,
    // If true, starts NynjaCB automatically (of course!)
    autoStart: false,
    // If true, then the "Join NynjaCB Session?" confirmation dialog
    // won't come up
    suppressJoinConfirmation: false,
    // If true, then the "Invite a friend" window won't automatically come up
    suppressInvite: false,
    // A room in which to find people to invite to this session,
    inviteFromRoom: null,
    // This is used to keep sessions from crossing over on the same
    // domain, if for some reason you want sessions that are limited
    // to only a portion of the domain:
    storagePrefix: "nynjacb",
    // When true, we treat the entire URL, including the hash, as the identifier
    // of the page; i.e., if you one person is on `http://example.com/#view1`
    // and another person is at `http://example.com/#view2` then these two people
    // are considered to be at completely different URLs
    includeHashInUrl: false,
    // The language to present the tool in, such as "en-US" or "ru-RU"
    // Note this must be set as NynjaCBConfig_lang, as it effects the loader
    // and must be set as soon as this file is included
    lang: null
  };
  // FIXME: there's a point at which configuration can't be updated
  // (e.g., hubBase after the NynjaCB has loaded).  We should keep
  // track of these and signal an error if someone attempts to
  // reconfigure too late

  NynjaCB.getConfig = function (name) { // rename into NynjaCB.config.get()?
    var value = NynjaCB._configuration[name];
    if (value === undefined) {
      if (! NynjaCB._defaultConfiguration.hasOwnProperty(name)) {
        console.error("Tried to load unknown configuration value:", name);
      }
      value = NynjaCB._defaultConfiguration[name];
    }
    return value;
  };
  NynjaCB._defaultConfiguration = defaultConfiguration;
  NynjaCB._configTrackers = {};
  NynjaCB._configClosed = {};

  /* NynjaCB.config(configurationObject)
     or: NynjaCB.config(configName, value)

     Adds configuration to NynjaCB.  You may also set the global variable NynjaCBConfig
     and when NynjaCB is started that configuration will be loaded.

     Unknown configuration values will lead to console error messages.
     */
  NynjaCB.config = function (name, maybeValue) {
    var settings;
    if (arguments.length == 1) {
      if (typeof name != "object") {
        throw new Error('NynjaCB.config(value) must have an object value (not: ' + name + ')');
      }
      settings = name;
    } else {
      settings = {};
      settings[name] = maybeValue;
    }
    var i;
    var tracker;
    var attr;
    for (attr in settings) {
      if (settings.hasOwnProperty(attr)) {
        if (NynjaCB._configClosed[attr] && NynjaCB.running) {
          throw new Error("The configuration " + attr + " is finalized and cannot be changed");
        }
      }
    }
    for (attr in settings) {
      if (! settings.hasOwnProperty(attr)) {
        continue;
      }
      if (attr == "loaded" || attr == "callToStart") {
        continue;
      }
      if (! NynjaCB._defaultConfiguration.hasOwnProperty(attr)) {
        console.warn("Unknown configuration value passed to NynjaCB.config():", attr);
      }
      var previous = NynjaCB._configuration[attr];
      var value = settings[attr];
      NynjaCB._configuration[attr] = value;
      var trackers = NynjaCB._configTrackers[name] || [];
      var failed = false;
      for (i=0; i<trackers.length; i++) {
        try {
          tracker = trackers[i];
          tracker(value, previous);
        } catch (e) {
          console.warn("Error setting configuration", name, "to", value,
                       ":", e, "; reverting to", previous);
          failed = true;
          break;
        }
      }
      if (failed) {
        NynjaCB._configuration[attr] = previous;
        for (i=0; i<trackers.length; i++) {
          try {
            tracker = trackers[i];
            tracker(value);
          } catch (e) {
            console.warn("Error REsetting configuration", name, "to", previous,
                         ":", e, "(ignoring)");
          }
        }
      }
    }
  };

  NynjaCB.config.get = function (name) {
    var value = NynjaCB._configuration[name];
    if (value === undefined) {
      if (! NynjaCB._defaultConfiguration.hasOwnProperty(name)) {
        console.error("Tried to load unknown configuration value:", name);
      }
      value = NynjaCB._defaultConfiguration[name];
    }
    return value;
  };

  NynjaCB.config.track = function (name, callback) {
    if (! NynjaCB._defaultConfiguration.hasOwnProperty(name)) {
      throw new Error("Configuration is unknown: " + name);
    }
    callback(NynjaCB.config.get(name));
    if (! NynjaCB._configTrackers[name]) {
      NynjaCB._configTrackers[name] = [];
    }
    NynjaCB._configTrackers[name].push(callback);
    return callback;
  };

  NynjaCB.config.close = function (name) {
    if (! NynjaCB._defaultConfiguration.hasOwnProperty(name)) {
      throw new Error("Configuration is unknown: " + name);
    }
    NynjaCB._configClosed[name] = true;
    return this.get(name);
  };

  NynjaCB.reinitialize = function () {
    if (NynjaCB.running && typeof NynjaCB.require == "function") {
      NynjaCB.require(["session"], function (session) {
        session.emit("reinitialize");
      });
    }
    // If it's not set, NynjaCB has not been loaded, and reinitialization is not needed
  };

  NynjaCB.refreshUserData = function () {
    if (NynjaCB.running && typeof NynjaCB.require ==  "function") {
      NynjaCB.require(["session"], function (session) {
        session.emit("refresh-user-data");
      });
    }
  };

  // This should contain the output of "git describe --always --dirty"
  // FIXME: substitute this on the server (and update make-static-client)
  NynjaCB.version = version;
  NynjaCB.baseUrl = baseUrl;

  NynjaCB.hub = NynjaCB._mixinEvents({});

  NynjaCB._onmessage = function (msg) {
    var type = msg.type;
    if (type.search(/^app\./) === 0) {
      type = type.substr("app.".length);
    } else {
      type = "nynjacb." + type;
    }
    msg.type = type;
    NynjaCB.hub.emit(msg.type, msg);
  };

  NynjaCB.send = function (msg) {
    if (! NynjaCB.require) {
      throw "You cannot use NynjaCB.send() when NynjaCB is not running";
    }
    var session = NynjaCB.require("session");
    session.appSend(msg);
  };

  NynjaCB.shareUrl = function () {
    if (! NynjaCB.require) {
      return null;
    }
    var session = NynjaCB.require("session");
    return session.shareUrl();
  };

  var listener = null;

  NynjaCB.listenForShortcut = function () {
    console.warn("Listening for alt-T alt-T to start NynjaCB");
    NynjaCB.removeShortcut();
    listener = function listener(event) {
      if (event.which == 84 && event.altKey) {
        if (listener.pressed) {
          // Second hit
          NynjaCB();
        } else {
          listener.pressed = true;
        }
      } else {
        listener.pressed = false;
      }
    };
    NynjaCB.once("ready", NynjaCB.removeShortcut);
    document.addEventListener("keyup", listener, false);
  };

  NynjaCB.removeShortcut = function () {
    if (listener) {
      document.addEventListener("keyup", listener, false);
      listener = null;
    }
  };

  NynjaCB.config.track("enableShortcut", function (enable, previous) {
    if (enable) {
      NynjaCB.listenForShortcut();
    } else if (previous) {
      NynjaCB.removeShortcut();
    }
  });

  NynjaCB.checkForUsersOnChannel = function (address, callback) {
    if (address.search(/^https?:/i) === 0) {
      address = address.replace(/^http/i, 'ws');
    }
    var socket = new WebSocket(address);
    var gotAnswer = false;
    socket.onmessage = function (event) {
      var msg = JSON.parse(event.data);
      if (msg.type != "init-connection") {
        console.warn("Got unexpected first message (should be init-connection):", msg);
        return;
      }
      if (gotAnswer) {
        console.warn("Somehow received two responses from channel; ignoring second");
        socket.close();
        return;
      }
      gotAnswer = true;
      socket.close();
      callback(msg.peerCount);
    };
    socket.onclose = socket.onerror = function () {
      if (! gotAnswer) {
        console.warn("Socket was closed without receiving answer");
        gotAnswer = true;
        callback(undefined);
      }
    };
  };

  // It's nice to replace this early, before the load event fires, so we conflict
  // as little as possible with the app we are embedded in:
  var hash = location.hash.replace(/^#/, "");
  var m = /&?nynjacb=([^&]*)/.exec(hash);
  if (m) {
    NynjaCB.startup._joinShareId = m[1];
    NynjaCB.startup.reason = "joined";
    var newHash = hash.substr(0, m.index) + hash.substr(m.index + m[0].length);
    location.hash = newHash;
  }
  if (window._NynjaCBShareId) {
    // A weird hack for something the addon does, to force a shareId.
    // FIXME: probably should remove, it's a wonky feature.
    NynjaCB.startup._joinShareId = window._NynjaCBShareId;
    delete window._NynjaCBShareId;
  }

  function conditionalActivate() {
    if (window.NynjaCBConfig_noAutoStart) {
      return;
    }
    // A page can define this function to defer NynjaCB from starting
    var callToStart = window.NynjaCBConfig_callToStart;
    if (! callToStart && window.TowTruckConfig_callToStart) {
      callToStart = window.TowTruckConfig_callToStart;
      console.warn("Please rename TowTruckConfig_callToStart to NynjaCBConfig_callToStart");
    }
    if (window.NynjaCBConfig && window.NynjaCBConfig.callToStart) {
      callToStart = window.NynjaCBConfig.callToStart;
    }
    if (callToStart) {
      // FIXME: need to document this:
      callToStart(onload);
    } else {
      onload();
    }
  }

  // FIXME: can we push this up before the load event?
  // Do we need to wait at all?
  function onload() {
    if (NynjaCB.startup._joinShareId) {
      NynjaCB();
    } else if (window._NynjaCBBookmarklet) {
      delete window._NynjaCBBookmarklet;
      NynjaCB();
    } else {
      // FIXME: this doesn't respect storagePrefix:
      var key = "NynjaCB-session.status";
      var value = sessionStorage.getItem(key);
      if (value) {
        value = JSON.parse(value);
        if (value && value.running) {
          NynjaCB.startup.continued = true;
          NynjaCB.startup.reason = value.startupReason;
          NynjaCB();
        }
      } else if (window.nynjacbConfig_autoStart ||
                 (window.nynjacbConfig && window.nynjacbConfig.autoStart)) {
        nynjacb.startup.reason = "joined";
        nynjacb();
      }
    }
  }

  conditionalActivate();

  // FIXME: wait until load event to double check if this gets set?
  if (window.NynjaCBConfig_enableShortcut) {
    nynjacb.listenForShortcut();
  }

  // For compatibility:
  window.TowTruck = NynjaCB;

})();
