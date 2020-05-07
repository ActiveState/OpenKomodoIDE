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
SET MSVC9KEY=%MSVCROOTKEY%\9.0\Setup\VC
REG QUERY "%MSVC9KEY%" /v ProductDir >nul 2>nul
if "%VC9DIR%"=="" (
  REM Newer SDKs (6.1, 7.0) install the VC9 compilers and set this key,
  REM but they're functionally equivalent to the VC9 Express compilers.
  IF %ERRORLEVEL% EQU 0 (
    FOR /F "tokens=2*" %%A IN ('REG QUERY "%MSVC9KEY%" /v ProductDir') DO SET TEMPVC9DIR=%%B
  )
)
REM We'll double-check for a VC9 Pro install here per the comment above.
REG QUERY "%MSVCROOTKEY%\9.0\InstalledProducts\Microsoft Visual C++" >nul 2>nul
if NOT "%TEMPVC9DIR%"=="" (
  IF %ERRORLEVEL% EQU 0 (
    SET "VC9DIR=%TEMPVC9DIR%"
  )
)

if "%VC9DIR%"=="" (
    ECHO "Microsoft Visual C++ version 9 (2008) was not found. Exiting."
    pause
    EXIT /B 1
)

ECHO Visual C++ 9 directory: %VC9DIR%
call "%VC9DIR%\vcvarsall.bat" %1
