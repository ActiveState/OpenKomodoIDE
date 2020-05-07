# Komodo Collaboration Socket Server

(a.k.a. komob socket server, Collaboration Push Server)
This is a component of the Komodo Collaboration infrastructure that handles the
dispatch of push notifications for certain events to the Komodo Collaboration
clients. It is written in node.js and uses Socket.IO.


## Installation

Clone this repository and install node >= 0.4.1 from
[nodejs.org](http://nodejs.org). All external dependencies are included in the
`node_modules` directory, which was created from the requirements specified in
`package.json` using `npm install`.


## Running the application

Start the application as a daemon with `nohup ./server.js &`. You can
administrate the application with `./server.js <command>`. Valid commands are
e.g. `status`, `shutdown`, `stop`.

If you prefer to run from a node REPL, do
    var app=require('./app');
    app.listen(<port>);


## Configuration

The application needs a `config.js` configuration file. Refer to the template
files `config.js.production` and `config.js.test` for the required information.


## Updating dependencies

Since version 1.0 of `npm`, `package.json` dependencies are installed locally, 
that is into the `node_modules` directory inside the package. To ease server 
deployment, all the dependencies are commited to the repository. If you want to 
update one of the dependencies to a new version, you can follow this recipe:

 - Start with a clean repository
 - Make change to `dependencies` in `package.json`
 - `npm rm <package>` if you want do delete an old version of that package first.
 - `npm install` to install all unmet dependencies from `package.json`
 - `hg rm -A` to delete files that are missing because you uninstalled (an old 
  version of) a dependency. But be  careful not to delete anything else in the 
  process.
 - `hg add` new files to the repo.
 - Commit