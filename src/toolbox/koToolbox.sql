/* Copyright (C) 2010 ActiveState Software Inc.
   See the file LICENSE.txt for licensing information. */

CREATE TABLE toolbox2_meta (
   /* For tracking versions, etc. */
   key TEXT UNIQUE ON CONFLICT REPLACE,
   value TEXT
);

create table paths (
    id integer unique primary key autoincrement,
    path text unique not null
);
create index paths_path_index on paths(path);

create table common_details (
    path_id INTEGER PRIMARY KEY NOT NULL ,
    /* uuid CHAR(36) NOT NULL, */
    name text NOT NULL,
    type text NOT NULL,
    is_clean bool DEFAULT 'false'
);

create table common_tool_details (
    path_id INTEGER PRIMARY KEY NOT NULL ,
    tags text,
    value TEXT,
    keyboard_shortcut text,
    lastRun DATETIME,
    favoriteRating INTEGER NOT NULL  DEFAULT 0,
    timesRun INTEGER NOT NULL DEFAULT 0
);

create table hierarchy (
    path_id INTEGER PRIMARY KEY NOT NULL,
    parent_path_id INTEGER
);
create index hierarchy_parent_path_id_index on hierarchy(parent_path_id);

create table tutorial(
    path_id INTEGER PRIMARY KEY NOT NULL,
    logic text
);

create table template (
    path_id INTEGER PRIMARY KEY NOT NULL,
    treat_as_ejs bool default false,
    lang_default bool default false,
    language text ""
);

create table folder_template (
    path_id INTEGER PRIMARY KEY NOT NULL,
    language text,
    author text,
    license text,
    website text
);

create table snippet (
    path_id INTEGER PRIMARY KEY NOT NULL,
    set_selection bool default false,
    indent_relative bool default false,
    auto_abbreviation bool default false,
    treat_as_ejs bool default false,
    language text ""
);

create table printdebug (
    path_id INTEGER PRIMARY KEY NOT NULL,
    language text "",
    logic text "",
    active bool default true,
    treat_as_ejs bool default true,
    scope INTEGER default 0
);

create table macro (
    path_id INTEGER PRIMARY KEY NOT NULL,
    async bool default false,
    trigger_enabled bool default false,
    trigger text,
    language text,
    rank INTEGER default 100
);

create table command (
    path_id INTEGER PRIMARY KEY NOT NULL,
    insertOutput bool default false,
    parseRegex bool default false,
    operateOnSelection bool default false,
    doNotOpenOutputWindow bool default false,
    showParsedOutputList bool default false,
    parseOutput bool default false,
    runIn text,
    cwd text,
    env text
);

create table metadata_timestamps (
    path_id INTEGER PRIMARY KEY NOT NULL, /* path id of path containing metadata file */
    mtime REAL
);

create table menu (
    path_id INTEGER PRIMARY KEY NOT NULL,
    priority integer default 100,
    accessKey char(10)
);

create table toolbar (
    path_id INTEGER PRIMARY KEY NOT NULL,
    priority integer default 100,
    metadata_timestamp DATETIME
);

create table menuItem (
    path_id INTEGER PRIMARY KEY NOT NULL,
    position INTEGER
);

create table misc_properties (
    path_id INTEGER NOT NULL,
    prop_name text,
    prop_value text
);
create index misc_properties_id_index on misc_properties(path_id);

create table favorites (
    path_id INTEGER PRIMARY KEY NOT NULL
);
