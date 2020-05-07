---
title: Unit testing
---
Komodo supports unit testing for the following frameworks:

- PHPUnit (PHP)
- Pytest (Python 2 and 3)
- Prove (Perl)
- Mocha (Node.js)
- RSpec (Ruby)
- Go test

In addition, Komodo can be configured to parse tests from any framework as long as they output to stdout in the following formats:

- TAP (Test Anything Protocol)
- TeamCity

## Using Unit Testing in Komodo

You can use unit testing in two different ways, either you can access it through the bottom panel or you can launch a new Unit Testing dialog by clicking the "Open Unit Testing Dialog" button at the bottom of the dynamic toolbar (left side of screen).

## Creating Test Configurations

A test configuration refers to a configuration you set up that points Komodo at your existing unit tests. To create one press the Plus icon in the bottom toolbar of the unit testing widget.

This will launch a new dialog allowing you to provide the details for your unit testing setup. In most cases you will only need to fill out the "Basics".

The fields you can customize are

- Name
- Path
- Framework
- Command - this will not be editable unless you select a "Custom" framework
- Parser
- Save To - allows you to associate your configuration with either a file, a project or globally (always accessible).

## Modifying Test Configurations

To modify a configuration simply select the config you wish to modify from the bottom toolbar of the unit testing widget, then hit the pencil icon to edit it. This will produce the same dialog as when creating a configuration.

To delete a configuration simply select the config you wish to delete, then hit the "minus" icon. A confirmation will be shown.

## Running Tests

To run a test simply select the test from the dropdown in the bottom toolbar of the unit testing widget, then hit the "Run" button. While a test is running results will start showing as they come in. You can navigate to the stdout and stderr tabs to check the raw output of your tests. These tabs will light up when they receive content.

### Run on Save

When checking the "Run on Save" checkbox your selected test plan will be ran any time you save a file in Komodo. Note that Komodo does not "know" which files relate to your tests, so it will run on any file save, regardless of location.

### Show Details

When show details is checked Komodo will show expected/actual information as part of the test result listing, and show errors for tests that failed to run. If this is not checked you will have to select test results to view these details.

### Filtering

You can filter tests via the right column of the unit testing widget. These filters persist when you run your tests again, however they do not affect what tests are ran, they only affect the information that Komodo is displaying to you.
