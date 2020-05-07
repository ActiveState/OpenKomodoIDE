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
SET MSVC14KEY=%MSVCROOTKEY%\14.0\Setup\VC
REG QUERY "%MSVC14KEY%" /v ProductDir >nul 2>nul
if "%VC14DIR%"=="" (
  REM Newer SDKs (6.1, 7.0) install the VC11 compilers and set this key,
  REM but they're functionally equivalent to the VC11 Express compilers.
  IF %ERRORLEVEL% EQU 0 (
    FOR /F "tokens=2*" %%A IN ('REG QUERY "%MSVC14KEY%" /v ProductDir') DO SET TEMPVC11DIR=%%B
  )
)
REM We'll double-check for a VC14 Pro install here per the comment above.
REG QUERY "%MSVCROOTKEY%\14.0\InstalledProducts\Microsoft Visual C++" >nul 2>nul
if NOT "%TEMPVC11DIR%"=="" (
  IF %ERRORLEVEL% EQU 0 (
    SET "VC14DIR=%TEMPVC11DIR%"
  )
)

if "%VC14DIR%"=="" (
    ECHO "Microsoft Visual C++ version 14 (2015) was not found. Exiting."
    pause
    EXIT /B 1
)

ECHO Visual C++ 14 directory: %VC14DIR%
call "%VC14DIR%\vcvarsall.bat" %1
