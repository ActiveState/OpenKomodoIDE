from xpcom import components

from koLanguageServiceBase import *

# Windows PowerShell

class koPowerShellLanguage(KoLanguageBase):
    name = "PowerShell"
    _reg_desc_ = "%s Language" % name
    _reg_contractid_ = "@activestate.com/koLanguage?language=%s;1" \
                       % (name)
    _reg_clsid_ = "{7feddc83-d8a6-4533-85f2-e11564a1a167}"
    _reg_categories_ = [("komodo-language", name)]

    _stateMap = {
        'default': ('SCE_POWERSHELL_DEFAULT',),
        'keywords': ('SCE_POWERSHELL_KEYWORD',),
        'variables': ('SCE_POWERSHELL_VARIABLE',),
        'identifiers': ('SCE_POWERSHELL_IDENTIFIER',),
        'comments': ('SCE_POWERSHELL_COMMENT',),
        'numbers': ('SCE_POWERSHELL_NUMBER',),
        'strings': ('SCE_POWERSHELL_STRING', 'SCE_POWERSHELL_CHARACTER'),
        'operators': ('SCE_POWERSHELL_OPERATOR',),
        'commands': ('SCE_POWERSHELL_CMDLET',),
        'aliases': ('SCE_POWERSHELL_ALIAS',),
        }
    defaultExtension = '.ps1'
    commentDelimiterInfo = {"line": [ "# " ]}
    
    sample = """
# Get all text lines in about* help files.
$filter = "about*.txt"
dir $pshome -filter $filter -recurse | %{
       $null = $sb.Append("<w:p><w:pPr><w:pStyle w:val=`"Heading1`" /></w:pPr><w:r><w:t>")
       $null = $sb.Append($_)
       $null = $sb.Append("</w:t></w:r></w:p>")
      
       get-content $_.FullName | %{
              $null = $sb.Append("<w:p><w:r><w:t>")
              $null = $sb.Append($_.replace("&", "&amp;").replace("<","&lt;").replace(">","&gt;"))
              $null = $sb.Append("</w:t></w:r></w:p>")
       }
}

$null = $sb.Append("</w:body></w:wordDocument>")

#Write generated string to document file.
$sb.ToString() | out-file $doc -encoding UTF8
 
# Open the resulting file in MS-Word.
$null = [System.Diagnostics.Process]::Start("$pwd\$doc")
 
"Done"
"""
    def get_lexer(self):
        if self._lexer is None:
            self._lexer = KoLexerLanguageService()
            self._lexer.setLexer(components.interfaces.ISciMoz.SCLEX_POWERSHELL)
            self._lexer.setKeywords(0, self._keywords_0)
            self._lexer.setKeywords(1, self._keywords_1)
            self._lexer.setKeywords(2, self._keywords_2)
            self._lexer.supportsFolding = 1
        return self._lexer

    _keywords_0 = """break continue do else elseif filter for foreach
        function if in return switch until where while""".split()
        
    _keywords_1 = """add-content add-history add-member add-pssnapin
        clear-content clear-item clear-itemproperty clear-variable
        compare-object convertfrom-securestring convert-path convertto-html
        convertto-securestring copy-item copy-itemproperty export-alias
        export-clixml export-console export-csv foreach-object format-custom
        format-list format-table format-wide get-acl get-alias
        get-authenticodesignature get-childitem get-command get-content
        get-credential get-culture get-date get-eventlog get-executionpolicy
        get-help get-history get-host get-item get-itemproperty get-location
        get-member get-pfxcertificate get-process get-psdrive get-psprovider
        get-pssnapin get-service get-tracesource get-uiculture get-unique
        get-variable get-wmiobject group-object import-alias import-clixml
        import-csv invoke-expression invoke-history invoke-item join-path
        measure-command measure-object move-item move-itemproperty new-alias
        new-item new-itemproperty new-object new-psdrive new-service
        new-timespan new-variable out-default out-file out-host out-null
        out-printer out-string pop-location push-location read-host
        remove-item remove-itemproperty remove-psdrive remove-pssnapin
        remove-variable rename-item rename-itemproperty resolve-path
        restart-service resume-service select-object select-string set-acl
        set-alias set-authenticodesignature set-content set-date
        set-executionpolicy set-item set-itemproperty set-location
        set-psdebug set-service set-tracesource set-variable sort-object
        split-path start-service start-sleep start-transcript stop-process
        stop-service stop-transcript suspend-service tee-object test-path
        trace-command update-formatdata update-typedata where-object
        write-debug write-error write-host write-output write-progress
        write-verbose write-warning""".split()
    
    _keywords_2 = """ac asnp clc cli clp clv cpi cpp cvpa diff epal
        epcsv fc fl foreach ft fw gal gc gci gcm gdr ghy gi gl gm gp gps
        group gsv gsnp gu gv gwmi iex ihy ii ipal ipcsv mi mp nal ndr ni nv
        oh rdr ri rni rnp rp rsnp rv rvpa sal sasv sc select si sl sleep
        sort sp spps spsv sv tee where write cat cd clear cp h history
        kill lp ls mount mv popd ps pushd pwd r rm rmdir echo cls chdir
        copy del dir erase move rd ren set type""".split()
