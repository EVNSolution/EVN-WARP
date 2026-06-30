@echo off
chcp 65001 > nul
title EVN WARP 서버

echo.
echo  ============================
echo   EVN WARP 서버 시작 중...
echo  ============================
echo.

cd /d "c:\문서\1. 이브이앤솔루션\20. AI\2. 목표관리시스템\evn-warp"

echo [현재 폴더] %CD%
echo.

where node
if %errorlevel% neq 0 (
    echo.
    echo !! Node.js가 설치되지 않았거나 PATH에 없습니다.
    echo    https://nodejs.org 에서 설치해 주세요.
    pause
    exit /b 1
)

echo [Node 버전]
node --version
echo [NPM 버전]
npm --version
echo.
echo 서버를 시작합니다... (시작까지 10~20초 소요)
echo.

npx next dev

echo.
echo 서버가 종료되었습니다.
pause
