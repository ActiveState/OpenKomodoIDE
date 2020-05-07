# Inline Confirmation plugin for jQuery

A while ago I was asked to make a simple slideshow. My initial thought was, there must be a ton of solutions available for jQuery, I could easily draw inspiration from them.

I was wrong. Whilst there are a few nicely done slideshow plugins for jQuery, the majority of them are either poorly written or far too complicated.

So, I decided to code my own plugin from the ground up. Meet __Slideshow Lite__!

## Configuration

There are a few options to customise the behaviour of this plugin:

<table>
  <tr>
    <td><strong>Option</strong></td>
    <td><strong>Type</strong></td>
    <td><strong>Description</strong></td>
  </tr>
  <tr>
    <td>pauseSeconds</td>
    <td>Float</td>
    <td>Number of seconds between each photo to be displayed.</td>
  </tr>
  <tr>
    <td>fadeSpeed</td>
    <td>Float</td>
    <td>Number of seconds for the fading transition, the value should not exceed `pauseSeconds`.</td>
  </tr>
  <tr>
    <td>width</td>
    <td>Integer</td>
    <td>Width of the slideshow, in pixels.</td>
  </tr>
  <tr>
    <td>height</td>
    <td>Integer</td>
    <td>Height of the slideshow, in pixels.</td>
  </tr>
  <tr>
    <td>caption</td>
    <td>Boolean</td>
    <td>Display photo caption?</td>
  </tr>
  <tr>
    <td>cssClass</td>
    <td>String</td>
    <td>Name of the CSS class, defaults to `slideshowlite`.</td>
  </tr>
  <tr>
    <td>anchorTarger</td>
    <td>String</td>
    <td>Name for the target="_xxx" attribute, defaults to `_self`.</td>
  </tr>
</table>

## Usage

``` js
// using default options
$("#slideshow").slideshow();

// using some custom options
$("#slideshow2").slideshow({
  pauseSeconds: 4,
  height: 200,
  caption: false
});
```

## Demo

[Click here for a simple demo](http://fredwu.github.com/jquery-slideshow-lite/).

## Changelog

v0.8.1 [2011-07-19]

- Use HTML5's data attribute `data-seq` instead of `rel` to store sequence data.

v0.8.0 [2011-06-28]

- Added readme to the repository.
- Updated jQuery to 1.6.1.

v0.7.1 [2010-12-10]

- Pagination clicks should not cause the page to return to the top.

v0.7.0 [2010-12-07]

- Added `anchorTarget` option and fixed the way anchor tags are created.

v0.6.1 [2010-11-18]

- Code clean up.

v0.6.0 [2010-11-18]

- It now supports multiple slideshows targeted via DOM class selectors.
- Get rid of the use of children().

v0.5.4 [2010-11-12]

- Fixed a transition bug when there's only 2 images.
- Updated jQuery to 1.4.4.

v0.5.3 [2009-12-02]

- Added `fadeSpeed` for setting the transition speed.

v0.5.2 [2009-12-02]

- Repackaged to remove an unnecessary `.htaccess` file.

v0.5.1 [2009-12-02]

- Fixed some typo.

v0.5.0 [2009-12-02]

- Major rewrite: slides can now be clicked freely (as opposed to waiting for one to finish showing before it can be clicked again)
- Added automatic photo caption

v0.4.0 [2009-12-02]

- Code clean up.
- Added transparency effects to the navigation, to indicate when it is clickable.
- Added inline configuration documentation.

v0.3.0 [2009-12-02]

- Smoother animation.

v0.2.0 [2009-12-02]

- Fixed a navigation bug where the clicks no longer work after clicking on the current slideshow.

v0.1.0 [2009-12-02]

- Initial release.

## License

Copyright (c) 2009 Fred Wu

Dual licensed under the [MIT](http://www.opensource.org/licenses/mit-license.php) and [GPL](http://www.gnu.org/licenses/gpl.html) licenses.
