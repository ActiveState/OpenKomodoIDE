#!/usr/bin/env python
import os
import re
import json
from xml.etree import ElementTree
from xpcom import components
from xpcom.server import UnwrapObject

import logging
log = logging.getLogger("sublime-converter")
#log.setLevel(logging.DEBUG)
# #from dbgp.client import brk
# #brk(host="localhost", port=10000)

"""This class is used to convert Sublime Text snippets to Komodo Snippets.
If more use cases become sensible then it can be extended to accomodate more."""

class Sublime():
    def __init__(self):
        self.komodoToolStr  = """
        {
          "version": "1.0.12", 
          "type": "snippet", 
          "name": "name", 
          "value": [], 
          "auto_abbreviation": "true",
          "language":"",
          "treat_as_ejs": "false"
        }
        """
        self.relativePath = ""
        self.conversionFolder  = ""
        self.conversionFolderName = "sublime-converted-snippets"
        self.subFound = False
        self.unSupVarsFound = False
        self.nestedTabstopFound = False
        self.rootDir  = "" #used to generate a relative path when importing folders
        self.disabledVarsInFile  = "" # Reset in convertSublimeSnippets for each file
                                 # set to true in _disableVarsInTabstops so file is
                                 # written to list of unsupported configs.
        self.unsupportedSnippets  ="unsupported-snippets.md"
        self.unsupportedSnippetsPath = ""
        self.unsupportedOrigContent  = """
## What's this file about?
Certain aspects of Sublime Text snippets aren't supported. This file (the one
you're reading) lists the files that were found to have these unsupported
features.  To best view this file open it in Komodo Markdown previewer.

## What did we do?

We changed stuff from the snippet you knew.

### Unsupported Syntax and Variables
 - `$PARAM` and `$TM_SOFT_TABS`
 - Substitution syntax `${variabel/pattern/replace/flag}` [#2409](https://github.com/Komodo/KomodoEdit/issues/2409)
 - nested placeholders (AKA tabstops in Komodo) `${1: foo ${2: bar}}` [#2410](https://github.com/Komodo/KomodoEdit/issues/2410)

#### Variables
We "disabled" the unsupported variables by removing `$` from them and appending
`_NOT_SUPPORTED` to it so it's easy to find.   We still translated what we could.

#### Substituions
Substitution syntax isn't currently translated but can often be translated
manually using EJS templates in Komodo snippets.  We do not translate
snippets that contain Substituions.

#### Nested placeholders (aka tabstops) stops
This functionality isn't currently supported in Komodo.  We do not translate
snippets that contain nested placeholders

### Filename
Also note that due to how snippets are triggered in Komodo the filename of the
snippet has been converted to the trigger of the original. The trigger is still
the same.

### Effected Variables
The only variables we don't support are the `PARAMSN` variables (we don't support
this mechanism) and the `$TM_SOFT_TABS` (we automatically insert what you
have set in your preferences).  See the [Sublime Snippet
docs](http://docs.sublimetext.info/en/latest/extensibility/snippets.html?highlight=snippet#environment-variables)
for more information.

## Trouble Makers
|Rel Path|Nested Tabs|Substitutions|Unsupported Var|
|:-|:-:|:-:|:-:|"""
        self.convCount=0
        self.badFileCount=0
    
    def convertSublimeSnippetFolder(self, srcPath):
        """Searches a folder for Sublime snippets, converts them and saves them
        to a conversion folder. When completed the conversion folder path is
        returned"""
        try:
            self.createConvFolder(srcPath)
            self.createUnsupportedFile()
            self.rootDir = srcPath
            os.path.walk(srcPath, self.convertSublimeSnippets, True)
            self.addToOutputFile("\n\nConverted %s files.\n%s bad files found." %(self.convCount, self.badFileCount))
            return [self.conversionFolder, str(self.badFileCount)]
        except Exception as e:
            log.error("Folder Conversion Failed: %s",e)

    # Import a Sublime text snippet
    # 
    # Move description into an EJS comment in the snippet rather than throw it
    # away Trigger becomes name in toolbox.
    # Parse the content:
    #     insert description
    #     parse content and swap Sublime variables for Komodo shortcuts
    # 
    # Example snippet:
    # <!-- See http://www.sublimetext.com/docs/snippets for more information -->
    # <snippet>
    # 	<content><![CDATA[${1:FIELDNAME} = models.AutoField($2)]]></content>
    # 	<tabTrigger>mauto</tabTrigger>
    #     <scope>source.python</scope>
    #     <description>AutoField (mauto)</description>
    # </snippet>
    # 
    # Docs ref: http://docs.sublimetext.info/en/latest/extensibility/snippets.html
    def convertSublimeSnippets(self, folderConversion, parentPath, srcFiles):
        """Takes a list of paths of potential Sublime snippets and converts
        them then saves them to a conversion folder. Returns the conversion
        folder.
        This function can be called on it's own but is also called from
        convertSublimeSnippetFolder in a os.path.walk() call. Hence
        folderConversion.
        parentPath is used to maintain any folder structure that the original
        snippet repo may have had."""
        try:
            if not folderConversion:
                destPath = self.createConvFolder(parentPath)
                self.createUnsupportedFile()
            else:
                if parentPath == self.conversionFolder or ".git" in parentPath:
                    # don't process the conversion folder silly
                    # also don't process a git dir
                    return
                self.relativePath = os.path.relpath(parentPath, self.rootDir)
                destPath = os.path.join(self.conversionFolder, self.relativePath)
            if not os.path.exists(destPath):
                os.mkdir(destPath)
            for srcFile in srcFiles:
                # os.path.walk gives a list of files names.
                # The file browser that is called before convertSublimeSnippets
                # gives a list of file paths.
                if folderConversion:
                    srcFile = os.path.join(parentPath, srcFile)
                ext = os.path.splitext(srcFile)[1]
                if not ext == ".sublime-snippet":
                    log.warn("Skipping non Sublime tool: %s", srcFile)
                else:
                    data = self.convertSnippet(srcFile)
                    path = os.path.join(destPath, data["name"] + ".komodotool")
                    with open(path, "w") as destFile:
                        destFile.write(json.dumps(data))
                        self.convCount+=1
                    toolbox2Svc = components.classes["@activestate.com/koToolbox2Service;1"].getService(components.interfaces.koIToolbox2Service);
                    toolbox2Svc.convertOldFormat(path, True);
            if not folderConversion:
                self.addToOutputFile("\n\nConverted %s files.\n%s bad files found." %(self.convCount, self.badFileCount))
                return [self.conversionFolder, str(self.badFileCount)]
        except Exception as e:
            log.exception("File list conversion failed: %s", e)
            
    # Take a file path to a suposed snippet, convert it and dump it into the
    # destination folder
    def convertSnippet(self, srcFile):
        """Convert a Sublime snippet into a json object.
        Return the json object to be saved as a Komodo snippet"""
        self.disabledVarsInFile  = False
        xmlContent=""
        # Get the files contents into XML form
        with open(srcFile, "r") as fileContent:
            try:
                xmlContent = ElementTree.fromstring(fileContent.read())
            except ParseError as pe:
                log.warn("Can not parse file contents '%s': %r", os.path.basename(srcFile), pe)
                return
        # Extract the relevant fields
        snippet = json.loads(self.komodoToolStr)
        snippet["auto_abbreviation"] = "true"
        snippet["treat_as_ejs"] = "true"
        code = ""
        if xmlContent.find("content") is not None:
            code = xmlContent.find("content").text
        else:
            log.warn("No content to import from snippet.")
            return
        if xmlContent.find("tabTrigger") is not None:
            snippet["name"]  = xmlContent.find("tabTrigger").text
        else:
            log.warn("No trigger to import from snippet.")
            return
        if xmlContent.find("scope") is not None:
            snippet["language"] = self._extractLanguage(xmlContent.find("scope").text)
        if xmlContent.find("description") is not None:
            code = "<% /* " + xmlContent.find("description").text + " */ %>\n" + code
        # Translate code
        code = self._translateSublimeSnippetContent(code)
        snippet["value"] = code.splitlines()
        
        # If there were vars disabled, write it to the file
        if self.disabledVarsInFile:
            self.badFileCount+=1
            relPathToSnippet = ""
            if not self.relativePath == None and not self.relativePath == "..":
                relPathToSnippet = os.path.join(self.relativePath, snippet["name"] + ".komodotool")
            self.addToOutputFile("\n|"+relPathToSnippet+"|"+str(bool(self.nestedTabstopFound))+"|"+str(bool(self.subFound))+"|"+str(bool(self.unSupVarsFound))+"|")
        self.placeHolderStrings = {}
        return snippet
        
    def _extractLanguage(self, scope):
        """Extract language from the scope string from the snippe: eg. 'scope.python' """
        language = scope[scope.index(".")+1:]
        langRegistry = components.classes["@activestate.com/koLanguageRegistryService;1"].getService(components.interfaces.koILanguageRegistryService);
        UnwrapObject(langRegistry)
        langNames = langRegistry.getLanguageNames()
        try:
            return langNames[[name.lower() for name in langNames].index(language.lower())]
        except:
            return ""
    
    # Put all the converted snippets into one place
    def createConvFolder(self, path):
        path = os.path.join(path, self.conversionFolderName)
        if not os.path.exists(path ):
            os.mkdir(path)
        self.conversionFolder = path
        return self.conversionFolder
    
    # It's put into self.convertsionFolder
    # Dumps default text into file from self.unsupportedOrigContent 
    def createUnsupportedFile(self):
        self.unsupportedSnippetsPath = os.path.join(self.conversionFolder, self.unsupportedSnippets)
        try:
            os.remove(self.unsupportedSnippetsPath)
        except OSError:
            # likely means it doesn't exist so skip it.
            pass
        except:
            raise
        self.addToOutputFile(self.unsupportedOrigContent)
        return self.unsupportedSnippetsPath
        
    def addToOutputFile(self, content):
        with open(self.unsupportedSnippetsPath, "a") as badFilesFile:
            badFilesFile.write(content)
    
    # Not supported
    # Substitutions:
    #   ${var_name/regex/format_string/}
    #   ${var_name/regex/format_string/options}
    #        ${1/./=/g}
    #        ${TM_FILENAME/(\w+)\.js/\1/g}
    #        ${TM_FILENAME/(\w+)\.js/\1/}
    def checkSubstitutionSyntax(self, data):
        pattern = re.compile("\${.*?/.*?/.*?/[igm]*?}") # substitution
        if pattern.search(data):
            self.disabledVarsInFile = True
            return 1
        return 0

    # Not supported
    #   $PARAM variables passed in to snippets at run time
    #   $$TM_SOFT_TABS
    def checkInvalidVariables(self, data):
        pattern = re.compile("\$(PARAM\d+)|\$(TM_SOFT_TABS)") # substitution
        if pattern.search(data):
            self.disabledVarsInFile = True
            return 1
        return 0

    # PARAM and $TM_SOFT_TABS variables aren't supported
    # Convert them to something that is obviously not right
    def _disableVarsInTabstops(self, match):
        # Set this var so the file is noted as having an unsupported config
        if not match.group(1) == None:
            return "_"+match.group(1) + "_NOT_SUPPORTED"
        if not match.group(2) == None:
            return "_"+match.group(2) + "_NOT_SUPPORTED"

    # Convert tab stops and pull their content along
    # Sublime variables in the default text will be replaced
    # in the next step,
    placeHolderStrings = {}

    def _replSublimeTabstops(self, match):
        pattern = re.compile("\$\d+|\$\{\d+")
        match1 = match.group(1)
        match2 = match.group(2)
        match3 = match.group(3)

        # Check for nested placeholders and skip
        if match2 and ("${" in match2 or
                               pattern.search(match2) is not None):
            self.nestedTabstopFound = True
            self.disabledVarsInFile = True
            if match1:
                return "${"+match1+":"+match2+"}"
            else:
                return "${"+match3+":"+match3+"}"

        # Otherwise get the place holder string for a tabstop number (if it
        # has mutliple) to use on it's siblings otherwise Komodo complains about
        # different placeholder strings for the same tabstop number.  It also
        # complains about blank placeholder strings.
        placeHolder = ""
        if match1 and self.placeHolderStrings.get(match1) is None:
            self.placeHolderStrings[match1] = placeHolder = match2
        elif match3 and self.placeHolderStrings.get(match3) is None:
            self.placeHolderStrings[match3] = placeHolder = "placeholder "+match3
        else:
            placeHolder = self.placeHolderStrings.get(match1) or self.placeHolderStrings.get(match3)
        if match1:
            return "[[%tabstop"+match1+":"+placeHolder+"]]"
        else:
            return "[[%tabstop"+match3+":"+placeHolder+"]]"

    def _convertSublimeVarsToShortcuts(self, content):
        # Currently this will replace embedded Sublime vars inside
        # tabstops which isn't supported in Komodo.  Things break bad
        subVarsToShortcuts = {
            "$SELECTION" : "require(\"ko/editor\").getColumnNumber()",
            "$TM_CURRENT_LINE" : "require(\"ko/editor\").getLine()",
            "$TM_CURRENT_WORD" : "require(\"ko/editor\").getWord()",
            "$TM_FILENAME" : "require(\"ko/views\").current().get().koDoc.baseName",
            "$TM_FILEPATH" : "require(\"ko/views\").current().get().koDoc.displayPath",
            "$TM_FULLNAME" : "require(\"sdk/system\").env.USERNAME ? require(\"sdk/system\").env.USERNAME : require(\"sdk/system\").env.USER",
            "$TM_LINE_INDEX" : "require(\"ko/editor\").getColumnNumber()",
            "$TM_LINE_NUMBER" : "require(\"ko/editor\").getLineNumber()",
            "$TM_SELECTED_TEXT" : "require(\"ko/editor\").getColumnNumber()",
            "$TM_TAB_SIZE" : "require(\"ko/views\").current().get().koDoc.tabWidth"
            }
        for key, value in subVarsToShortcuts.items():
            content = content.replace(key, "<%= "+value+" %>")
        return content

    # tabstop examples:
    #     named: ${1:type}
    #     no-name: ${1}
    #     no-wrap no-name: $1
    #     Tabstops + $variables: ${1: $TM_LINE_INDEX }
    # Not Supported:
    #     Nest tabstops
    #     substitutions
    #     $PARAM vars and $TM_SOFT_TABS
    # http://docs.sublimetext.info/en/latest/extensibility/snippets.html
    def _translateSublimeSnippetContent(self, content):
        self.subFound = self.checkSubstitutionSyntax(content)
        self.unSupVarsFound = self.checkInvalidVariables(content)
        # We skip these two types of failed translation as they can wreck havoc
        # in the snippet content
        if self.subFound:
            return content
        if self.unSupVarsFound:
            pattern = re.compile("\$(PARAM\d+)|\$(TM_SOFT_TABS)")
            content = pattern.sub(self._disableVarsInTabstops, content)
        # Replace the tabstops
        pattern = re.compile("\${?(\d+):(.*?)}|\${?(\d+)}?")
        content = pattern.sub(self._replSublimeTabstops, content)
        content = self._convertSublimeVarsToShortcuts(content)
        # Sublime snippets have to escape "$"
        # and when they are loaded into a string, the escape char gets escaped
        # so i have to escape the escaping escape char...fun!
        pattern = re.compile("\\\\\$")
        content = pattern.sub("$",content)
        return content
