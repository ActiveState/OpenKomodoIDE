(function() {
    const log       = require("ko/logging").getLogger("commando-scope-shell-drush")
    const commando  = require("commando/commando");
    const {Cc, Ci}  = require("chrome");
    const prefs     = require("ko/prefs");
    const shell     = require("scope-shell/shell");
    const shellHelpers = require("scope-shell/helpers");
    const koFile    = require("ko/file");
    const w         = require("ko/windows").getMain();
    const legacy    = w.ko;

    //log.setLevel(require("ko/logging").LOG_DEBUG);
    
    var local = {menuItems: false};
    
    this.register = function()
    {
        // Register the "drush" namespace
        shell.registerNamespace("drush",
        {
            command: function() { return prefs.file().getString("drushDefaultInterpreter", "drush") || "drush"; },
            description: "Execute a drush command.",
            env: {},
            results: this.results
        });
        
        // Inject pref UI
        shellHelpers.injectInterpreterPref({
            basename: 'pref-php.xul',
            siblingSelector: '#defaultPHPInterpreterGroupBox',
            prefname: 'drushDefaultInterpreter',
            caption: 'Drush Location'
        });
    };

    this.results =
    {
        "help": {
            "description": "Print this help message. See `drush help help` for more options."
        },
        "docs-readme": {
            "description": "README.md"
        },
        "docs-examplecommand": {
            "description": "Example Drush command file."
        },
        "docs-scripts": {
            "description": "Shell script overview on writing simple sequences of Drush statements."
        },
        "user-unblock": {
            "description": "Unblock the specified user(s)."
        },
        "docs-bisect": {
            "description": "git bisect and Drush may be used together to find the commit an error was introduced in."
        },
        "updatedb-batch-process": {
            "description": "Perform update functions"
        },
        "search-status": {
            "description": "Show how many items remain to be indexed out of the total."
        },
        "core-cron": {
            "description": "Run all cron hooks in all active modules for specified site."
        },
        "config-import": {
            "description": "Import config from a config directory."
        },
        "site-alias": {
            "description": "Print site alias records for all known site aliases and local sites."
        },
        "php-script": {
            "description": "Run php script(s)."
        },
        "variable-set": {
            "description": "Set a variable."
        },
        "sql-sync": {
            "description": "Copies the database contents from a source site to a target site. Transfers the database dump via rsync."
        },
        "queue-run": {
            "description": "Run a specific queue by name"
        },
        "pm-update": {
            "description": "Update Drupal core and contrib projects and apply any pending database updates (Same as pm-updatecode + updatedb)."
        },
        "pm-enable": {
            "description": "Enable one or more extensions (modules or themes)."
        },
        "docs-configuration": {
            "description": "Configuration overview with examples from example.drushrc.php."
        },
        "pm-updatecode": {
            "description": "Update Drupal core and contrib projects to latest recommended releases."
        },
        "core-status": {
            "description": "Provides a birds-eye view of the current Drupal installation, if any."
        },
        "docs-output-formats": {
            "description": "Output formatting options selection and use."
        },
        "field-clone": {
            "description": "Clone a field and all its instances."
        },
        "sql-connect": {
            "description": "A string for connecting to the DB."
        },
        "image-flush": {
            "description": "Flush all derived images for a given style."
        },
        "docs-cm": {
            "description": "Configuration management on Drupal 8 with Drush."
        },
        "user-login": {
            "description": "Display a one time login link for the given user account (defaults to uid 1)."
        },
        "site-ssh": {
            "description": "Connect to a Drupal site's server via SSH for an interactive session or to run a shell command"
        },
        "core-global-options": {
            "description": "All global options"
        },
        "updatedb": {
            "description": "Apply any database updates required (as with running update.php)."
        },
        "sql-drop": {
            "description": "Drop all tables in a given database."
        },
        "site-install": {
            "description": "Install Drupal along with modules/themes/configuration using the specified install profile."
        },
        "pm-disable": {
            "description": "Disable one or more extensions (modules or themes)."
        },
        "docs-example-sync-extension": {
            "description": "Example Drush commandfile that extends sql-sync to enable development modules in the post-sync hook."
        },
        "docs-context": {
            "description": "Contexts overview explaining how Drush manages command line options and configuration file settings."
        },
        "config-get": {
            "description": "Display a config value, or a whole configuration object."
        },
        "updatedb-status": {
            "description": "List any pending database updates."
        },
        "docs-examplescript": {
            "description": "Example Drush script."
        },
        "field-update": {
            "description": "Return URL for field editing web page."
        },
        "queue-list": {
            "description": "Returns a list of all defined queues"
        },
        "field-create": {
            "description": "Create fields and instances. Returns urls for field editing."
        },
        "cache-set": {
            "description": "Cache an object expressed in JSON or var_export() format."
        },
        "docs-shell-aliases": {
            "description": "Shell alias overview on creating your own aliases for commonly used Drush commands."
        },
        "docs-make-example": {
            "description": "Drush Make example makefile"
        },
        "core-topic": {
            "description": "Read detailed documentation on a given topic."
        },
        "user-information": {
            "description": "Print information about the specified user(s)."
        },
        "docs-api": {
            "description": "Drush API"
        },
        "batch-process": {
            "description": "Process operations in the specified batch set"
        },
        "sql-create": {
            "description": "Create a database."
        },
        "runserver": {
            "description": "Runs PHP's built-in http server for development."
        },
        "version": {
            "description": "Show drush version."
        },
        "watchdog-show": {
            "description": "Show watchdog messages."
        },
        "make-process": {
            "description": ""
        },
        "sql-sanitize": {
            "description": "Run sanitization operations on the current database."
        },
        "docs-bastion": {
            "description": "Bastion server configuration: remotely operate on a Drupal sites behind a firewall."
        },
        "user-remove-role": {
            "description": "Remove a role from the specified user accounts."
        },
        "docs-strict-options": {
            "description": "Strict option handling, and how commands that use it differ from regular Drush commands."
        },
        "docs-commands": {
            "description": "Drush command instructions on creating your own Drush commands."
        },
        "config-edit": {
            "description": "Open a config file in a text editor. Edits are imported into active configration after closing editor."
        },
        "image-derive": {
            "description": "Create an image derivative."
        },
        "role-list": {
            "description": "Display a list of all roles defined on the system.  If a role name is provided as an argument, then all of the permissions of that role will be listed.  If a permission name is provided as an option, then all of the roles that have been granted that permission will be listed."
        },
        "cache-clear": {
            "description": "Clear a specific cache, or all drupal caches."
        },
        "drupal-directory": {
            "description": "Return the filesystem path for modules/themes and other key folders."
        },
        "make-generate": {
            "description": "Generate a makefile from the current Drupal site."
        },
        "core-config": {
            "description": "Edit drushrc, site alias, and Drupal settings.php files."
        },
        "state-set": {
            "description": "Set a state value."
        },
        "pm-uninstall": {
            "description": "Uninstall one or more modules."
        },
        "core-quick-drupal": {
            "description": "Download, install, serve and login to Drupal with minimal configuration and dependencies."
        },
        "user-password": {
            "description": "(Re)Set the password for the user account with the specified name."
        },
        "make-convert": {
            "description": "Convert a legacy makefile into YAML format."
        },
        "docs-make": {
            "description": "Drush Make overview with examples"
        },
        "browse": {
            "description": "Display a link to a given path or open link in a browser."
        },
        "core-execute": {
            "description": "Execute a shell command. Usually used with a site alias."
        },
        "cache-rebuild": {
            "description": "Rebuild a Drupal 8 site and clear all its caches."
        },
        "user-create": {
            "description": "Create a user account with the specified name."
        },
        "state-get": {
            "description": "Display a state value."
        },
        "pm-download": {
            "description": "Download projects from drupal.org or other sources."
        },
        "config-merge": {
            "description": "Merge configuration data from two sites."
        },
        "user-block": {
            "description": "Block the specified user(s)."
        },
        "docs-cron": {
            "description": "Crontab instructions for running your Drupal cron tasks via `drush cron`."
        },
        "core-cli": {
            "description": "Open an interactive shell on a Drupal site."
        },
        "search-reindex": {
            "description": "Force the search index to be rebuilt."
        },
        "watchdog-list": {
            "description": "Show available message types and severity levels. A prompt will ask for a choice to show watchdog messages."
        },
        "pm-updatestatus": {
            "description": "Show a report of available minor updates to Drupal core and contrib projects."
        },
        "role-delete": {
            "description": "Delete a role."
        },
        "docs-bootstrap": {
            "description": "Bootstrap explanation: how Drush starts up and prepares the Drupal environment for use with the command."
        },
        "pm-releasenotes": {
            "description": "Print release notes for given projects."
        },
        "config-list": {
            "description": "List config names by prefix."
        },
        "variable-get": {
            "description": "Get a list of some or all site variables and values."
        },
        "config-export": {
            "description": "Export config from the active directory."
        },
        "usage-show": {
            "description": "Show Drush usage information that has been logged but not sent.  Usage statistics contain the Drush command name and the Drush option names, but no arguments or option values."
        },
        "docs-ini-files": {
            "description": "php.ini or drush.ini configuration to set PHP values for use with Drush."
        },
        "variable-delete": {
            "description": "Delete a variable."
        },
        "pm-updatecode-postupdate": {
            "description": "Notify of pending db updates."
        },
        "pm-list": {
            "description": "Show a list of available extensions (modules and themes)."
        },
        "user-add-role": {
            "description": "Add a role to the specified user accounts."
        },
        "pm-refresh": {
            "description": "Refresh update status information."
        },
        "search-index": {
            "description": "Index the remaining search items without wiping the index."
        },
        "cache-get": {
            "description": "Fetch a cached object and display it."
        },
        "role-add-perm": {
            "description": "Grant specified permission(s) to a role."
        },
        "archive-restore": {
            "description": "Expand a site archive into a Drupal web site."
        },
        "field-info": {
            "description": "View information about fields, field_types, and widgets."
        },
        "pm-releases": {
            "description": "Print release information for given projects."
        },
        "role-create": {
            "description": "Create a new role."
        },
        "sql-query": {
            "description": "Execute a query against a database."
        },
        "usage-send": {
            "description": "Send anonymous Drush usage information to statistics logging site.  Usage statistics contain the Drush command name and the Drush option names, but no arguments or option values."
        },
        "make-update": {
            "description": "Process a makefile and outputs an equivalent makefile with projects version resolved to latest available."
        },
        "watchdog-delete": {
            "description": "Delete watchdog messages."
        },
        "make": {
            "description": "Turns a makefile into a working Drupal codebase."
        },
        "field-delete": {
            "description": "Delete a field and its instances."
        },
        "archive-dump": {
            "description": "Backup your code, files, and database into a single file."
        },
        "shell-alias": {
            "description": "Print all known shell alias records."
        },
        "sql-cli": {
            "description": "Open a SQL command-line interface using Drupal's credentials."
        },
        "site-set": {
            "description": "Set a site alias to work on that will persist for the current session."
        },
        "docs-errorcodes": {
            "description": "Error code list containing all identifiers used with drush_set_error."
        },
        "docs-bashrc": {
            "description": "Bashrc customization examples for Drush."
        },
        "docs-example-sync-via-http": {
            "description": "Example Drush commandfile that extends sql-sync to allow transfer of the sql dump file via http rather than ssh and rsync."
        },
        "role-remove-perm": {
            "description": "Remove specified permission(s) from a role."
        },
        "pm-info": {
            "description": "Show detailed info for one or more extensions (modules or themes)."
        },
        "sql-dump": {
            "description": "Exports the Drupal DB as SQL using mysqldump or equivalent."
        },
        "user-cancel": {
            "description": "Cancel a user account with the specified name."
        },
        "core-requirements": {
            "description": "Provides information about things that may be wrong in your Drupal installation, if any."
        },
        "core-rsync": {
            "description": "Rsync the Drupal tree to/from another server using ssh."
        },
        "docs-aliases": {
            "description": "Site aliases overview on creating your own aliases for commonly used Drupal sites with examples from example.aliases.drushrc.php."
        },
        "docs-policy": {
            "description": "Example policy file."
        },
        "config-set": {
            "description": "Set config value directly in active configuration."
        },
        "php-eval": {
            "description": "Evaluate arbitrary php code after bootstrapping Drupal (if available)."
        },
        "sql-conf": {
            "description": "Print database connection details using print_r()."
        },
        "state-delete": {
            "description": "Delete a state value."
        }
    };
}).apply(module.exports);
