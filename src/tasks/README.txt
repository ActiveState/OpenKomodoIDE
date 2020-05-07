# Currently a playground for 'tasks' feature in K5.2

Have a trac setup running here for testing:
    http://mower.local:8010/
"mower" is Trent's laptop. On
    TODO: need one for testing

Have a bugzilla 3 up and running at http://127.0.0.1/~trentm/bugs/ on mower
(my laptop). TODO: *had* this, but no longer (new OS install).


# How to test

1. Ensure have a test server running for each supported repo kind (currently
   this is just Trac).
   
        mk trac_start

   Note: You'll need to work through `docs/trac_create_project.txt` for
   this to work.

2. In a separate shell, test away:

        mk test   # or  `cd test && python test.py [TAGS...]`



## To test

- trac: back to what version do we want to support?
- trac: some base level of support without XmlRpcPlugin?
- trac: make sure support digest auth
- trac: reasonable response if cannot connect
- trac: adding a taksk via the API does no sanity checks on values!
  Currently sanity checking "cc" and "owner" isn't done. Is there a way
  to do that via the API?



## Links

- Mylyn work list for Trac connector:
    http://wiki.eclipse.org/Mylyn_Trac_Connector

