---
title: Configuring Source Code Control integration
---
<a name="config_cvs" id="config_cvs"></a>
### Configuring CVS
<a name="basic_cvs_config" id="basic_cvs_config"></a>
#### Basic CVS Configuration

1.  If you have not already done so, install the [cvs](http://www.nongnu.org/cvs/) command-line utility on your system.
1.  Enable CVS support in Komodo: Under [Preferences](prefs.html)|[Source Code Control](prefs.html#scc)|[CVS](prefs.html#CVS) and ensure that the "CVS Integration" option is checked and that the `cvs` executable is available in your `PATH` or is specified with a full pathname.
1.  Check out files: Use Komodo's [SCC checkout wizard](#scc_checkout), or checkout from the command line (e.g. '`cvs checkout _repository_ ...`').
1.  Open any file under CVS control in Komodo.

Komodo should now recognize that the file is under CVS source code control and the SCC menus and status icons should be enabled. If not, click **Refresh Status** on the **File** menu (or `Ctrl+K, R`) to force it to reset.

<a name="cvs_over_ssh" id="cvs_over_ssh"></a>
#### CVS Over SSH

Some CVS repositories (e.g. [SourceForge](http://sourceforge.net/index.php)) will only support CVS access over SSH (secure shell). When accessing these repositories, an SSH client is required. See **[Configuring SSH Support for CVS and Subversion](#config_ssh)** below for details on configuring SSH support.

<a name="config_svn" id="config_svn"></a>
### Configuring Subversion (SVN)
<a name="basic_svn_config" id="basic_svn_config"></a>
#### Basic SVN Configuration

1.  If you have not already done so, install the [svn](http://subversion.tigris.org/) command-line client on your system.
1.  Enable Subversion support in Komodo: Under [Preferences](prefs.html)|[Source Code Control](prefs.html#scc)|[Subversion](prefs.html#Subversion) and ensure that the "SVN Integration" option is checked and that the `svn` executable is available in your `PATH` or is specified with a full pathname.
1.  Check out files: If you haven't checked out a local working copy of the files yet, use the [SCC checkout wizard](#scc_checkout) or run `svn checkout ...` from the command line.
1.  Open any file under Subversion control in Komodo.

Komodo will recognize the files is under Subversion source code control and the SCC menus and status icons should be enabled. If not, click **Refresh Status** on the **File** menu (or Ctrl-K, R) to force it to reset.

<a name="svn_over_ssh" id="svn_over_ssh"></a>
#### SVN Over SSH

Some Subversion repositories only support Subversion access over SSH (secure shell). When accessing these repositories, an SSH client is required. See **[Configuring SSH Support for CVS and Subversion](#config_ssh)** below for details on configuring SSH support.
