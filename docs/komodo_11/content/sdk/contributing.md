---
title: Contributing to Komodo development
---
## Getting Help From the development team

### Forums

If you need help please use the Komodo forums. The How To section seems like a good spot to ask stuff: http://forum.komodoide.com/c/how-to. This way the community benefits from your questions as well.

### IRC

It's old school but it works.  We're on IRC every day of the work week (even weekends sometimes) unless we're on vacation (which is never).  We're on the Mozilla server so come say hi and ask questions:  IRC: irc.mozilla.org #komodo.

### Issues

If you find an issue that you can't fix and is separate from this one you can file new bugs here: https://github.com/Komodo/KomodoEdit/issues

**How to submit contributions** ref[1](https://help.github.com/articles/creating-a-pull-request/):

1. Fork the Komodo Edit github repo: https://github.com/Komodo/KomodoEdit.git
1. Make changes in your forked repo, commit, push them back to your github repo
1. You can then create a "Pull Request" out of one of those commits

**Small note on Commits**

Keep them concise and only have relevant code in each commit. This helps you down the road when trying to find an issue you might have added. [Commit early and Often](https://sethrobertson.github.io/GitBestPractices/#commit).

**Important note on pull requests**

*Concise:*  
Keep them concise like you keep your commits. Please don't write 20 new functions then dump a 500 line pull request on us :D. We need to review the request (obvs) before we'll accept it and massive pull requests make us sad.  If the pull request is too big we will likely reject it and ask you to break it up into multiple requests. Just save us all a little time and keep them concise.

*On Topic:*  
Don't mix tasks/ideas in a pull request (or a commit for that matter).  If you're implementing a new function, `function doSomethingRad()` (or porting one from legacy), then don't include random bug fixes in other functions/files or formatting changes in your pull request for `function doSomethingRad()`.  We probably won't reject a request based on this unless it's horribly messy but Nathan will probably complain.  This is just good practice for your source code control workflow in general whether your contributing to open source or working on a personal project.

We look forward to working with any one who wishes to help.  Our goal is to have a great community around Komodo and we're happy to welcome everyone.
