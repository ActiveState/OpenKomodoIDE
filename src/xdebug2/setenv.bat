@echo off
echo Setup PATH for building xdebug on this Windows machine.

rem Need 'unzip'. On Komodo dev machines, commonly have that here.
set PATH=%PATH%;C:\mozilla-build\info-zip

rem Need 'unzip'. On Komodo dev machines, commonly have that here.
set PATH=%PATH%;C:\mozilla-build\msys\bin

rem Need 'bison' and 'flex'. Will have then in this dir after 'src_win32build'
rem task is run.
set XDEBUG_BUILDDIR=%~dp0
set PATH=%PATH%;%XDEBUG_BUILDDIR%build\win32build\bin
