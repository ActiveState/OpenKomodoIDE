        Source Code Control Integration in Komodo

To think about:
    o Should we have some mechanism encouraging (or warning, or just doing?)
      users to use reasonable default options to some CVS commands? E.g. cvs
      -z3, cvs update -dP, etc. How to do that? Like this:

      - If the user initiates what amounts to a CVS update then, if it is
        noticed that '-d' and/or '-P' are NOT included in the options bring
        up a dialog warning about this: "I noticed this. It would probably
        wbe a good thing if you did this. Would you like Komodo to set this
        up for you <yes> <no>. [ ] Don't ask me again."

      - Warn about -Q in .cvsrc. Komodo should always override this. Perhaps
        Komodo should always use -q to get rid of the cruft.



