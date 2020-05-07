import logging
import json
import urllib

from flask import g

import komob.auth
import komob.notifications
from komob.models import TextObj, ViewObj
from mobwrite.diff_match_patch import diff_match_patch

# Komodo - uncomment for command line output of logging data.
#import sys
#hdlr = logging.StreamHandler(sys.stdout)
#defaultFmt = "%(name)s: %(levelname)s: %(message)s"
#formatter = logging.Formatter(defaultFmt)
#hdlr.setFormatter(formatter)
#logging.root.addHandler(hdlr)

LOG = logging.getLogger("mobwrite")
#LOG.setLevel(logging.DEBUG)

def parseRequest(data):
  """Parse the raw MobWrite commands into a list of specific actions.
  See: http://code.google.com/p/google-mobwrite/wiki/Protocol

  Args:
    data: A multi-line string of MobWrite commands.

  Returns:
    A list of actions, each action is a dictionary.  Typical action:
    {"username":"fred",
     "filename":"report",
     "mode":"delta",
     "data":"=10+Hello-7=2",
     "force":False,
     "server_version":3,
     "client_version":3,
     "echo_username":False
    }
  """

  if not isinstance(data, basestring):
    # The original author didn't like to use unicode strings without giving
    # specifics why. We allow unicode strings so that our 'M:' protocol line
    # works.
    LOG.critical("parseRequest data type is %s" % type(data))
    return []
  if not (data.endswith("\n\n") or data.endswith("\r\r") or
          data.endswith("\n\r\n\r") or data.endswith("\r\n\r\n")):
    # There must be a linefeed followed by a blank line.
    # Truncated data.  Abort.
    LOG.warning("Truncated data: '%s'" % data)
    return []

  # Parse the lines
  actions = []
  username = None
  filename = None
  server_version = None
  echo_username = False
  metadata = None
  for line in data.splitlines():
    if not line:
      # Terminate on blank line.
      break
    if line.find(":") != 1:
      # Invalid line.
      continue
    (name, value) = (line[:1], line[2:])

    # Parse out a version number for file, delta or raw.
    version = None
    if ("FfDdRr".find(name) != -1):
      div = value.find(":")
      if div > 0:
        try:
          version = int(value[:div])
        except ValueError:
          LOG.warning("Invalid version number: %s" % line)
          continue
        value = value[div + 1:]
      else:
        LOG.warning("Missing version number: %s" % line)
        continue

    if name == "u" or name == "U":
      # Remember the username.
      username = value
      # Client may request explicit usernames in response.
      echo_username = (name == "U")

    elif name == "f" or name == "F":
      # Remember the filename and version.
      filename = value
      server_version = version

    elif name == "x" or name == "X":
      filename = value
      if filename and username:
        action = {}
        action["username"] = username
        action["filename"] = filename
        action["mode"] = "close"
        actions.append(action)

    elif name == "n" or name == "N":
      # Nullify this file.
      filename = value
      if username and filename:
        action = {}
        action["username"] = username
        action["filename"] = filename
        action["mode"] = "null"
        actions.append(action)

    elif name == "m" or name == "M":
      try:
        metadata = json.loads(value)
      except ValueError:
        LOG.warning("Invalid metadata from user " + username)

    else:
      # A delta or raw action.
      action = {}
      if name == "d" or name == "D":
        action["mode"] = "delta"
      elif name == "r" or name == "R":
        action["mode"] = "raw"
      else:
        action["mode"] = None
      if name.isupper():
        action["force"] = True
      else:
        action["force"] = False
      action["server_version"] = server_version
      action["client_version"] = version
      action["data"] = value
      action["echo_username"] = echo_username
      if username and filename and action["mode"]:
        action["username"] = username
        action["filename"] = filename
        if metadata:
          action["metadata"] = metadata
        actions.append(action)

  return actions

def doActions(actions):
  output = []
  viewobj = None
  viewobjs = []
  last_username = None
  last_filename = None

  for action_index in xrange(len(actions)):
    # Use an indexed loop in order to peek ahead one step to detect
    # username/filename boundaries.
    action = actions[action_index]
    username = action["username"]
    filename = action["filename"]
    notify_collaborators = False

    # Fetch the requested view object.
    if not viewobj:
      viewobj = fetch_viewobj(username, filename)
      if viewobj is None:
        # Insufficient privileges or too many views connected at once
        output.append("!:" + action["filename"] + "\n")
        continue
      viewobjs.append(viewobj)
      viewobj.delta_ok = True
      textobj = viewobj.text

    if action["mode"] == "close":
      # action's data is currently ignored. Might be good for x:all.
      viewobj.delete()
      viewobj = None
      continue

    if action["mode"] == "null":
      if not viewobj.can_write():
        output.append("O:" + action["filename"] + "\n")
      else:
        # Nullify the text.
        LOG.debug("Nullifying: '%s'" % viewobj)
        # No locking needed, just a set
        textobj.text = None
        textobj.save()
        viewobj.cleanup()
      continue

    if (action["server_version"] != viewobj.shadow_server_version and
        action["server_version"] == viewobj.backup_shadow_server_version):
      # Client did not receive the last response.  Roll back the shadow.
      LOG.warning("Rollback from shadow %d to backup shadow %d" %
          (viewobj.shadow_server_version, viewobj.backup_shadow_server_version))
      viewobj.shadow = viewobj.backup_shadow
      viewobj.shadow_server_version = viewobj.backup_shadow_server_version
      viewobj.edit_stack = []

    # Remove any elements from the edit stack with low version numbers which
    # have been acked by the client.
    x = 0
    while x < len(viewobj.edit_stack):
      if viewobj.edit_stack[x][0] <= action["server_version"]:
        del viewobj.edit_stack[x]
      else:
        x += 1

    if action["mode"] == "raw":
      # It's a raw text dump.
      try:
        # Text should be composed of a subset of ascii chars, Unicode not
        # required.  If this encode raises UnicodeEncodeError, delta is invalid.
        data = urllib.unquote(str(action["data"])).decode("utf-8")
      except UnicodeError:
        # The user managed to add a binary file to a collaboration session.
        # Skip the raw data chunk. Set delta_ok to False and force an R: reply
        # so the client notices his text was not applied *and* does not try to 
        # send the same text again.
        LOG.warning("Error while UTF-8 decoding a raw-mode message "
          "(User %s on file %s)" % (viewobj.sso_user.account_id, filename))
        viewobj.delta_ok = False
        if textobj.text is None:
          # Clobber text to trigger an R: instead of an r: response.
          textobj.text = ""
          textobj.save()
        data = None
      if data != None:
        LOG.info("Got %db raw text: '%s'" % (len(data), viewobj))
        viewobj.delta_ok = True
        # First, update the client's shadow.
        viewobj.shadow = data
        viewobj.shadow_client_version = action["client_version"]
        viewobj.shadow_server_version = action["server_version"]
        viewobj.backup_shadow = viewobj.shadow
        viewobj.backup_shadow_server_version = viewobj.shadow_server_version
        viewobj.edit_stack = []
        if not viewobj.can_write():
          output.append("O:" + action["filename"] + "\n")
        elif action["force"] or textobj.text is None:
          # Clobber the server's text. No locking, collision leads to data loss
          # anyway.
          if textobj.text != data:
            textobj.text = data
            textobj.save()
            LOG.debug("Overwrote content: '%s'" % viewobj)

    elif action["mode"] == "delta":
      # It's a delta.
      LOG.info("Got '%s' delta: '%s'" % (action["data"], viewobj))
      if action["server_version"] != viewobj.shadow_server_version:
        # Can't apply a delta on a mismatched shadow version.
        viewobj.delta_ok = False
        LOG.warning("Shadow version mismatch: %d != %d" %
            (action["server_version"], viewobj.shadow_server_version))
      elif action["client_version"] > viewobj.shadow_client_version:
        # Client has a version in the future?
        viewobj.delta_ok = False
        LOG.warning("Future delta: %d > %d" %
            (action["client_version"], viewobj.shadow_client_version))
      elif action["client_version"] < viewobj.shadow_client_version:
        # We've already seen this diff.
        pass
        LOG.warning("Repeated delta: %d < %d" %
            (action["client_version"], viewobj.shadow_client_version))
      elif not isinstance(viewobj.shadow, (str, unicode)):
          viewobj.delta_ok = False
          LOG.warning("Invalid delta, type %r for viewobj '%s'" %
              (type(viewobj.shadow), viewobj))
      else:
        # Expand the delta into a diff using the client shadow.
        try:
          diffs = DMP.diff_fromDelta(viewobj.shadow, action["data"])
        except ValueError:
          diffs = None
          viewobj.delta_ok = False
          LOG.warning("Delta failure, expected %d length: '%s'" %
              (len(viewobj.shadow), viewobj))
        viewobj.shadow_client_version += 1
        if diffs != None:
          if not viewobj.can_write():
            output.append("O:" + action["filename"] + "\n")
          else:
            # Textobj lock required for read/patch/write cycle.
            with textobj.lock():
              if applyPatches(viewobj, diffs, action):
                textobj.save()
                notify_collaborators = True

    if action.has_key("metadata"):
      viewobj.metadata = action["metadata"]
      notify_collaborators = True


    if notify_collaborators:
      komob.notifications.on_mobwrite_update(viewobj)

    # Generate output if this is the last action or the username/filename
    # will change in the next iteration.
    if ((action_index + 1 == len(actions)) or
        actions[action_index + 1]["username"] != username or
        actions[action_index + 1]["filename"] != filename):
      print_username = None
      print_filename = None
      if action["echo_username"] and last_username != username:
        # Print the username if the previous action was for a different user.
        print_username = username
      if last_filename != filename or last_username != username:
        # Print the filename if the previous action was for a different user
        # or file.
        print_filename = filename
      output.append(generateDiffs(viewobj, print_username,
                                       print_filename, action["force"]))
      output.append(getMetadata(textobj, username))
      last_username = username
      last_filename = filename

      # Dereference the view object so that a new one can be created.
      viewobj.save()
      viewobj = None

  return "".join(output)

def applyPatches(viewobj, diffs, action):
  """Apply a set of patches onto the view and text objects.  This function must
    be enclosed in a lock or transaction since the text object is shared.

  Args:
    viewobj: The user's view to be updated.
    diffs: List of diffs to apply to both the view and the server.
    action: Parameters for how forcefully to make the patch; may be modified.
  Returns:
    A bool indicating whether viewobj.text was modified and has to be saved.
  """
  # Expand the fragile diffs into a full set of patches.
  patches = DMP.patch_make(viewobj.shadow, diffs)

  # First, update the client's shadow.
  viewobj.shadow = DMP.diff_text2(diffs)
  viewobj.backup_shadow = viewobj.shadow
  viewobj.backup_shadow_server_version = viewobj.shadow_server_version
  viewobj.changed = True

  # Second, deal with the server's text.
  textobj = viewobj.text
  if textobj.text is None:
    # A view is sending a valid delta on a file we've never heard of.
    textobj.text = viewobj.shadow
    action["force"] = False
    LOG.debug("Set content: '%s'" % viewobj)
    return True
  else:
    if action["force"]:
      # Clobber the server's text if a change was received.
      if patches:
        mastertext = viewobj.shadow
        LOG.debug("Overwrote content: '%s'" % viewobj)
      else:
        mastertext = textobj.text
    else:
      (mastertext, results) = DMP.patch_apply(patches, textobj.text)
      LOG.debug("Patched (%s): '%s'" %
          (",".join(["%s" % (x) for x in results]), viewobj))
    textobj.text = mastertext
    return len(patches) > 0


def generateDiffs(viewobj, print_username, print_filename, force):
  output = []
  if print_username:
    output.append("u:%s\n" %  print_username)
  if print_filename:
    output.append("F:%d:%s\n" % (viewobj.shadow_client_version, print_filename))

  textobj = viewobj.text
  mastertext = textobj.text

  if viewobj.delta_ok:
    if mastertext is None:
      mastertext = ""
    # Create the diff between the view's text and the master text.
    diffs = DMP.diff_main(viewobj.shadow, mastertext)
    DMP.diff_cleanupEfficiency(diffs)
    text = DMP.diff_toDelta(diffs)
    if force:
      # Client sending 'D' means number, no error.
      # Client sending 'R' means number, client error.
      # Both cases involve numbers, so send back an overwrite delta.
      viewobj.edit_stack.append((viewobj.shadow_server_version,
          "D:%d:%s\n" % (viewobj.shadow_server_version, text)))
    else:
      # Client sending 'd' means text, no error.
      # Client sending 'r' means text, client error.
      # Both cases involve text, so send back a merge delta.
      viewobj.edit_stack.append((viewobj.shadow_server_version,
          "d:%d:%s\n" % (viewobj.shadow_server_version, text)))
    viewobj.shadow_server_version += 1
    LOG.info("Sent '%s' delta: '%s'" % (text, viewobj))
  else:
    # Error; server could not parse client's delta.
    # Send a raw dump of the text.
    # martink: Removed the shadow_client_version increment. In the case of a
    # shadow version mismatch this is definitely incorrect. Not entirely sure
    # about the "Client has a version in the future" scenario.
    viewobj.shadow_client_version += 1
    if mastertext is None:
      mastertext = ""
      viewobj.edit_stack.append((viewobj.shadow_server_version,
          "r:%d:\n" % viewobj.shadow_server_version))
      LOG.info("Sent empty raw text: '%s'" % viewobj)
    else:
      # Force overwrite of client.
      text = mastertext
      text = text.encode("utf-8")
      text = urllib.quote(text, "!~*'();/?:@&=+$,# ")
      viewobj.edit_stack.append((viewobj.shadow_server_version,
          "R:%d:%s\n" % (viewobj.shadow_server_version, text)))
      LOG.info("Sent %db raw text: '%s'" %
          (len(text), viewobj))

  viewobj.shadow = mastertext
  viewobj.changed = True

  for edit in viewobj.edit_stack:
    output.append(edit[1])

  return "".join(output)


def getMetadata(textobj, username):
  """Returns a hash with the metadata objects for all view objects to the given
  text object that don't belong to the given username"""
  metadata = {}
  for view in textobj.viewobj_set:
    if not (view.username == username or view.metadata is None):
      metadata[view.username] = view.metadata
  metadata_str = "M:%s\n" % json.dumps(metadata)
  return metadata_str


def fetch_viewobj(username, filename):
    # TODO Does this need any form of mututal exclusion? What about retrieving a
    # viewobj while it is deleted?
    textobj = TextObj.objects.get_by_id(filename)
    if textobj is None:
        return None
    sso_user = komob.auth.current_user()
    viewobj = ViewObj.objects.get_or_create(username=username,
                                            text_id=textobj.id,
                                            sso_user=sso_user)
    try:
        viewobj.id
    except models.exceptions.MissingID:
        abort(500, 'Could not create view')
    if not viewobj.can_read():
        viewobj.delete()
        viewobj = None
    return viewobj


DMP = diff_match_patch()
