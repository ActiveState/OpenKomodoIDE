SET WINCURVERKEY=HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion
REG QUERY "%WINCURVERKEY%" /v "ProgramFilesDir (x86)" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  SET WIN64=1
) else (
  SET WIN64=0
)
if "%WIN64%" == "1" (
  SET MSVCROOTKEY=HKLM\SOFTWARE\Wow6432Node\Microsoft\VisualStudio
) else (
  SET MSVCROOTKEY=HKLM\SOFTWARE\Microsoft\VisualStudio
)
SET MSVC6KEY=%MSVCROOTKEY%\6.0\Setup\Microsoft Visual C++
REG QUERY "%MSVC6KEY%" /v ProductDir >nul 2>nul
if "%VC6DIR%"=="" (
  IF %ERRORLEVEL% EQU 0 (
    FOR /F "tokens=2*" %%A IN ('REG QUERY "%MSVC6KEY%" /v ProductDir') DO SET VC6DIR=%%B
  )
)

if "%VC6DIR%"=="" (
    ECHO "Microsoft Visual C++ 6.0 was not found. Exiting."
    pause
    EXIT /B 1
)

ECHO Visual C++ 6 directory: %VC6DIR%
call "%VC6DIR%\Bin\vcvars32.bat"
rem Requires Microsoft Platform SDK for Windows Server 2003
set INCLUDE=C:\Program Files\Microsoft Platform SDK for Windows Server 2003 R2\Include;%INCLUDE%
set LIB=C:\Program Files\Microsoft Platform SDK for Windows Server 2003 R2\Lib;%LIB%
