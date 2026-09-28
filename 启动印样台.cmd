@echo off
rem 旧文件名保留作转发，真正逻辑在 start-planner.cmd（纯 ASCII，避免编码问题）
call "%~dp0start-planner.cmd"
