#!/usr/bin/env python

""" Uses the virustotal package (https://github.com/Gawen/virustotal) to
interact with the VirusTotal API.

Takes a Komodo MSI installer as an arguement, breaks the installer into smaller,
VirusTotal bite sized pieces (zip files), then sends them to VirusTotal to be
scanned and waits for the reports to be ready and retrieves them.  It will print
out either:

Report for batch-5-IDE-8.5.3-83203.zip received!
    ***NO VIRUSES DETECTED***
    
OR

Positive report detected for batch-5-IDE-8.5.3-83203.zip.  Queuing for print...

Example start command:

 > python vtscanner.py Komodo-IDE-x.y.z-xxxxx.msi

Then will log.info(out the resulting malicious reports.

No human interaction is necessary other than starting it.

***Must include a config.json file containing a valid APIKEY***
Ex. format:
{
    "APIKEY": "b987a09c0983002309823e0-thisIsFake-9809887087a097987b9870987098"
}

Special case exit for this script is sys.exit(2) which means a virus was detect.

"""

import contextlib
import os
import sys
import zipfile
import time
import datetime
import logging
import tempfile
import json
import subprocess
import shutil
import StringIO

from argparse import ArgumentParser
parser = ArgumentParser()
parser.add_argument("-t", "--timeout", nargs=1, default=1200, action='store',
                  help="Set the timeout for script runtime, in seconds.",
                  dest='TIME_OUT')
# decided not to add a "remove timeout" option as this would probably never get
# touched in the build process and if the reports are ever taking more than 15
# minutes then scan should just stop.
parser.add_argument("installer", help="Installer to be scanned.")
options = parser.parse_args()

# 
logging.basicConfig(stream=sys.stdout, format="%(message)s")
log = logging.getLogger("vt-scanner") # logging.root # or 
log.setLevel(logging.INFO)
#log.setLevel(logging.DEBUG)

try:
    from virustotal import virustotal
except ImportError:
    log.error("There was an error importing package 'virustotal'.")
    log.error("Clones it from https://github.com/cgchoffman/virustotal.")
    log.error("See README.md for install instructions.")
    log.error("Forked original repo as it is broken for Windows; See Issue 8: ")
    log.error("https://github.com/Gawen/virustotal/pull/8")
    sys.exit(1)
    
INSTALLER_NAME = options.installer

def main():
    """Exit code 2 means a virus or malware is detected."""
    try:
        API_KEY = os.getenv("VIRUSTOTAL_API_KEY")
        if API_KEY is None:
          raise Exception("No 'VIRUSTOTAL_API_KEY' environmental variable.")
    except Exception as e:
        log.error("Error: %s" %e)
        sys.exit(1)        
    test_vt_api(API_KEY)
    starttime = time.time()
    #test_vt_server()
    try:
        TEMP = tempfile.mkdtemp(dir=os.getcwd())
        install_Komodo(INSTALLER_NAME, TEMP)
        zipFilesList = archive_Komodo_intall(TEMP)
        reports = scan_files(zipFilesList, API_KEY)
        print_report(reports, zipFilesList)
   
    except Exception as e:
        log.exception("An error occurred while running the scanner. ERROR: %s", e)
    
    finally:
        log.info("\nCleaning up temporary folder: %s", TEMP)
        del_file_path(TEMP)
        starttime = datetime.datetime.fromtimestamp(starttime)
        endtime = datetime.datetime.fromtimestamp(time.time())
        log.info("Start time: %s", starttime.strftime("%H:%M:%S"))
        log.info("Finish time: %s", endtime.strftime("%H:%M:%S"))
        log.info("Elapsed time: %s", str(endtime - starttime))
        log.info("done!")

def test_vt_api(apikey):
    """Send up a test "scan" request to the VT api to make sure it's listening"""
    log.debug("Testing VirusTotal API server...")
    v = virustotal.VirusTotal(apikey)
    try:
        report = v.get(StringIO.StringIO("X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"))
        if report.positives:
            log.debug("VirusTotal API seems alive.  LET'S DO THIS!")
        else:
            raise
    except Exception as e:
        log.error("VirustTotal API is not repsonding.  Virus scan cannot be completed:\n %s", e)
        sys.exit(1)
    
def install_Komodo(installername, installpath):
    """Install Komodo...yep"""
    log.info("Installing %s in %s...", INSTALLER_NAME, installpath)  
    subprocess.check_call(["msiexec", "/qb", "/a", installername,
                    "TARGETDIR=" + installpath])
    log.debug("Install complete.\n")

def archive_Komodo_intall(tempfolder):
    """Break Komodo install in to smaller pieces to be shipped to VirusTotal.
    You can add another package by specifiying a new path below, then use the
    komodo-sdk.zip section as a basical example of the steps then needed.
    """
    log.info("Repacking and zipping Komodo files...\n")
    kopaths = ["lib\mozilla\components",
               "lib\mozilla\extensions",
               "lib\mozilla\plugins",
               "lib\support"]
    kosdkpath = "lib\sdk"
    mozpypath = "lib\mozilla\python"
    mozpath = "lib\mozilla"
    pypath = "lib\python"
    ziplist = []
    appendedPath = ""
    for root, dirs, files in os.walk(tempfolder):
        for d in dirs:
            if d == "PFILES" or d.find("ActiveState Komodo") > -1:
                appendedPath = os.path.join(appendedPath, d)

    walkpath = os.path.join(tempfolder,appendedPath)
    
    # Komodo.zip is special as it had pieces all over the install.  Must pack
    # them first then remove them from those other areas such as mozilla folder
    with create_zip(os.path.join(tempfolder, "komodo.zip")) as komodozip:
        # Komodo files contained in the Mozilla folder
        kolist = ["komodo.exe", "python27.dll", "pythoncom27.dll",
                  "pywintypes27.dll", "pyxpcom.dll", "pyxpcom.manifest",
                  "Scilexer.dll"]
        # First pack and delete Komodo bits
        for l in kopaths:
            walk_and_pack(walkpath, l, komodozip)
            del_file_path(os.path.join(walkpath, l))
        # Now do the single files in Mozilla that are Komodo bits
        # gotta create the mozpath now
        mozabspath = os.path.join(walkpath, mozpath)
        for f in kolist:
            fpath = os.path.join(mozabspath, f)
            pack(fpath, komodozip, os.path.join(mozpath, f))
            del_file_path(fpath)
        ziplist.append(komodozip)
    
    with create_zip(os.path.join(tempfolder,"komodo-sdk.zip")) as kosdkzip:            
        # Now pack and delete mozPython bits
        # Get the path from that available tuple
        walk_and_pack(walkpath, kosdkpath, kosdkzip)
        del_file_path(os.path.join(walkpath, mozpypath))
        ziplist.append(kosdkzip)
    
    with create_zip(os.path.join(tempfolder,"mozpython.zip")) as mozpythonzip:            
        # Now pack and delete mozPython bits
        # Get the path from that available tuple
        walk_and_pack(walkpath, mozpypath, mozpythonzip)
        #requires a deletion or else it would be added to the mozilla package
        del_file_path(os.path.join(walkpath, mozpypath))
        ziplist.append(mozpythonzip)
        
    with create_zip(os.path.join(tempfolder,"mozilla.zip")) as mozillazip:
        # Now we'll pack the mozilla bits.  We dont delete since we don't need to
        # as there are no more embedded bits.
        walk_and_pack(walkpath, mozpath, mozillazip)
        ziplist.append(mozillazip)
    
    with create_zip(os.path.join(tempfolder,"python.zip")) as python:   
        # and finally the Python bits, don't need to delete them either.
        walk_and_pack(walkpath, pypath, python)
        ziplist.append(python)
    log.info("Zipping complete.\n")
    return ziplist

def walk_and_pack(basepath, localpath, zipfile):
    """Takes a basepath to start walking down from.
    Takes a "localpath" use is relative to the installed folder.  This makes
    file paths more relastic when unpacking the zip.
    Takes a zipfile to fill with files."""
    rootpath = os.path.join(basepath, localpath)
    for d, dirs, files in os.walk(rootpath):
        for kfile in files:
            fpath = os.path.join(d, kfile)
            # append the subdir portion of to the localpath to maintain dir
            # structure in zip
            fulllocalpath = os.path.join(localpath, d[len(rootpath) + 1:])
            # add arcname so files have a relative path to the lib folder
            pack(fpath, zipfile, os.path.join(fulllocalpath, kfile))

def scan_files(filelist, apikey):
    """ Send files for scanning.  WIll return immediately if file hash matches
    previous run file hash with a report for that previous file.  Uses default
    timeout of 1200 secs or whatever was passed in with the -t option.  Compiles
    a list of reports to print later"""
    log.info("Sending files and retrieving reports...")
    v = virustotal.VirusTotal(apikey)
    startscantime = time.time()
    reports = []
    log.info("Sending files to be scanned...\n")
    for zfile in filelist:
        # submit the files
        basename = os.path.basename(zfile.filename)
        log.debug("Sending %s for scan...", basename)
        report = v.scan(zfile.filename)
        log.debug("File sent.  Report pending: %r", report)
        log.info("   Waiting for report...")
        timedelta = time.time() - startscantime
        while not report.done:
            if  timedelta <= options.TIME_OUT:
                log.info(".")
                report.join(60)
            else:
                log.warn("Timeout reached in vtscanner.scan_files.")
                log.warn("VIRUS SCAN NOT COMPLETE.")
                sys.exit(0)
        log.info("Report recieved for %s\n", basename)
        reports.append(report)
    log.info("All reports recieved.\n")
    return reports

def print_report(reports, files):
    """Check if a report has positive results (as in it found a virus) and print
    that report."""
    log.info("Printing Reports...\n")
    zipnum = 0 # used to cycle through zip file list (files) to link filename to report
    malwarecount = 0
    for report in reports:
        filename = os.path.basename(files[zipnum].filename)
        if report.positives == 0:
            log.info("No virus found in %s.\n", filename)
        else:
            malwarecount += 1          
            sys.stderr.write("\n***VIRUS DETECTED IN %s***\n", filename)
            for antivirus, malware in report:
                if malware is not None:
                    sys.stderr.write("Antivirus: %r" % antivirus[0])
                    sys.stderr.write("Antivirus' version: %r" % antivirus[1])
                    sys.stderr.write("Antivirus' update: %r" % antivirus[2])
                    sys.stderr.write("Malware: %r" % malware)
        zipnum += 1
    if malwarecount > 0:
        sys.exit(2) # system exit 2 means virus was found

def get_build_name(filename):
    """ Retrieve the full version of the installer, eg. Edit-x.y.z-xxxxx"""
    return filename[filename.find("-") + 1:filename.rfind(".")]

def pack(path, zfile, arcname):
    """ Add file to archive"""
    # This doesn't work.  Needs to be zipfile.ZipInfo or something.
    with open(path, "rb") as f:
        # ValueError: ZIP does not support timestamps before 1980
        # http://docs.python.org/3/library/zipfile.html#zipfile.ZipInfo
        try:
            mode = zipfile.ZIP_DEFLATED
        except: 
            mode = zipfile.ZIP_STORED
        info = zipfile.ZipInfo(arcname, date_time=(1983, 1, 1, 1, 1, 1))
        zfile.writestr(info, f.read(), mode)
    
def create_zip(name):
    """Create an archive file of the name "name"."""
    try:
        mode = zipfile.ZIP_DEFLATED
    except:
        mode = zipfile.ZIP_STORED
    return contextlib.closing(zipfile.ZipFile(name, "a", mode))

def del_file_path(fileORpath):
    """delete a file or path.  Used for cleanup when script finishes."""
    try:
        if os.path.isfile(fileORpath):
            os.remove(fileORpath)
            log.debug("Cleaning up %s.", fileORpath)
        else:
            # Have to use ignore_errors = True or else you can't recreate the
            # the install folder after removing it.
            # ref: http://stackoverflow.com/questions/10861403/cant-delete-test-folder-in-windows-7
            shutil.rmtree(fileORpath)
            log.debug("Cleaning up %s.", fileORpath)
    except OSError as e:
        log.debug("Couldn't delete %s: %s", fileORpath, e)

if __name__ == '__main__':
    main()
