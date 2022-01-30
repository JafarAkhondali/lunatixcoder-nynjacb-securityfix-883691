/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const widgets = require("widget");
const data = require("self").data;
const tabs = require("tabs");
const { StartupPanel } = require("./startup-panel");
const { Page } = require("page-worker");
const simplePrefs = require('simple-prefs');

var button = widgets.Widget({
  id: "nynjacb-starter",
  label: "Start NynjaCB",
  contentURL: data.url("button.html"),
  contentScriptFile: data.url("button.js"),
  onClick: function () {
    console.log("Starting NynjaCB because of click");
    startNynjaCB();
  },
  width: 48
});

StartupPanel({
  name: "NynjaCB",
  contentURL: data.url("startup-help.html")
});

var autoDomains = [];
function updateAutoDomains() {
  var domains = simplePrefs.prefs.autoDomains;
  domains = domains.split(/,/g);
  autoDomains = [];
  domains.forEach(function (item) {
    if (item.search(/^\s*$/) === 0) {
      return;
    }
    item = item.replace(/^\s+/, "").replace(/\s+$/, "");
    item = item.split(/;/);
    var domain = item[0];
    var shareId = item[1] || null;
    if (domain.indexOf("//") == -1) {
      // Just a plain domain
      domain = "^https?:\\/\\/" + domain;
    }
    domain = new RegExp(domain, "i");
    autoDomains.push({domain: domain, shareId: shareId});
  });
}
simplePrefs.on("autoDomains", updateAutoDomains);
updateAutoDomains();


function startNynjaCB(shareId) {
  var tab = tabs.activeTab;
  if (tab.nynjacbCloser) {
    tab.nynjacbCloser();
    return;
  }
  tab.nynjacbCloser = function () {
    tab.nynjacbCloser = null;
    button.port.emit("NynjaCBOff");
    tab.removeListener("ready", attachWorker);
  };
  var worker;
  function attachWorker() {
    worker = tab.attach({
      contentScriptFile: [
        data.url("attachment.js")
      ]
    });
    worker.port.on("Close", function () {
      tab.nynjacbCloser();
    });
    worker.port.emit("Config", {url: simplePrefs.prefs.nynjacbJs, hubBase: simplePrefs.prefs.hubBase, shareId: shareId || null});
  }
  button.port.emit("NynjaCBOn");
  tab.on("ready", attachWorker);
  attachWorker();
}
// Need poll for back button code

tabs.on("open", watchTab);

function watchTab(tab) {
  tab.on("ready", function () {
    if (tabs.activeTab == tab && tab.url.indexOf("#&nynjacb") != -1) {
      console.log("Starting NynjaCB on share link", tab.url);
      startNynjaCB();
    }
    if (tabs.activeTab == tab && ! tab.nynjacbCloser) {
      var started = false;
      autoDomains.forEach(function (matcher) {
        console.log("matcher", matcher, matcher.domain);
        if ((! started) && tab.url.search(matcher.domain) != -1) {
          console.log("Start NynjaCB autoDomain");
          startNynjaCB(matcher.shareId);
          started = true;
        }
      });
    }
  });
}

for (var i=0; i<tabs.length; i++) {
  watchTab(tabs[i]);
}

tabs.on("activate", function () {
  if (tabs.activeTab.nynjacbCloser) {
    button.port.emit("NynjaCBOn");
  } else {
    button.port.emit("NynjaCBOff");
  }
});
