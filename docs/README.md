# Komodo Documentation Readme

Extract komodo_doc.zip. This file contains the markdown files and themes (css, javascript, etc.) for Komodo 11 and Komodo 12. It also includes macOS version of [Hugo](https://gohugo.io) the static site generator used to create the Komodo 11 and 12 sites. The version used is v0.26. You can download the executable for other platforms here: [v0.26](https://github.com/gohugoio/hugo/releases/tag/v0.26). 

To run a hugo website locally:

1. Copy the `hugo` executable to a directory on your PATH. For example, copy it to `/usr/local/bin`.
2. Open a command prompt and navigate to the root of the website folder. For example, `komodo_doc/komodo_12`
3. Enter `hugo server`.
4. Open your web browser and navigate to http://localhost:1313

To generate the set of static files for the website:

1. Copy the `hugo` executable to a directory on your PATH. For example, copy it to `/usr/local/bin`.
2. Open a command prompt and navigate to the root of the website folder. For example, `komodo_doc/komodo_12`
3. Enter `hugo`. By default all of the static files for the website are written to the `public` folder.
4. Copy all the static files from the public folder to the folder your webserver serves files from. For example, `/var/www/` on an Apache server.

## Important files and directories

/config.yaml                      Stores site configuration and the main menu entries
/content/                         Stores the markdown and HTML files 
/layouts/                         Customized page templates that differ from the defaults in the 
                                  theme layout
/static/images/                   Screenshots and other site images
/static/javascripts/              Customized javascript. Mainly just an override of the default theme 
                                  to support search
/static/sdk/                      Separately generated SDK reference documentation
/static/stylesheets/              CSS stylesheets that override default theme files.
/themes/hugo-material-docs/       The Hugo theme used by the Komodo docs websites is [here](https://github.com/digitalcraftsman/hugo-material-docs)

## SDK Docs
To generate the SDK docs we've used [JSDoc](http://usejsdoc.org/index.html)

### Generate New SDK Docs
- `npm install -g jsdoc`
- `jsdoc src/chrome/komodo/content/sdk -r -d some/dir/`