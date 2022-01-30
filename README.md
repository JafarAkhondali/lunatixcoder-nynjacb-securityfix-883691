NynjaCB - Surprisingly easy collaboration
============================================

What is NynjaCB?
-----------------

NynjaCB is a service for your website that makes it surprisingly easy to collaborate in real-time.

Using NynjaCB two people can interact on the same page, seeing each other's cursors, edits, and browsing a site together.  The NynjaCB service is included by the web site owner, and a web site can customize and configure aspects of NynjaCB's behavior on the site.

For more information and to see NynjaCB in action, visit [nynjacb.com](https://nynjacb.com/)

If you want to integrate NynjaCB onto your site see [the wiki](https://github.com/mozilla/nynjacb/wiki) and specifically [Getting Started](https://github.com/mozilla/nynjacb/wiki/Developers:-Getting-Started).

Contributing
============

The remainder of this document is about contributing to NynjaCB - but reports, fixes, features, etc.  Look back at those other links if you are looking for something else.

Bug Reports
-----------

Please submit bug reports as [github issues](https://github.com/mozilla/nynjacb/issues/new).  Don't worry about labels or milestones.  If you use the in-app feedback to give us a bug report that's fine too.

Roadmap & Plans
---------------

To see what we're planning or at least considering to do with NynjaCB, look at [see our bug tracker](https://github.com/NynjaMC/nynjacb/issues?state=open).

Setting up a development environment
------------------------------------

NynjaCB has two main pieces:

* The [server](https://github.com/mozilla/nynjacb/blob/develop/hub/server.js), which echos messages back and forth between users.  The server doesn't do much, you may gaze upon its incredibly boring [history](https://github.com/mozilla/nynjacb/commits/develop/hub/server.js).

* The client in [`nynjacb/`](https://github.com/mozilla/nynjacb/tree/develop/nynjacb) which does all the real work.

There is a NynjaCB hub server deployed at `https://hub.nynjacb.com` - and there's little need for other server deployments.  If you want to try NynjaCB out we recommend you use our hub server.  Note if you include NynjaCB on an https site, you must use an https hub server.

The files need to be lightly "built": we use [LESS](http://lesscss.org/) for styles, and a couple files are generated.  To develop you need to build the library using [Grunt](http://gruntjs.com/).

To build a copy of the library, check out NynjaCB:

```sh
$ git clone git://github.com/mozilla/nynjacb.git
$ cd nynjacb
```

Then [install npm](http://nodejs.org/download/) and run:

```sh
$ npm install
$ npm install -g grunt-cli
```

This will install a bunch of stuff, most of which is only used for development.  The only "server" dependency is [WebSocket-Node](https://github.com/Worlize/WebSocket-Node) (and if you use our hub then you don't need to worry about the server).  By default everything is installed locally, i.e., in `node_modules/`.  This works just fine, but it is useful to install the `grunt` command-line program globally, which `npm install -g grunt-cli` does.

Now you can build NynjaCB, like:

```sh
$ grunt build buildsite --no-hardlink
```

This will create a copy of the entire `nynjacb.com` site in `build/`.  You'll need to setup a local web server of your own pointed to the `build/` directory. To start a server on port 8080, run:

```sh
$ node devserver.js
```

If you want to develop with NynjaCB you probably want the files built continually.  To do this use:

```sh
$ grunt devwatch
```

This will rebuild when changes are detected.  Note that Grunt is configured to create [hard links](http://en.wikipedia.org/wiki/Hard_link) instead of copying so that most changes you make to files in `nynjacb/` don't need to be rebuilt to show up in `build/nynjacb/`.  `--no-hardlink` turns this behavior off.

You may wish to create a static copy of the NynjaCB client to distribute and use on your website.  To do this run:

```sh
$ grunt build --base-url https://myapp.com --no-hardlink --dest static-myapp
```

Then `static-myapp/nynjacb.js` and `static-myapp/nynjacb-min.js` will be in place, and the rest of the code will be under `static-myapp/nynjacb/`.  You would deploy these on your server.

Running a local server
----------------------
You shouldn't need to run your own version of the hub server.  But if you
happen to make changes to the server, you can change the default hub
URL by setting the HUB_URL environment variable when building.  For example:
```
$ HUB_URL=http://localhost:8080 grunt devwatch
```

Testing
-------

Tests are in `nynjacb/tests/` -- these are [doctest.js](http://doctestjs.org/) tests.  To actually run the tests build nynjacb, serve it up, and go to `http://localhost:PORT/nynjacb/tests/` -- from there the tests are linked to from the top of the page.  The actual tests are `*.js` files in `nynjacb/tests/`, generally `test_*.js` for unit-style tests, and `func_*.js` for functional tests.

The "Manual testing" link is something that lets you simulate different conditions in NynjaCB without setting up a second browser/client.

There is unfortunately no automated runner for these tests.  It might be nice if [Karma](http://karma-runner.github.io/) could be setup with doctest.js in general, but so far that isn't done.

License
-------

This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at [http://mozilla.org/MPL/2.0/](http://mozilla.org/MPL/2.0/).
