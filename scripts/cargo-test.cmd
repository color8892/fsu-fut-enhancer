@echo off
cargo test %*
exit /b %ERRORLEVEL%