@echo off
rem Kickoff all the builds for a typical evening run.
rem This is only intended to work on Trent's Windows dev box.

sleep 24000

rem python26 util\mkrc -b trunk
rem python26 bin\rrun.py ko ok && python26 util\mknightly.py komodoide komodoedit

rem python26 util\mkrc.py
rem python26 util\mkrc.py -b 5.1.x
python26 bin\rrun.py ko51 ok51 && python26 util\mknightly.py -b 5.1.x -V 5.1.5 komodoide komodoedit
rem python26 util\mkrc.py && python26 util\mknightly.py -b 5.1.4 -V 5.1.4 komodoide komodoedit

