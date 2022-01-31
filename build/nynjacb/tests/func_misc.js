// =SECTION Setup

$("#other").remove();

Test.require("ui", "chat", "util", "session", "jquery", "storage", "peers", "cursor", "windowing", "templates-en-US");
// => Loaded modules: ...

Test.normalStartup();

/* =>
Settings reset
NynjaCB started
send: hello
  avatar: "...default-avatar.png",
  clientId: "...",
  clientVersion: "...",
  color: "...",
  isClient: false,
  name: "...",
  rtcSupported: ?,
  starting: true,
  title: "...",
  url: "...",
  urlHash: "..."
Walkthrough closed
 */

printResolved(storage.settings.get("seenIntroDialog"));

// => true

// =SECTION Peer handling

Test.viewSend.deactivate();
Test.newPeer();
wait(500);

// =>

Test.incoming({
  type: "cursor-update",
  clientId: "faker",
  top: 100,
  left: 100
});

wait(300);

// =>

var fakeCursor = NynjaCBTestSpy.Cursor.getClient("faker");
print(fakeCursor.element && fakeCursor.element.is(":visible"));

// => true

var faker = peers.getPeer("faker");
print(faker);

// => Peer("faker")

print(faker.status, faker.idle, faker.view.dockElement && faker.view.dockElement.is(":visible"));

// => live active true

Test.incoming({
  type: "chat",
  text: "Test message",
  clientId: "faker",
  messageId: "message1"
});
wait(100);

// =>

print($("#nynjacb-chat-notifier").is(":visible"));

// => true

print($("#nynjacb-chat-notifier")[0]);

/* =>
...
<div class="nynjacb-person nynjacb-person-faker"...>
...
<div class="nynjacb-person-name-abbrev nynjacb-person-name-abbrev-faker">Faker</div>
<div class="nynjacb-chat-content">Test message</div>
...
*/

$("#nynjacb-chat-button").click();

// We need a wait here for the animation to finish:
wait(1000);

// =>

print($("#nynjacb-chat-notifier").is(":visible"), $("#nynjacb-chat").is(":visible"));

// => false true

Test.viewSend.activate();
$("#nynjacb-chat-input").val("outgoing message");
NynjaCBTestSpy.submitChat();

/* =>
send: chat
  clientId: "me",
  messageId: "...",
  text: "outgoing message"
*/

print($("#nynjacb-chat-input").val() === "");
// => true

print($("#nynjacb-chat")[0]);
/* =>
...
<div class="nynjacb-chat-content">outgoing message</div>
...
*/

windowing.hide();
$("#nynjacb-profile-button").click();
print($("#nynjacb-menu").is(":visible"), $("#nynjacb-menu .nynjacb-self-name").is(":visible"));
// => true false
$("#nynjacb-menu-update-name").click();
print($("#nynjacb-menu .nynjacb-self-name").is(":visible"));
// => true
$("#nynjacb-menu .nynjacb-self-name").val("Joe");
// First we do a keyup to trigger the change event:

$("#nynjacb-menu .nynjacb-self-name").trigger("keyup");
// Then we submit:
$("#nynjacb-menu .nynjacb-self-name").trigger($.Event("keyup", {which: 13}));
print(peers.Self.name);
print($("#nynjacb-menu").is(":visible"), $("#nynjacb-menu .nynjacb-self-name").is(":visible"));
print($("#NynjaCB-self-name-display").text());
/* =>
send: peer-update
  clientId: "me",
  name: "Joe"
Joe
true false
Joe
*/

// =SECTION Scrolling and participant screen

var lastEl = $('<div id="last-element" />');
$(document.body).append(lastEl);
var dockEl = peers.getPeer("faker").view.dockElement;
var partEl = peers.getPeer("faker").view.detailElement;
print("Starts visible:", partEl.is(":visible"));
Test.incoming({
  type: "scroll-update",
  position: {
    location: "#last-element",
    offset: 0
  },
  clientId: "faker"
});
var prevPos = $(window).scrollTop();
dockEl.click();
wait(400);
// => Starts visible: false
var curPos = $(window).scrollTop();
print("Moved from:", prevPos, "to:", curPos, "same?", prevPos == curPos);
window.scrollTo(0, prevPos);
print("Ends visible:", partEl.is(":visible"));
/* =>
Moved from: ? to: ? same? false
Ends visible: true
*/


// =SECTION Attic

/****************************************
 * Skipping these for now, because leaving the client in place is handy:
 */

/*
Test.incoming({
  type: "bye",
  clientId: "faker"
});

wait(100);

// =>

print(faker.status, faker.idle, faker.dockElement && faker.dockElement.is(":visible"));

// => bye active undefined

print(fakeCursor.element && fakeCursor.element.is(":visible"));

// => false
*/
