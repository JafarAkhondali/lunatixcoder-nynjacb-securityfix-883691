// =SECTION Setup

function visible() {
  Array.prototype.slice.call(arguments).forEach(function (s) {
    var el = $(s);
    var status;
    if (! el.length) {
      status = "does not exist";
    } else if (el.is(":visible")) {
      status = "visible";
    } else {
      status = "hidden";
    }
    print(s, ":", status);
  });
}

Test.require("ui", "chat", "util", "session", "jquery", "storage", "peers", "cursor", "windowing", "templates-en-US");
// => Loaded modules: ...

Test.normalStartup();

// => ...

Test.newPeer();

// => ...

visible("#nynjacb-chat-notifier");

// => #nynjacb-chat-notifier : visible

$("#nynjacb-chat-notifier .nynjacb-dismiss").click();

Test.incoming({
  type: "chat",
  clientId: "faker",
  text: "Test",
  messageId: "test-message"
});

// => ...

visible("#nynjacb-chat-notifier", "#nynjacb-chat");

/* =>
#nynjacb-chat-notifier : visible
#nynjacb-chat : hidden
*/

$("#nynjacb-chat-button").click();
// The animation makes this take a while:
// (We could check $("#nynjacb-chat-notifier").queue().length though)
wait(function () {return ! $("#nynjacb-chat-notifier").is(":visible");});
// =>
visible("#nynjacb-chat-notifier", "#nynjacb-chat");

/* =>
#nynjacb-chat-notifier : hidden
#nynjacb-chat : visible
*/

$("#nynjacb-chat .nynjacb-close").click();
visible("#nynjacb-chat-notifier", "#nynjacb-chat");

/* =>
#nynjacb-chat-notifier : hidden
#nynjacb-chat : hidden
*/

$("#nynjacb-chat-button").click();

Test.incoming({
  type: "chat",
  clientId: "faker",
  text: "Test 2",
  messageId: "test-message"
});
visible("#nynjacb-chat-notifier", "#nynjacb-chat");

/* =>
#nynjacb-chat-notifier : hidden
#nynjacb-chat : visible
*/

$("#nynjacb-chat .nynjacb-close").click();
Test.incoming({
  type: "bye",
  clientId: "faker"
});

// =>

visible("#nynjacb-chat-notifier", "#nynjacb-chat");

/* =>
#nynjacb-chat-notifier : visible
#nynjacb-chat : hidden
*/

// Now we'll bring back the user:
Test.newPeer({url: "http://example.com/foo"});

// => ...

visible(".nynjacb-follow");

/* =>
.nynjacb-follow : visible
*/

$(".nynjacb-nudge").click();

/* =>
send: url-change-nudge
  clientId: "me",
  to: "faker",
  url: "..."

 */

// =SECTION Helpers

Test.addControl('<div>Some perhaps helpful test buttons to trigger events (not all combos are valid):</div>');

Test.addControl($("<button>Faker Rejoin</button>").click(function () {
  Test.newPeer();
}));

Test.addControl($("<button>Join Random New Faker</button>").click(function () {
  var id = Math.floor(Math.random() * 1000);
  Test.newPeer({
    name: "Faker " + id,
    clientId: "random-" + id
  });
}));

Test.addControl($('<input placeholder="Change Faker URL">').keypress(function (ev) {
  if (ev.which == 13) {
    Test.newPeer({url: ev.target.value});
    ev.target.value = "";
  }
}));

Test.addControl($('<button>Faker Leave</button>').click(function () {
  Test.incoming({
    type: "bye",
    clientId: "faker"
  });
}));

Test.addControl($('<button>Faker decline</button>').click(function () {
  Test.incoming({
    type: "bye",
    clientId: "faker",
    reason: "declined-join"
  });
}));

Test.addControl($('<button>Nudge Me</button>').click(function () {
  Test.incoming({
    type: "url-change-nudge",
    clientId: "faker",
    url: peers.getPeer("faker").url,
    to: peers.Self.id
  });
}));

Test.addControl($('<button>Keyboard</button>').click(function () {
  Test.incoming({
    type: "keydown",
    clientId: "faker"
  });
}));

Test.addControl($('<button>Participant down page (cursor rotate)</button>').click(function () {

  $('.nynjacb-cursor svg').animate({borderSpacing: -150, opacity: 1}, {
    step: function(now, fx) {
      if (fx.prop == "borderSpacing") {
        $(this).css('-webkit-transform', 'rotate('+now+'deg)')
          .css('-moz-transform', 'rotate('+now+'deg)')
          .css('-ms-transform', 'rotate('+now+'deg)')
          .css('-o-transform', 'rotate('+now+'deg)')
          .css('transform', 'rotate('+now+'deg)');
      } else {
        $(this).css(fx.prop, now);
      }
    },
    duration: 500
  }, 'linear').promise().then(function () {
    this.css('-webkit-transform', '');
    this.css('-moz-transform', '');
    this.css('-ms-transform', '');
    this.css('-o-transform', '');
    this.css('transform', '');
    this.css("opacity", "");
  });

  // Test.incoming({
  //   type: "keydown",
  //   clientId: "faker"
  // });
}));
