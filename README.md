# Qtide

Qtide 是一个 VS Code 扩展，用于解析和浏览 Qt 项目文件，提供类似 Qt Creator 的项目文件树视图。支持 **qmake (.pro)** 和 **CMake (CMakeLists.txt)** 两种项目类型。

### 功能

#### 项目导入与管理
- **导入项目** — 通过 QuickPick 选择项目类型（qmake / CMake），选择 `.pro` 或 `CMakeLists.txt` 即可导入
- **打开工作区** — 打开已保存的 `.code-workspace` 工作区文件，恢复项目状态
- **新建项目** — 创建新的 Qt 项目（功能开发中）
- **移除项目** — 从项目树中移除指定项目
- **自动发现** — 工作区内的 `.pro` 和 `CMakeLists.txt` 自动加载到项目树
- **工作区保存** — 导入成功后提示保存 `.code-workspace`，支持自定义路径

#### 项目文件树
侧边栏按分组展示项目文件结构，每个分组使用专属双态图标（展开/折叠）：
- **头文件** — `.h`、`.hpp`、`.hxx`、`.hh`
- **源文件** — `.cpp`、`.c`、`.cc`、`.cxx`、`.c++`
- **界面文件** — `.ui`
- **资源文件** — `.qrc`
- **其他文件** — 翻译文件（`.ts`、`.qm`）、分发文件（`DISTFILES`）等

#### QRC 资源文件解析
- 展开 `.qrc` 文件节点时自动解析内部引用的资源文件
- 使用独立分组展示 QRC 内文件

#### 文件操作
- **打开文件** — 在编辑器中打开选中的文件
- **在资源管理器中显示** — 在系统文件管理器中定位文件
- **复制路径** — 复制文件绝对路径到剪贴板

#### 项目树交互
- **刷新项目** — 重新解析所有已加载项目
- **全部展开 / 全部折叠** — 全局或基于节点的展开折叠操作
- **展开/折叠切换** — 切换指定节点的状态

#### .pro/.pri 语法高亮
为 qmake 项目文件（`.pro`、`.pri`）提供 TextMate 语法高亮，覆盖以下要素：
- **注释** — `#` 行注释
- **变量赋值** — `=`、`+=`、`-=`、`*=`、`~=`、`:=` 运算符，内置变量（`QT`、`TARGET`、`SOURCES`、`HEADERS`、`CONFIG` 等）特殊高亮
- **条件块** — 平台/配置标识符（`win32`、`unix`、`macx`、`debug`、`release` 等）及 `!` 取反
- **控制流** — `if`、`else`、`for`、`defineTest`、`defineReplace`、`return` 等
- **内置函数** — `message()`、`contains()`、`isEqual()`、`exists()`、`include()` 等
- **变量引用** — `$$VAR`、`$${VAR}`、`$$[QT_INSTALL_PREFIX]`、`$$(PATH)`（环境变量）
- **字符串** — 单引号/双引号字符串，支持内部变量引用插值
- **续行符** — 行末 `\` 高亮
- **括号匹配/自动闭合**、注释切换

#### qmake 项目解析
支持以下 `.pro` 变量：
- `TARGET`（项目名）、`HEADERS`、`SOURCES`、`FORMS`、`RESOURCES`、`TRANSLATIONS`、`DISTFILES`
- `+=` / `=` 赋值运算符
- `\` 续行符、`#` 注释
- `$$VAR` 变量引用（`$$PWD` 等）
- `include()` 子项目递归解析（`.pri` 文件）

#### CMake 项目解析
双解析器回退策略，优先使用 `SimpleCmakeParser`，结果含未解析变量时自动切换 `CmakeFileParser`：
- 识别 `project()` 命令获取项目名
- 支持 `set()` 变量定义和 `get_filename_component()` 命令
- 从 `add_executable()` / `qt_add_executable()` 提取源文件
- 自动解析 `${VAR}` 变量引用和内置 CMake 变量

#### 设置面板
通过 Webview 提供图形化设置界面。

### 使用

1. 点击侧边栏 **Qtide** 图标，在操作视图中选择 **导入项目**
2. 选择 **qmake (.pro)** 或 **CMake (CMakeLists.txt)**
3. 选择项目文件
4. 项目文件树自动显示，支持展开/折叠、打开文件、右键菜单操作
5. 按提示保存工作区文件（可选）

### 鸣谢

感谢 [eide](https://github.com/github0null/eide) 项目，本项目的实现参考了其设计和代码。

### 构建

```bash
# 编译扩展
npm install
npm run compile

# 构建设置面板（需先安装 Node.js）
cd webview/settings
npm install
npm run build
```

### 许可

MIT