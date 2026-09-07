# 更新日志

所有关于 "qtide" 扩展的重要变更都将记录在此文件中。

## [未发布]

## [0.0.9] - 2026-09-04

### 修复

- 修复 .pro 项目中使用 `$$PWD` 等变量时，点击文件打开路径重复拼接的问题（如 `C:\project\C:\project\src\main.cpp`）。根因为 `ProFileParser` 将 `$$PWD` 替换为绝对路径后未归一化为相对路径，下游 `QtTreeItem` 用 `path.join` 二次拼接。改用 `path.resolve` 正确处理绝对路径参数。
