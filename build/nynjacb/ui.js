/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

define(["require", "jquery", "util", "session", "templates", "templating", "linkify", "peers", "windowing", "tinycolor", "elementFinder", "visibilityApi"], function (require, $, util, session, templates, templating, linkify, peers, windowing, tinycolor, elementFinder, visibilityApi) {
  var ui = util.Module('ui');
  var assert = util.assert;
  var AssertionError = util.AssertionError;
  var chat;
  var $window = $(window);
  // This is also in nynjacb.less, as @button-height:
  var BUTTON_HEIGHT = 60 + 1; // 60 is button height, 1 is border
  // chat TextArea
  var TEXTAREA_LINE_HEIGHT = 20; // in pixels
  var TEXTAREA_MAX_LINES = 5;
  // This is also in nynjacb.less, under .nynjacb-animated
  var ANIMATION_DURATION = 1000;
  // Time the new user window sticks around until it fades away:
  var NEW_USER_FADE_TIMEOUT = 5000;
  // This is set when an animation will keep the UI from being ready
  // (until this time):
  var finishedAt = null;
  // Time in milliseconds for the dock to animate out:
  var DOCK_ANIMATION_TIME = 300;
  // If two chat messages come from the same person in this time
  // (milliseconds) then they are collapsed into one message:
  var COLLAPSE_MESSAGE_LIMIT = 5000;

  var COLORS = [
    "#8A2BE2", "#7FFF00", "#DC143C", "#00FFFF", "#8FBC8F", "#FF8C00", "#FF00FF",
    "#FFD700", "#F08080", "#90EE90", "#FF6347"];

  // This would be a circular import, but we just need the chat module sometime
  // after everything is loaded, and this is sure to complete by that time:
  require(["chat"], function (c) {
    chat = c;
  });

  /* Displays some toggleable element; toggleable elements have a
     data-toggles attribute that indicates what other elements should
     be hidden when this element is shown. */
  ui.displayToggle = function (el) {
    el = $(el);
    assert(el.length, "No element", arguments[0]);
    var other = $(el.attr("data-toggles"));
    assert(other.length, "Cannot toggle", el[0], "selector", other.selector);
    other.hide();
    el.show();
  };

  function panelPosition() {
    var iface = $("#nynjacb-dock");
    if (iface.hasClass("nynjacb-dock-right")) {
      return "right";
    } else if (iface.hasClass("nynjacb-dock-left")) {
      return "left";
    } else if (iface.hasClass("nynjacb-dock-bottom")) {
      return "bottom";
    } else {
      throw new AssertionError("#nynjacb-dock doesn't have positioning class");
    }
  }

  ui.container = null;

  // This is used for some signalling when ui.prepareUI and/or
  // ui.activateUI is called before the DOM is fully loaded:
  var deferringPrepareUI = null;

  function deferForContainer(func) {
    /* Defers any calls to func() until after ui.container is set
       Function cannot have a return value (as sometimes the call will
       become async).  Use like:

       method: deferForContainer(function (args) {...})
       */
    return function () {
      if (ui.container) {
        func.apply(this, arguments);
      }
      var self = this;
      var args = Array.prototype.slice.call(arguments);
      session.once("ui-ready", function () {
        func.apply(self, args);
      });
    };
  }

  // This is called before activateUI; it doesn't bind anything, but does display
  // the dock
  // FIXME: because this module has lots of requirements we can't do
  // this before those requirements are loaded.  Maybe worth splitting
  // this out?  OTOH, in production we should have all the files
  // combined so there's not much problem loading those modules.
  ui.prepareUI = function () {
    if (! (document.readyState == "complete" || document.readyState == "interactive")) {
      // Too soon!  Wait a sec...
      deferringPrepareUI = "deferring";
      document.addEventListener("DOMContentLoaded", function () {
        var d = deferringPrepareUI;
        deferringPrepareUI = null;
        ui.prepareUI();
        // This happens when ui.activateUI is called before the document has been
        // loaded:
        if (d == "activate") {
          ui.activateUI();
        }
      });
      return;
    }
    var container = ui.container = $(templates("interface"));
    assert(container.length);
    $("body").append(container);
    fixupAvatars(container);
    if (session.firstRun && NynjaCB.startTarget) {
      // Time at which the UI will be fully ready:
      // (We have to do this because the offset won't be quite right
      // until the animation finishes - attempts to calculate the
      // offset without taking into account CSS transforms have so far
      // failed.)
      var timeoutSeconds = DOCK_ANIMATION_TIME / 1000;
      finishedAt = Date.now() + DOCK_ANIMATION_TIME + 50;
      setTimeout(function () {
        finishedAt = Date.now() + DOCK_ANIMATION_TIME + 40;
        var iface = container.find("#nynjacb-dock");
        var start = iface.offset();
        var pos = $(NynjaCB.startTarget).offset();
        pos.top = Math.floor(pos.top - start.top);
        pos.left = Math.floor(pos.left - start.left);
        var translate = "translate(" + pos.left + "px, " + pos.top + "px)";
        iface.css({
          MozTransform: translate,
          WebkitTransform: translate,
          transform: translate,
          opacity: "0.0"
        });
        setTimeout(function () {
          // We keep recalculating because the setTimeout times aren't always so accurate:
          finishedAt = Date.now() + DOCK_ANIMATION_TIME + 20;
          var transition = "transform " + timeoutSeconds + "s ease-out, ";
          transition += "opacity " + timeoutSeconds + "s ease-out";
          iface.css({
            opacity: "1.0",
            MozTransition: "-moz-" + transition,
            MozTransform: "translate(0, 0)",
            WebkitTransition: "-webkit-" + transition,
            WebkitTransform: "translate(0, 0)",
            transition: transition,
            transform: "translate(0, 0)"
          });
          setTimeout(function () {
            finishedAt = null;
            iface.attr("style", "");
          }, 510);
        }, 5);
      }, 5);
    }
    if (NynjaCB.startTarget) {
      var el = $(NynjaCB.startTarget);
      var text = el.text().toLowerCase().replace(/\s+/g, " ");
      text = text.replace(/^\s*/, "").replace(/\s*$/, "");
      if (text == "start nynjacb") {
        el.attr("data-end-nynjacb-html", "End NynjaCB");
      }
      if (el.attr("data-end-nynjacb-html")) {
        el.attr("data-start-nynjacb-html", el.html());
        el.html(el.attr("data-end-nynjacb-html"));
      }
      el.addClass("nynjacb-started");
    }
    ui.container.find(".nynjacb-window > header, .nynjacb-modal > header").each(function () {
      $(this).append($('<button class="nynjacb-close"></button>'));
    });

    NynjaCB.config.track("disableWebRTC", function (hide, previous) {
      if (hide && ! previous) {
        ui.container.find("#nynjacb-audio-button").hide();
        adjustDockSize(-1);
      } else if ((! hide) && previous) {
        ui.container.find("#nynjacb-audio-button").show();
        adjustDockSize(1);
      }
    });

  };

  // After prepareUI, this actually makes the interface live.  We have
  // to do this later because we call prepareUI when many components
  // aren't initialized, so we don't even want the user to be able to
  // interact with the interface.  But activateUI is called once
  // everything is loaded and ready for interaction.
  ui.activateUI = function () {
    if (deferringPrepareUI) {
      console.warn("ui.activateUI called before document is ready; waiting...");
      deferringPrepareUI = "activate";
      return;
    }
    if (! ui.container) {
      ui.prepareUI();
    }
    var container = ui.container;

    //create the overlay
    if($.browser.mobile) {
      // $("body").append( "\x3cdiv class='overlay' style='position: absolute; top: 0; left: 0; background-color: rgba(0,0,0,0); width: 120%; height: 100%; z-index: 1000; margin: -10px'>\x3c/div>" );
    }

    // The share link:
    ui.prepareShareLink(container);
    container.find("input.nynjacb-share-link").on("keydown", function (event) {
      if (event.which == 27) {
        windowing.hide("#nynjacb-share");
        return false;
      }
      return undefined;
    });
    session.on("shareId", updateShareLink);

    // The chat input element:
    var input = container.find("#nynjacb-chat-input");
    input.bind("keydown", function (event) {
      if (event.which == 13 && !event.shiftKey) { // Enter without Shift pressed
        submitChat();
        return false;
      }
      if (event.which == 27) { // Escape
        windowing.hide("#nynjacb-chat");
        return false;
      }
    });

    function submitChat() {
      var val = input.val();
      if ($.trim(val)) {
        input.val("");
        // triggering the event manually to avoid the addition of newline character to the textarea:
        input.trigger("input").trigger("propertychange");
        chat.submit(val);
      }
    }
    // auto-resize textarea:
    input.on("input propertychange", function () {
      var $this = $(this);
      var actualHeight = $this.height();
      // reset the height of textarea to remove trailing empty space (used for shrinking):
      $this.height(TEXTAREA_LINE_HEIGHT);
      this.scrollTop = 0;
      // scroll to bottom:
      this.scrollTop = 9999;
      var newHeight = this.scrollTop + $this.height();
      var maxHeight = TEXTAREA_MAX_LINES * TEXTAREA_LINE_HEIGHT;
      if (newHeight > maxHeight) {
        newHeight = maxHeight;
        this.style.overflowY = "scroll";
      } else {
        this.style.overflowY = "hidden";
      }
      this.style.height = newHeight + "px";
      var diff = newHeight - actualHeight;
      $("#nynjacb-chat-input-box").height($("#nynjacb-chat-input-box").height() + diff);
      $("#nynjacb-chat-messages").height($("#nynjacb-chat-messages").height() - diff);
      return false;
    });

    util.testExpose({submitChat: submitChat});

    // Moving the window:
    // FIXME: this should probably be stickier, and not just move the window around
    // so abruptly
    var anchor = container.find("#nynjacb-dock-anchor");
    assert(anchor.length);
    // FIXME: This is in place to temporarily disable dock dragging:
    anchor = container.find("#nynjacb-dock-anchor-disabled");
    anchor.mousedown(function (event) {
      var iface = $("#nynjacb-dock");
      // FIXME: switch to .offset() and pageX/Y
      var startPos = panelPosition();
      function selectoff() {
        return false;
      }
      function mousemove(event2) {
        var fromRight = $window.width() + window.pageXOffset - event2.pageX;
        var fromLeft = event2.pageX - window.pageXOffset;
        var fromBottom = $window.height() + window.pageYOffset - event2.pageY;
        // FIXME: this is to temporarily disable the bottom view:
        fromBottom = 10000;

        var pos;
        if (fromLeft < fromRight && fromLeft < fromBottom) {
          pos = "left";
        } else if (fromRight < fromLeft && fromRight < fromBottom) {
          pos = "right";
        } else {
          pos = "bottom";
        }
        iface.removeClass("nynjacb-dock-left");
        iface.removeClass("nynjacb-dock-right");
        iface.removeClass("nynjacb-dock-bottom");
        iface.addClass("nynjacb-dock-" + pos);
        if (startPos && pos != startPos) {
          windowing.hide();
          startPos = null;
        }
      }
      $(document).bind("mousemove", mousemove);
      // If you don't turn selection off it will still select text, and show a
      // text selection cursor:
      $(document).bind("selectstart", selectoff);
      // FIXME: it seems like sometimes we lose the mouseup event, and it's as though
      // the mouse is stuck down:
      $(document).one("mouseup", function () {
        $(document).unbind("mousemove", mousemove);
        $(document).unbind("selectstart", selectoff);
      });
      return false;
    });

    function openDock() {
      $('.nynjacb-window').animate({
        opacity: 1
      });
      $('#nynjacb-dock-participants').animate({
        opacity: 1
      });
      $('#nynjacb-dock #nynjacb-buttons').animate({
        opacity: 1
      });

      //for iphone
      if($(window).width() < 480) {
        $('.nynjacb-dock-right').animate({
          width: "204px"
        }, {
          duration:60, easing:"linear"
        });
      }

      //for ipad
      else {
        $('.nynjacb-dock-right').animate({
          width: "27%"
        }, {
          duration:60, easing:"linear"
        });
      }


      // add bg overlay
      // $("body").append( "\x3cdiv class='overlay' style='position: absolute; top: 0; left: -2px; background-color: rgba(0,0,0,0.5); width: 200%; height: 400%; z-index: 1000; margin: 0px;'>\x3c/div>" );

      //disable vertical scrolling
      // $("body").css({
      //   "position": "fixed",
      //   top: 0,
      //   left: 0
      // });

      //replace the anchor icon
      var src = "/nynjacb/images/nynjacb-logo-close.png";
      $("#nynjacb-dock-anchor #nynjacb-dock-anchor-horizontal img").attr("src", src);
    }

    function closeDock() {
      //enable vertical scrolling
      $("body").css({
        "position": "",
        top: "",
        left: ""
      });

      //replace the anchor icon
      var src = "/nynjacb/images/nynjacb-logo-open.png";
      $("#nynjacb-dock-anchor #nynjacb-dock-anchor-horizontal img").attr("src", src);

      $('.nynjacb-window').animate({
        opacity: 0
      });
      $('#nynjacb-dock-participants').animate({
        opacity: 0
      });
      $('#nynjacb-dock #nynjacb-buttons').animate({
        opacity: 0
      });
      $('.nynjacb-dock-right').animate({
        width: "40px"
      }, {
        duration:60, easing:"linear"
      });

      // remove bg overlay
      //$(".overlay").remove();
    }

    // Setting the anchor button + dock mobile actions
    if($.browser.mobile) {

      // toggle the audio button
      $("#nynjacb-audio-button").click(function () {
        windowing.toggle("#nynjacb-rtc-not-supported");
      });

      // toggle the profile button
      $("#nynjacb-profile-button").click(function () {
        windowing.toggle("#nynjacb-menu-window");
      });

      // $("body").append( "\x3cdiv class='overlay' style='position: absolute; top: 0; left: -2px; background-color: rgba(0,0,0,0.5); width: 200%; height: 400%; z-index: 1000; margin: 0px'>\x3c/div>" );

      //disable vertical scrolling
      // $("body").css({
      //   "position": "fixed",
      //   top: 0,
      //   left: 0
      // });

      //replace the anchor icon
      var src = "/nynjacb/images/nynjacb-logo-close.png";
      $("#nynjacb-dock-anchor #nynjacb-dock-anchor-horizontal img").attr("src", src);

      $("#nynjacb-dock-anchor").toggle(function() {
          closeDock();
        },function(){
          openDock();
      });
    }

    $("#nynjacb-share-button").click(function () {
      windowing.toggle("#nynjacb-share");
    });

    $("#nynjacb-profile-button").click(function (event) {
      if ($.browser.mobile) {
        windowing.show("#nynjacb-menu-window");
        return false;
      }
      toggleMenu();
      event.stopPropagation();
      return false;
    });

    $("#nynjacb-menu-feedback, #nynjacb-menu-feedback-button").click(function(){
      windowing.hide();
      hideMenu();
      windowing.show("#nynjacb-feedback-form");
    });

    $("#nynjacb-menu-help, #nynjacb-menu-help-button").click(function () {
      windowing.hide();
      hideMenu();
      require(["walkthrough"], function (walkthrough) {
        windowing.hide();
        walkthrough.start(false);
      });
    });

    $("#nynjacb-menu-update-name").click(function () {
      var input = $("#nynjacb-menu .nynjacb-self-name");
      input.css({
        width: $("#nynjacb-menu").width() - 32 + "px"
      });
      ui.displayToggle("#nynjacb-menu .nynjacb-self-name");
      $("#nynjacb-menu .nynjacb-self-name").focus();
    });

    $("#nynjacb-menu-update-name-button").click(function () {
      windowing.show("#nynjacb-edit-name-window");
      $("#nynjacb-edit-name-window input").focus();
    });

    $("#nynjacb-menu .nynjacb-self-name").bind("keyup change", function (event) {
      console.log("alrighty", event);
      if (event.which == 13) {
        ui.displayToggle("#nynjacb-self-name-display");
        return;
      }
      var val = $("#nynjacb-menu .nynjacb-self-name").val();
      console.log("values!!", val);
      if (val) {
        peers.Self.update({name: val});
      }
    });

    $("#nynjacb-menu-update-avatar, #nynjacb-menu-update-avatar-button").click(function () {
      hideMenu();
      windowing.show("#nynjacb-avatar-edit");
    });

    $("#nynjacb-menu-end, #nynjacb-menu-end-button").click(function () {
      hideMenu();
      windowing.show("#nynjacb-confirm-end");
    });

    $("#nynjacb-end-session").click(function () {
      session.close();
      //$(".overlay").remove();

    });

    $("#nynjacb-menu-update-color").click(function () {
      var picker = $("#nynjacb-pick-color");
      if (picker.is(":visible")) {
        picker.hide();
        return;
      }
      picker.show();
      bindPicker();
      picker.find(".nynjacb-swatch-active").removeClass("nynjacb-swatch-active");
      picker.find(".nynjacb-swatch[data-color=\"" + peers.Self.color + "\"]").addClass("nynjacb-swatch-active");
    });

    $("#nynjacb-pick-color").click(".nynjacb-swatch", function (event) {
      var swatch = $(event.target);
      var color = swatch.attr("data-color");
      peers.Self.update({
        color: color
      });
      event.stopPropagation();
      return false;
    });

    $("#nynjacb-pick-color").click(function (event) {
      $("#nynjacb-pick-color").hide();
      event.stopPropagation();
      return false;
    });

    COLORS.forEach(function (color) {
      var el = templating.sub("swatch");
      el.attr("data-color", color);
      var darkened = tinycolor.darken(color);
      el.css({
        backgroundColor: color,
        borderColor: darkened
      });
      $("#nynjacb-pick-color").append(el);
    });

    $("#nynjacb-chat-button").click(function () {
      windowing.toggle("#nynjacb-chat");
    });

    session.on("display-window", function (id, element) {
      if (id == "nynjacb-chat") {
        if (! $.browser.mobile) {
          $("#nynjacb-chat-input").focus();
        }
      } else if (id == "nynjacb-share") {
        var link = element.find("input.nynjacb-share-link");
        if (link.is(":visible")) {
          link.focus().select();
        }
      }
    });

    container.find("#nynjacb-chat-notifier").click(function (event) {
      if ($(event.target).is("a") || container.is(".nynjacb-close")) {
        return;
      }
      windowing.show("#nynjacb-chat");
    });

    // FIXME: Don't think this makes sense
    $(".nynjacb header.nynjacb-title").each(function (index, item) {
      var button = $('<button class="nynjacb-minimize"></button>');
      button.click(function (event) {
        var window = button.closest(".nynjacb-window");
        windowing.hide(window);
      });
      $(item).append(button);
    });

    $("#nynjacb-avatar-done").click(function () {
      ui.displayToggle("#nynjacb-no-avatar-edit");
    });

    $("#nynjacb-self-color").css({backgroundColor: peers.Self.color});

    var avatar = peers.Self.avatar;
    if (avatar) {
      $("#nynjacb-self-avatar").attr("src", avatar);
    }

    var starterButton = $("#nynjacb-starter button");
    starterButton.click(function () {
      windowing.show("#nynjacb-about");
    }).addClass("nynjacb-running");
    if (starterButton.text() == "Start NynjaCB") {
      starterButton.attr("data-start-text", starterButton.text());
      starterButton.text("End NynjaCB Session");
    }

    ui.activateAvatarEdit(container, {
      onSave: function () {
        windowing.hide("#nynjacb-avatar-edit");
      }
    });

    NynjaCB.config.track("inviteFromRoom", function (inviter, previous) {
      if (inviter) {
        container.find("#nynjacb-invite").show();
      } else {
        container.find("#nynjacb-invite").hide();
      }
    });

    container.find("#nynjacb-menu-refresh-invite").click(refreshInvite);
    container.find("#nynjacb-menu-invite-anyone").click(function () {
      invite(null);
    });

    // The following lines should be at the end of this function
    // (new code goes above)
    session.emit("new-element", ui.container);

    if (finishedAt && finishedAt > Date.now()) {
      setTimeout(function () {
        finishedAt = null;
        session.emit("ui-ready", ui);
      }, finishedAt - Date.now());
    } else {
      session.emit("ui-ready", ui);
    }

  }; // End ui.activateUI()

  ui.activateAvatarEdit = function (container, options) {
    options = options || {};
    var pendingImage = null;

    container.find(".nynjacb-avatar-save").prop("disabled", true);

    container.find(".nynjacb-avatar-save").click(function () {
      if (pendingImage) {
        peers.Self.update({avatar: pendingImage});
        container.find(".nynjacb-avatar-save").prop("disabled", true);
        if (options.onSave) {
          options.onSave();
        }
      }
    });

    container.find(".nynjacb-upload-avatar").on("change", function () {
      util.readFileImage(this).then(function (url) {
        sizeDownImage(url).then(function (smallUrl) {
          pendingImage = smallUrl;
          container.find(".nynjacb-avatar-preview").css({
            backgroundImage: 'url(' + pendingImage + ')'
          });
          container.find(".nynjacb-avatar-save").prop("disabled", false);
          if (options.onPending) {
            options.onPending();
          }
        });
      });
    });

  };

  function sizeDownImage(imageUrl) {
    return util.Deferred(function (def) {
      var $canvas = $("<canvas>");
      $canvas[0].height = session.AVATAR_SIZE;
      $canvas[0].width = session.AVATAR_SIZE;
      var context = $canvas[0].getContext("2d");
      var img = new Image();
      img.src = imageUrl;
      // Sometimes the DOM updates immediately to call
      // naturalWidth/etc, and sometimes it doesn't; using setTimeout
      // gives it a chance to catch up
      setTimeout(function () {
        var width = img.naturalWidth || img.width;
        var height = img.naturalHeight || img.height;
        width = width * (session.AVATAR_SIZE / height);
        height = session.AVATAR_SIZE;
        context.drawImage(img, 0, 0, width, height);
        def.resolve($canvas[0].toDataURL("image/png"));
      });
    });
  }

  function fixupAvatars(container) {
    /* All <div class="nynjacb-person" /> elements need an element inside,
       so we add that element here */
    container.find(".nynjacb-person").each(function () {
      var $this = $(this);
      var inner = $this.find(".nynjacb-person-avatar-swatch");
      if (! inner.length) {
        $this.append('<div class="nynjacb-person-avatar-swatch"></div>');
      }
    });
  }

  ui.prepareShareLink = function (container) {
    container.find("input.nynjacb-share-link").click(function () {
      $(this).select();
    }).change(function () {
      updateShareLink();
    });
    container.find("a.nynjacb-share-link").click(function () {
      // FIXME: this is currently opening up Bluetooth, not sharing a link
      if (false && window.MozActivity) {
        var activity = new MozActivity({
          name: "share",
          data: {
            type: "url",
            url: $(this).attr("href")
          }
        });
      }
      // FIXME: should show some help if you actually try to follow the link
      // like this, instead of simply suppressing it
      return false;
    });
    updateShareLink();
  };

  // Menu

  function showMenu(event) {
    var el = $("#nynjacb-menu");
    assert(el.length);
    el.show();
    bindMenu();
    $(document).bind("click", maybeHideMenu);
  }

  function bindMenu() {
    var el = $("#nynjacb-menu:visible");
    if (el.length) {
      var bound = $("#nynjacb-profile-button");
      var boundOffset = bound.offset();
      el.css({
        top: boundOffset.top + bound.height() - $window.scrollTop() + "px",
        left: (boundOffset.left + bound.width() - 10 - el.width() - $window.scrollLeft()) + "px"
      });
    }
  }

  function bindPicker() {
    var picker = $("#nynjacb-pick-color:visible");
    if (picker.length) {
      var menu = $("#nynjacb-menu-update-color");
      var menuOffset = menu.offset();
      picker.css({
        top: menuOffset.top + menu.height(),
        left: menuOffset.left
      });
    }
  }

  session.on("resize", function () {
    bindMenu();
    bindPicker();
  });

  function toggleMenu() {
    if ($("#nynjacb-menu").is(":visible")) {
      hideMenu();
    } else {
      showMenu();
    }
  }

  function hideMenu() {
    var el = $("#nynjacb-menu");
    el.hide();
    $(document).unbind("click", maybeHideMenu);
    ui.displayToggle("#nynjacb-self-name-display");
    $("#nynjacb-pick-color").hide();
  }

  function maybeHideMenu(event) {
    var t = event.target;
    while (t) {
      if (t.id == "nynjacb-menu") {
        // Click inside the menu, ignore this
        return;
      }
      t = t.parentNode;
    }
    hideMenu();
  }

  function adjustDockSize(buttons) {
    /* Add or remove spots from the dock; positive number to
       add button(s), negative number to remove button(s)
       */
    assert(typeof buttons == "number");
    assert(buttons && Math.floor(buttons) == buttons);
    var iface = $("#nynjacb-dock");
    var newHeight = iface.height() + (BUTTON_HEIGHT * buttons);
    assert(newHeight >= BUTTON_HEIGHT * 3, "Height went too low (", newHeight,
           "), should never be less than 3 buttons high (", BUTTON_HEIGHT * 3, ")");
    iface.css({
      height: newHeight + "px"
    });
  }

  // Misc

  function updateShareLink() {
    var input = $("input.nynjacb-share-link");
    var link = $("a.nynjacb-share-link");
    var display = $("#nynjacb-session-id");
    if (! session.shareId) {
      input.val("");
      link.attr("href", "#");
      display.text("(none)");
    } else {
      input.val(session.shareUrl());
      link.attr("href", session.shareUrl());
      display.text(session.shareId);
    }
  }

  session.on("close", function () {

    if($.browser.mobile) {
      // remove bg overlay
      //$(".overlay").remove();

      //after hitting End, reset window draggin
      $("body").css({
        "position": "",
        top: "",
        left: ""
      });

    }

    if (ui.container) {
      ui.container.remove();
      ui.container = null;
    }
    // Clear out any other spurious elements:
    $(".nynjacb").remove();
    var starterButton = $("#nynjacb-starter button");
    starterButton.removeClass("nynjacb-running");
    if (starterButton.attr("data-start-text")) {
      starterButton.text(starterButton.attr("data-start-text"));
      starterButton.attr("data-start-text", "");
    }
    if (NynjaCB.startTarget) {
      var el = $(NynjaCB.startTarget);
      if (el.attr("data-start-nynjacb-html")) {
        el.html(el.attr("data-start-nynjacb-html"));
      }
      el.removeClass("nynjacb-started");
    }
  });

  ui.chat = {
    text: function (attrs) {
      assert(typeof attrs.text == "string");
      assert(attrs.peer);
      assert(attrs.messageId);
      var date = attrs.date || Date.now();
      var lastEl = ui.container.find("#nynjacb-chat .nynjacb-chat-message");
      if (lastEl.length) {
        lastEl = $(lastEl[lastEl.length-1]);
      }
      var lastDate = null;
      if (lastEl) {
        lastDate = parseInt(lastEl.attr("data-date"), 10);
      }
      if (lastEl && lastEl.attr("data-person") == attrs.peer.id &&
          lastDate && date < lastDate + COLLAPSE_MESSAGE_LIMIT) {
        lastEl.attr("data-date", date);
        var content = lastEl.find(".nynjacb-chat-content");
        assert(content.length);
        attrs.text = content.text() + "\n" + attrs.text;
        attrs.messageId = lastEl.attr("data-message-id");
        lastEl.remove();
      }
      var el = templating.sub("chat-message", {
        peer: attrs.peer,
        content: attrs.text,
        date: date
      });
      linkify(el.find(".nynjacb-chat-content"));
      el.attr("data-person", attrs.peer.id)
        .attr("data-date", date)
        .attr("data-message-id", attrs.messageId);
      ui.chat.add(el, attrs.messageId, attrs.notify);
    },

    joinedSession: function (attrs) {
      assert(attrs.peer);
      var date = attrs.date || Date.now();
      var el = templating.sub("chat-joined", {
        peer: attrs.peer,
        date: date
      });
      // FIXME: should bind the notification to the dock location
      ui.chat.add(el, attrs.peer.className("join-message-"), 4000);
    },

    leftSession: function (attrs) {
      assert(attrs.peer);
      var date = attrs.date || Date.now();
      var el = templating.sub("chat-left", {
        peer: attrs.peer,
        date: date,
        declinedJoin: attrs.declinedJoin
      });
      // FIXME: should bind the notification to the dock location
      ui.chat.add(el, attrs.peer.className("join-message-"), 4000);
    },

    system: function (attrs) {
      assert(! attrs.peer);
      assert(typeof attrs.text == "string");
      var date = attrs.date || Date.now();
      var el = templating.sub("chat-system", {
        content: attrs.text,
        date: date
      });
      ui.chat.add(el, undefined, true);
    },

    clear: deferForContainer(function () {
      var container = ui.container.find("#nynjacb-chat-messages");
      container.empty();
    }),

    urlChange: function (attrs) {
      assert(attrs.peer);
      assert(typeof attrs.url == "string");
      assert(typeof attrs.sameUrl == "boolean");
      var messageId = attrs.peer.className("url-change-");
      // FIXME: duplicating functionality in .add():
      var realId = "nynjacb-chat-" + messageId;
      var date = attrs.date || Date.now();
      var title;
      // FIXME: strip off common domain from msg.url?  E.g., if I'm on
      // http://example.com/foobar, and someone goes to http://example.com/baz then
      // show only /baz
      // FIXME: truncate long titles
      if (attrs.title) {
        title = attrs.title + " (" + attrs.url + ")";
      } else {
        title = attrs.url;
      }
      var el = templating.sub("url-change", {
        peer: attrs.peer,
        date: date,
        href: attrs.url,
        title: title,
        sameUrl: attrs.sameUrl
      });
      el.find(".nynjacb-nudge").click(function () {
        attrs.peer.nudge();
        return false;
      });
      el.find(".nynjacb-follow").click(function () {
        var url = attrs.peer.url;
        if (attrs.peer.urlHash) {
          url += attrs.peer.urlHash;
        }
        location.href = url;
      });
      var notify = ! attrs.sameUrl;
      if (attrs.sameUrl && ! $("#" + realId).length) {
        // Don't bother showing a same-url notification, if no previous notification
        // had been shown
        return;
      }
      ui.chat.add(el, messageId, notify);
    },

    invite: function (attrs) {
      assert(attrs.peer);
      assert(typeof attrs.url == "string");
      var messageId = attrs.peer.className("invite-");
      var date = attrs.date || Date.now();
      var hrefTitle = attrs.url.replace(/\#?&nynjacb=.*/, "").replace(/^\w+:\/\//, "");
      var el = templating.sub("invite", {
        peer: attrs.peer,
        date: date,
        href: attrs.url,
        hrefTitle: hrefTitle,
        forEveryone: attrs.forEveryone
      });
      if (attrs.forEveryone) {
        el.find("a").click(function () {
          // FIXME: hacky way to do this:
          chat.submit("Followed link to " + attrs.url);
        });
      }
      ui.chat.add(el, messageId, true);
    },

    hideTimeout: null,

    add: deferForContainer(function (el, id, notify) {
      if (id) {
        el.attr("id", "nynjacb-chat-" + util.safeClassName(id));
      }
      var container = ui.container.find("#nynjacb-chat-messages");
      assert(container.length);
      var popup = ui.container.find("#nynjacb-chat-notifier");
      container.append(el);
      ui.chat.scroll();
      var doNotify = !! notify;
      var section = popup.find("#nynjacb-chat-notifier-message");
      if (notify && visibilityApi.hidden()) {
        ui.container.find("#nynjacb-notification")[0].play();
      }
      if (id && section.data("message-id") == id) {
        doNotify = true;
      }
      if (container.is(":visible")) {
        doNotify = false;
      }
      if (doNotify) {
        section.empty();
        section.append(el.clone(true, true));
        if (section.data("message-id") != id)  {
          section.data("message-id", id || "");
          windowing.show(popup);
        } else if (! popup.is(":visible")) {
          windowing.show(popup);
        }
        if (typeof notify == "number") {
          // This is the amount of time we're supposed to notify
          if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
          }
          this.hideTimeout = setTimeout((function () {
            windowing.hide(popup);
            this.hideTimeout = null;
          }).bind(this), notify);
        }
      }
    }),

    scroll: deferForContainer(function () {
      var container = ui.container.find("#nynjacb-chat-messages")[0];
      container.scrollTop = container.scrollHeight;
    })

  };

  session.on("display-window", function (id, win) {
    if (id == "nynjacb-chat") {
      ui.chat.scroll();
      windowing.hide("#nynjacb-chat-notifier");
    }
  });

  /* This class is bound to peers.Peer instances as peer.view.
     The .update() method is regularly called by peer objects when info changes. */
  ui.PeerView = util.Class({

    constructor: function (peer) {
      assert(peer.isSelf !== undefined, "PeerView instantiated with non-Peer object");
      this.peer = peer;
      this.dockClick = this.dockClick.bind(this);
    },

    /* Takes an element and sets any person-related attributes on the element
       Different from updates, which use the class names we set here: */
    setElement: function (el) {
      var count = 0;
      var classes = ["nynjacb-person", "nynjacb-person-status",
                     "nynjacb-person-name", "nynjacb-person-name-abbrev",
                     "nynjacb-person-bgcolor", "nynjacb-person-swatch",
                     "nynjacb-person-status", "nynjacb-person-role",
                     "nynjacb-person-url", "nynjacb-person-url-title",
                     "nynjacb-person-bordercolor"];
      classes.forEach(function (cls) {
        var els = el.find("." + cls);
        els.addClass(this.peer.className(cls + "-"));
        count += els.length;
      }, this);
      if (! count) {
        console.warn("setElement(", el, ") doesn't contain any person items");
      }
      this.updateDisplay(el);
    },

    updateDisplay: deferForContainer(function (container) {
      container = container || ui.container;
      var abbrev = this.peer.name;
      if (this.peer.isSelf) {
        abbrev = "me";
      }
      container.find("." + this.peer.className("nynjacb-person-name-")).text(this.peer.name || "");
      container.find("." + this.peer.className("nynjacb-person-name-abbrev-")).text(abbrev);
      var avatarEl = container.find("." + this.peer.className("nynjacb-person-"));
      if (this.peer.avatar) {
        util.assertValidUrl(this.peer.avatar);
        avatarEl.css({
          backgroundImage: "url(" + this.peer.avatar + ")"
        });
      }
      if (this.peer.idle == "inactive") {
        avatarEl.addClass("nynjacb-person-inactive");
      } else {
        avatarEl.removeClass("nynjacb-person-inactive");
      }
      avatarEl.attr("title", this.peer.name);
      if (this.peer.color) {
        avatarEl.css({
          borderColor: this.peer.color
        });
        avatarEl.find(".nynjacb-person-avatar-swatch").css({
          borderTopColor: this.peer.color,
          borderRightColor: this.peer.color
        });
      }
      if (this.peer.color) {
        var colors = container.find("." + this.peer.className("nynjacb-person-bgcolor-"));
        colors.css({
          backgroundColor: this.peer.color
        });
        colors = container.find("." + this.peer.className("nynjacb-person-bordercolor-"));
        colors.css({
          borderColor: this.peer.color
        });
      }
      container.find("." + this.peer.className("nynjacb-person-role-"))
        .text(this.peer.isCreator ? "Creator" : "Participant");
      var urlName = this.peer.title || "";
      if (this.peer.title) {
        urlName += " (";
      }
      urlName += util.truncateCommonDomain(this.peer.url, location.href);
      if (this.peer.title) {
        urlName += ")";
      }
      container.find("." + this.peer.className("nynjacb-person-url-title-"))
        .text(urlName);
      var url = this.peer.url;
      if (this.peer.urlHash) {
        url += this.peer.urlHash;
      }
      container.find("." + this.peer.className("nynjacb-person-url-"))
        .attr("href", url);
      // FIXME: should have richer status:
      container.find("." + this.peer.className("nynjacb-person-status-"))
        .text(this.peer.idle == "active" ? "Active" : "Inactive");
      if (this.peer.isSelf) {
        // FIXME: these could also have consistent/reliable class names:
        var selfName = $(".nynjacb-self-name");
        selfName.each((function (index, el) {
          el = $(el);
          if (el.val() != this.peer.name) {
            el.val(this.peer.name);
          }
        }).bind(this));
        $("#nynjacb-menu-avatar").attr("src", this.peer.avatar);
        if (! this.peer.name) {
          $("#nynjacb-menu .nynjacb-person-name-self").text(this.peer.defaultName);
        }
      }
      if (this.peer.url != session.currentUrl()) {
        container.find("." + this.peer.className("nynjacb-person-"))
            .addClass("nynjacb-person-other-url");
      } else {
        container.find("." + this.peer.className("nynjacb-person-"))
            .removeClass("nynjacb-person-other-url");
      }
      if (this.peer.following) {
        if (this.followCheckbox) {
          this.followCheckbox.prop("checked", true);
        }
      } else {
        if (this.followCheckbox) {
          this.followCheckbox.prop("checked", false);
        }
      }
      // FIXME: add some style based on following?
      updateChatParticipantList();
      this.updateFollow();
    }),

    update: function () {
      if (! this.peer.isSelf) {
        if (this.peer.status == "live") {
          this.dock();
        } else {
          this.undock();
        }
      }
      this.updateDisplay();
      this.updateUrlDisplay();
    },

    updateUrlDisplay: function (force) {
      var url = this.peer.url;
      if ((! url) || (url == this._lastUpdateUrlDisplay && ! force)) {
        return;
      }
      this._lastUpdateUrlDisplay = url;
      var sameUrl = url == session.currentUrl();
      ui.chat.urlChange({
        peer: this.peer,
        url: this.peer.url,
        title: this.peer.title,
        sameUrl: sameUrl
      });
    },

    urlNudge: function () {
      // FIXME: do something more distinct here
      this.updateUrlDisplay(true);
    },

    notifyJoined: function () {
      ui.chat.joinedSession({
        peer: this.peer
      });
    },

    // when there are too many participants in the dock, consolidate the participants to one avatar, and on mouseOver, the dock expands down to reveal the rest of the participants
    // if there are X users in the session
    // then hide the users in the dock
    // and shrink the size of the dock
    // and if you rollover the dock, it expands and reveals the rest of the participants in the dock

    //if users hit X then show the participant button with the consol

    dock: deferForContainer(function () {

      var numberOfUsers = peers.getAllPeers().length;

      // collapse the Dock if too many users
      function CollapsedDock() {
        // decrease/reset dock height
        $("#nynjacb-dock").css("height", 260);
        //replace participant button
        $("#nynjacb-dock-participants").replaceWith("<button id='nynjacb-participantlist-button' class='nynjacb-button'><div class='nynjacb-tooltip nynjacb-dock-person-tooltip'><span class='nynjacb-person-name'>Participants</span><span class='nynjacb-person-tooltip-arrow-r'></span></div><div class='nynjacb-person nynjacb-person-status-overlay' title='Participant List' style='background-image: url("+NynjaCB.baseUrl+"/nynjacb/images/robot-avatar.png); border-color: rgb(255, 0, 0);'></div></button>");
        // new full participant window created on toggle
        $("#nynjacb-participantlist-button").click(function () {
          windowing.toggle("#nynjacb-participantlist");
        });
      }

      // FIXME: turned off for now
      if( numberOfUsers >= 5 && false) {
        CollapsedDock();
      } else {
        // reset

      }


      if (this.dockElement) {
        return;
      }
      this.dockElement = templating.sub("dock-person", {
        peer: this.peer
      });
      this.dockElement.attr("id", this.peer.className("nynjacb-dock-element-"));
      ui.container.find("#nynjacb-dock-participants").append(this.dockElement);
      this.dockElement.find(".nynjacb-person").animateDockEntry();
      adjustDockSize(1);
      this.detailElement = templating.sub("participant-window", {
        peer: this.peer
      });
      var followId = this.peer.className("nynjacb-person-status-follow-");
      this.detailElement.find('[for="nynjacb-person-status-follow"]').attr("for", followId);
      this.detailElement.find('#nynjacb-person-status-follow').attr("id", followId);
      this.detailElement.find(".nynjacb-follow").click(function () {
        location.href = $(this).attr("href");
      });
      this.detailElement.find(".nynjacb-nudge").click((function () {
        this.peer.nudge();
      }).bind(this));
      this.followCheckbox = this.detailElement.find("#" + followId);
      this.followCheckbox.change(function () {
        if (! this.checked) {
          this.peer.unfollow();
        }
        // Following doesn't happen until the window is closed
        // FIXME: should we tell the user this?
      });
      this.maybeHideDetailWindow = this.maybeHideDetailWindow.bind(this);
      session.on("hide-window", this.maybeHideDetailWindow);
      ui.container.append(this.detailElement);
      this.dockElement.click((function () {
        if (this.detailElement.is(":visible")) {
          windowing.hide(this.detailElement);
        } else {
          windowing.show(this.detailElement, {bind: this.dockElement});
          this.scrollTo();
          this.cursor().element.animate({
            opacity:0.3
          }).animate({
            opacity:1
          }).animate({
            opacity:0.3
          }).animate({
            opacity:1
          });
        }
      }).bind(this));
      this.updateFollow();
    }),

    undock: function () {
      if (! this.dockElement) {
        return;
      }
      this.dockElement.animateDockExit().promise().then((function () {
        this.dockElement.remove();
        this.dockElement = null;
        this.detailElement.remove();
        this.detailElement = null;
        adjustDockSize(-1);
      }).bind(this));
    },

    scrollTo: function () {
      if (this.peer.url != session.currentUrl()) {
        return;
      }
      var pos = this.peer.scrollPosition;
      if (! pos) {
        console.warn("Peer has no scroll position:", this.peer);
        return;
      }
      pos = elementFinder.pixelForPosition(pos);
      $("html, body").easeTo(pos);
    },

    updateFollow: function () {
      if (! this.peer.url) {
        return;
      }
      if (! this.detailElement) {
        return;
      }
      var same = this.detailElement.find(".nynjacb-same-url");
      var different = this.detailElement.find(".nynjacb-different-url");
      if (this.peer.url == session.currentUrl()) {
        same.show();
        different.hide();
      } else {
        same.hide();
        different.show();
      }
    },

    maybeHideDetailWindow: function (windows) {
      if (this.detailElement && windows[0] && windows[0][0] === this.detailElement[0]) {
        if (this.followCheckbox[0].checked) {
          this.peer.follow();
        } else {
          this.peer.unfollow();
        }
      }
    },

    dockClick: function () {
      // FIXME: scroll to person
    },

    cursor: function () {
      return require("cursor").getClient(this.peer.id);
    },

    destroy: function () {
      // FIXME: should I get rid of the dockElement?
      session.off("hide-window", this.maybeHideDetailWindow);
    }
  });

  function updateChatParticipantList() {
    var live = peers.getAllPeers(true);
    if (live.length) {
      ui.displayToggle("#nynjacb-chat-participants");
      $("#nynjacb-chat-participant-list").text(
        live.map(function (p) {return p.name;}).join(", "));
    } else {
      ui.displayToggle("#nynjacb-chat-no-participants");
    }
  }

  function inviteHubUrl() {
    var base = nynjacb.config.get("inviteFromRoom");
    assert(base);
    return util.makeUrlAbsolute(base, session.hubUrl());
  }

  var inRefresh = false;

  function refreshInvite() {
    if (inRefresh) {
      return;
    }
    inRefresh = true;
    require(["who"], function (who) {
      var def = who.getList(inviteHubUrl());
      function addUser(user, before) {
        var item = templating.sub("invite-user-item", {peer: user});
        item.attr("data-clientid", user.id);
        if (before) {
          item.insertBefore(before);
        } else {
          $("#nynjacb-invite-users").append(item);
        }
        item.click(function() {
          invite(user.clientId);
        });
      }
      function refresh(users, finished) {
        var sorted = [];
        for (var id in users) {
          if (users.hasOwnProperty(id)) {
            sorted.push(users[id]);
          }
        }
        sorted.sort(function (a, b) {
          return a.name < b.name ? -1 : 1;
        });
        var pos = 0;
        ui.container.find("#nynjacb-invite-users .nynjacb-menu-item").each(function () {
          var $this = $(this);
          if (finished && ! users[$this.attr("data-clientid")]) {
            $this.remove();
            return;
          }
          if (pos >= sorted.length) {
            return;
          }
          while (pos < sorted.length && $this.attr("data-clientid") !== sorted[pos].id) {
            addUser(sorted[pos], $this);
            pos++;
          }
          while (pos < sorted.length && $this.attr("data-clientid") == sorted[pos].id) {
            pos++;
          }
        });
        for (var i=pos; i<sorted.length; i++) {
          addUser(sorted[pos]);
        }
      }
      def.then(function (users) {
        refresh(users, true);
        inRefresh = false;
      });
      def.progress(refresh);
    });
  }

  session.hub.on("invite", function (msg) {
    if (msg.forClientId && msg.clientId != peers.Self.id) {
      return;
    }
    require(["who"], function (who) {
      var peer = who.ExternalPeer(msg.userInfo.clientId, msg.userInfo);
      ui.chat.invite({peer: peer, url: msg.url, forEveryone: ! msg.forClientId});
    });
  });

  function invite(clientId) {
    require(["who"], function (who) {
      // FIXME: use the return value of this to give a signal that
      // the invite has been successfully sent:
      who.invite(inviteHubUrl(), clientId).then(function () {
        hideMenu();
      });
    });
  }

  ui.showUrlChangeMessage = deferForContainer(function (peer, url) {
    var window = templating.sub("url-change", {peer: peer});
    ui.container.append(window);
    windowing.show(window);
  });

  session.hub.on("url-change-nudge", function (msg) {
    if (msg.to && msg.to != session.clientId) {
      // Not directed to us
      return;
    }
    msg.peer.urlNudge();
  });

  session.on("new-element", function (el) {
    if (nynjacb.config.get("toolName")) {
      ui.updateToolName(el);
    }
  });

  var setToolName = false;
  ui.updateToolName = function (container) {
    container = container || $(document.body);
    var name = nynjacb.config.get("toolName");
    if (setToolName && ! name) {
      name = "nynjacb";
    }
    if (name) {
      container.find(".nynjacb-tool-name").text(name);
      setToolName = true;
    }
  };

  nynjacb.config.track("toolName", function (name) {
    ui.updateToolName(ui.container);
  });

  return ui;

});
