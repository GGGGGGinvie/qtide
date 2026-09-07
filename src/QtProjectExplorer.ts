import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProFileParser } from './ProFileParser';
import { CmakeFileParser } from './CmakeFileParser';
import { SimpleCmakeParser } from './SimpleCmakeParser';
import { QrcFileParser } from './QrcFileParser';
import { QtProjectData, QtTreeItem, TreeItemType } from './QtTypeDefine';
import { QtideConfigManager } from './QtideConfig';

class OperationDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        if (element) {
            return [];
        }

        const items: vscode.TreeItem[] = [];

        const openItem = new vscode.TreeItem('打开项目', vscode.TreeItemCollapsibleState.None);
        openItem.command = {
            command: 'qtide.openProject',
            title: '打开项目'
        };
        openItem.iconPath = new vscode.ThemeIcon('folder-opened');
        openItem.tooltip = '打开 Qt 工作区 (.code-workspace)';
        items.push(openItem);

        const newItem = new vscode.TreeItem('新建项目', vscode.TreeItemCollapsibleState.None);
        newItem.command = {
            command: 'qtide.newProject',
            title: '新建项目'
        };
        newItem.iconPath = new vscode.ThemeIcon('new-file');
        newItem.tooltip = '创建新的 Qt 项目';
        items.push(newItem);

        const importItem = new vscode.TreeItem('导入项目', vscode.TreeItemCollapsibleState.None);
        importItem.command = {
            command: 'qtide.importProject',
            title: '导入项目'
        };
        importItem.iconPath = new vscode.ThemeIcon('cloud-download');
        importItem.tooltip = '导入 Qt 项目 (.pro 或 CMakeLists.txt)';
        items.push(importItem);

        const settingsItem = new vscode.TreeItem('Qtide 设置', vscode.TreeItemCollapsibleState.None);
        settingsItem.command = {
            command: 'qtide.openSettings',
            title: 'Qtide 设置'
        };
        settingsItem.iconPath = new vscode.ThemeIcon('gear');
        settingsItem.tooltip = '打开 Qtide 设置面板';
        items.push(settingsItem);

        return items;
    }
}

class ProjectDataProvider implements vscode.TreeDataProvider<QtTreeItem> {

    private _onDidChangeTreeData = new vscode.EventEmitter<QtTreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private projects: QtProjectData[] = [];
    private dirExpandStates = new Map<string, boolean>();

    setDirExpandState(key: string, expanded: boolean): void {
        this.dirExpandStates.set(key, expanded);
    }

    getDirExpandState(key: string): boolean {
        return this.dirExpandStates.get(key) ?? false;
    }

    clearDirExpandStates(): void {
        this.dirExpandStates.clear();
    }

    private defaultCollapsed = false;
    private manualCollapsedKeys = new Set<string>();
    private manualExpandedKeys = new Set<string>();

    private makeNodeKey(projectFilePath: string, type: TreeItemType, extra?: string): string {
        return `${projectFilePath}:${type}:${extra ?? ''}`;
    }

    setNodeCollapsed(key: string, collapsed: boolean): void {
        if (this.defaultCollapsed) {
            if (collapsed) {
                this.manualExpandedKeys.delete(key);
            } else {
                this.manualExpandedKeys.add(key);
            }
        } else {
            if (collapsed) {
                this.manualCollapsedKeys.add(key);
            } else {
                this.manualCollapsedKeys.delete(key);
            }
        }
    }

    getManualCollapsedSize(): number {
        return this.manualCollapsedKeys.size + this.manualExpandedKeys.size;
    }

    collapseAll(): void {
        this.defaultCollapsed = true;
        this.manualExpandedKeys.clear();
        this.manualCollapsedKeys.clear();
        this._onDidChangeTreeData.fire(undefined);
    }

    expandAll(): void {
        this.defaultCollapsed = false;
        this.manualExpandedKeys.clear();
        this.manualCollapsedKeys.clear();
        this._onDidChangeTreeData.fire(undefined);
    }

    setExpandModeNormal(): void {
        this.defaultCollapsed = false;
    }

    private getGroupCollapsibleState(nodeKey?: string, defaultExpanded = true): vscode.TreeItemCollapsibleState {
        let result: vscode.TreeItemCollapsibleState;
        if (nodeKey) {
            if (this.defaultCollapsed) {
                result = this.manualExpandedKeys.has(nodeKey)
                    ? vscode.TreeItemCollapsibleState.Expanded
                    : vscode.TreeItemCollapsibleState.Collapsed;
            } else {
                result = this.manualCollapsedKeys.has(nodeKey)
                    ? vscode.TreeItemCollapsibleState.Collapsed
                    : (defaultExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
            }
        } else {
            result = (this.defaultCollapsed || !defaultExpanded)
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.Expanded;
        }
        return result;
    }

    private getDirCollapsibleState(wasExpanded: boolean, nodeKey?: string): vscode.TreeItemCollapsibleState {
        if (nodeKey) {
            if (this.defaultCollapsed) {
                return this.manualExpandedKeys.has(nodeKey)
                    ? vscode.TreeItemCollapsibleState.Expanded
                    : vscode.TreeItemCollapsibleState.Collapsed;
            } else {
                return this.manualCollapsedKeys.has(nodeKey)
                    ? vscode.TreeItemCollapsibleState.Collapsed
                    : (wasExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed);
            }
        }
        if (this.defaultCollapsed) return vscode.TreeItemCollapsibleState.Collapsed;
        return wasExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
    }

    collectDescendantNodeKeys(element: QtTreeItem | undefined): string[] {
        const keys: string[] = [];
        const children = this.computeChildren(element);
        for (const child of children) {
            if (child.nodeKey) keys.push(child.nodeKey);
            if (child.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
                keys.push(...this.collectDescendantNodeKeys(child));
            }
        }
        return keys;
    }

    setProjects(projects: QtProjectData[]): void {
        this.projects = projects;
        this.dirExpandStates.clear();
        this._onDidChangeTreeData.fire(undefined);
    }

    getProjects(): QtProjectData[] {
        return [...this.projects];
    }

    addOrUpdateProject(data: QtProjectData): void {
        const index = this.projects.findIndex(p => p.projectFilePath === data.projectFilePath);
        if (index >= 0) {
            this.projects[index] = data;
        } else {
            this.projects.push(data);
        }
        this._onDidChangeTreeData.fire(undefined);
    }

    removeProject(projectFilePath: string): void {
        const before = this.projects.length;
        this.projects = this.projects.filter(p => p.projectFilePath !== projectFilePath);
        if (this.projects.length !== before) {
            this.dirExpandStates.clear();
            this._onDidChangeTreeData.fire(undefined);
        }
    }

    getTreeItem(element: QtTreeItem): vscode.TreeItem {
        return element;
    }

    refreshItem(item: QtTreeItem | undefined): void {
        this._onDidChangeTreeData.fire(item);
    }

    private childrenCache = new Map<QtTreeItem | undefined, QtTreeItem[]>();
    private parentMap = new Map<QtTreeItem, QtTreeItem | undefined>();

    getChildren(element?: QtTreeItem): vscode.ProviderResult<QtTreeItem[]> {
        const children = this.computeChildren(element);
        this.childrenCache.set(element, children);
        for (const child of children) {
            this.parentMap.set(child, element);
        }
        return children;
    }

    getChildrenCache(element?: QtTreeItem): QtTreeItem[] {
        return this.childrenCache.get(element) || [];
    }

    computeChildrenPublic(element?: QtTreeItem): QtTreeItem[] {
        return this.computeChildren(element);
    }

    getParent(element: QtTreeItem): QtTreeItem | undefined {
        return this.parentMap.get(element);
    }

    private setItemId(item: QtTreeItem, nodeKey: string): void {
        const collapsed = item.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed ? 1 : 0;
        const tracked = this.manualCollapsedKeys.has(nodeKey) ? 'c' : (this.manualExpandedKeys.has(nodeKey) ? 'e' : 'd');
        item.id = `${nodeKey}:${collapsed}:${tracked}`;
    }

    private computeChildren(element?: QtTreeItem): QtTreeItem[] {
        if (!element) {
            if (this.projects.length === 0) {
                return [];
            }
            return this.projects.map(data => {
                const key = this.makeNodeKey(data.projectFilePath, TreeItemType.PROJECT);
                const item = new QtTreeItem(
                    data.name,
                    TreeItemType.PROJECT,
                    data,
                    this.getGroupCollapsibleState(key)
                );
                item.nodeKey = key;
                this.setItemId(item, key);
                return item;
            });
        }

        switch (element.type) {
            case TreeItemType.PROJECT:
                return this.getProjectChildren(element.projectData);

            case TreeItemType.HEADERS_GROUP:
                return this.getFileChildren(element.projectData, element.projectData.headers, TreeItemType.HEADERS_GROUP);

            case TreeItemType.SOURCES_GROUP:
                return this.getFileChildren(element.projectData, element.projectData.sources, TreeItemType.SOURCES_GROUP);

            case TreeItemType.FORMS_GROUP:
                return this.getFileChildren(element.projectData, element.projectData.forms, TreeItemType.FORMS_GROUP);

            case TreeItemType.RESOURCES_GROUP:
                return this.getFileChildren(element.projectData, element.projectData.resources, TreeItemType.RESOURCES_GROUP);

            case TreeItemType.OTHER_FILES_GROUP:
                return this.getFileChildren(element.projectData, [...(element.projectData.translations || []), ...(element.projectData.distfiles || [])], TreeItemType.OTHER_FILES_GROUP);

            case TreeItemType.RESOURCE_FILE:
                return this.getQrcChildren(element);

            case TreeItemType.QRC_FILES_GROUP:
                return this.getFileChildren(element.projectData, element.fileList || [], TreeItemType.QRC_FILES_GROUP);

            case TreeItemType.DIR_GROUP:
                return this.getDirGroupChildren(element);

            default:
                return [];
        }
    }

    private getProjectChildren(data: QtProjectData): QtTreeItem[] {
        const children: QtTreeItem[] = [];

        const subProjects = data.subProjects || [];
        for (const sub of subProjects) {
            const key = this.makeNodeKey(data.projectFilePath, TreeItemType.PROJECT, sub.projectFilePath);
            const item = new QtTreeItem(
                sub.name,
                TreeItemType.PROJECT,
                sub,
                this.getGroupCollapsibleState(key, false)
            );
            item.nodeKey = key;
            this.setItemId(item, key);
            children.push(item);
        }

        if (!data.isSubProject) {
            children.push(new QtTreeItem(
                path.basename(data.projectFilePath),
                TreeItemType.PRO_FILE,
                data,
                vscode.TreeItemCollapsibleState.None
            ));
        }

        if (data.headers.length > 0) {
            const key = this.makeNodeKey(data.projectFilePath, TreeItemType.HEADERS_GROUP);
            const headersGroup = new QtTreeItem(
                '头文件',
                TreeItemType.HEADERS_GROUP,
                data,
                this.getGroupCollapsibleState(key, false)
            );
            headersGroup.nodeKey = key;
            this.setItemId(headersGroup, key);
            children.push(headersGroup);
        }

        if (data.sources.length > 0) {
            const key = this.makeNodeKey(data.projectFilePath, TreeItemType.SOURCES_GROUP);
            const sourcesGroup = new QtTreeItem(
                '源文件',
                TreeItemType.SOURCES_GROUP,
                data,
                this.getGroupCollapsibleState(key, false)
            );
            sourcesGroup.nodeKey = key;
            this.setItemId(sourcesGroup, key);
            children.push(sourcesGroup);
        }

        if (data.forms.length > 0) {
            const key = this.makeNodeKey(data.projectFilePath, TreeItemType.FORMS_GROUP);
            const formsGroup = new QtTreeItem(
                '界面文件',
                TreeItemType.FORMS_GROUP,
                data,
                this.getGroupCollapsibleState(key, false)
            );
            formsGroup.nodeKey = key;
            this.setItemId(formsGroup, key);
            children.push(formsGroup);
        }

        if (data.resources.length > 0) {
            const key = this.makeNodeKey(data.projectFilePath, TreeItemType.RESOURCES_GROUP);
            const resourcesGroup = new QtTreeItem(
                '资源文件',
                TreeItemType.RESOURCES_GROUP,
                data,
                this.getGroupCollapsibleState(key, false)
            );
            resourcesGroup.nodeKey = key;
            this.setItemId(resourcesGroup, key);
            children.push(resourcesGroup);
        }

        const otherFiles = [...(data.translations || []), ...(data.distfiles || [])];
        if (otherFiles.length > 0) {
            const key = this.makeNodeKey(data.projectFilePath, TreeItemType.OTHER_FILES_GROUP);
            const otherFilesGroup = new QtTreeItem(
                '其他文件',
                TreeItemType.OTHER_FILES_GROUP,
                data,
                this.getGroupCollapsibleState(key, false)
            );
            otherFilesGroup.nodeKey = key;
            this.setItemId(otherFilesGroup, key);
            children.push(otherFilesGroup);
        }

        return children;
    }

    private getQrcChildren(element: QtTreeItem): QtTreeItem[] {
        if (!element.filePath) return [];
        const projectData = element.projectData;
        const qrcAbsPath = path.resolve(projectData.projectFileDir, element.filePath);
        const qrcDir = path.dirname(qrcAbsPath);
        const resources = QrcFileParser.parse(qrcAbsPath);
        const relFiles = resources.map(r => {
            const abs = path.resolve(qrcDir, r);
            return path.relative(projectData.projectFileDir, abs).replace(/\\/g, '/');
        });
        return this.getFileChildren(projectData, relFiles, TreeItemType.QRC_FILES_GROUP);
    }

    private getFileChildren(
        projectData: QtProjectData,
        files: string[],
        groupType: TreeItemType
    ): QtTreeItem[] {
        const fileType = this.getFileTypeForGroup(groupType);
        const projectFileDir = projectData.projectFileDir;

        const ext = this.getFileExtensionForGroup(groupType);

        const filteredFiles = groupType === TreeItemType.QRC_FILES_GROUP
            ? files
            : files.filter(f => {
                const extName = path.extname(f).toLowerCase();
                return ext.includes(extName);
            });

        if (filteredFiles.length === 0) {
            return [];
        }

        const fileDirs = filteredFiles.map(f => {
            const absDir = path.resolve(projectFileDir, path.dirname(f));
            return path.relative(projectFileDir, absDir).replace(/\\/g, '/');
        });

        const dirSet = new Set(fileDirs);
        dirSet.delete('.');
        const commonBase = dirSet.size > 1 ? this.findCommonPrefix([...dirSet]) : undefined;

        const groupDirName = this.getGroupDirName(groupType);

        const dirMap = new Map<string, string[]>();
        const basePrefixMap = new Map<string, string | undefined>();

        for (let i = 0; i < filteredFiles.length; i++) {
            const filePath = filteredFiles[i];
            const relDir = fileDirs[i];
            let dirKey: string;
            let basePrefix: string | undefined;

            if (relDir === '.' || relDir === '') {
                dirKey = '__root__';
            } else if (commonBase && relDir.startsWith(commonBase)) {
                const suffix = relDir.slice(commonBase.length);
                const stripped = suffix.startsWith('/') ? suffix.slice(1) : '';
                dirKey = stripped.length === 0 ? '__root__' : stripped.split('/')[0];
                basePrefix = commonBase;
            } else if (groupDirName && (relDir === groupDirName || relDir.startsWith(groupDirName + '/'))) {
                if (relDir === groupDirName) {
                    dirKey = '__root__';
                } else {
                    dirKey = relDir.slice(groupDirName.length + 1).split('/')[0];
                }
                basePrefix = groupDirName;
            } else {
                dirKey = relDir.split('/')[0];
                basePrefix = undefined;
            }

            if (!dirMap.has(dirKey)) {
                dirMap.set(dirKey, []);
                basePrefixMap.set(dirKey, basePrefix);
            }
            dirMap.get(dirKey)!.push(filePath);
        }

        const dirKeys = [...dirMap.keys()].filter(k => k !== '__root__');

        if (dirKeys.length === 1 && !dirMap.has('__root__')) {
            const flatFiles = dirMap.get(dirKeys[0])!;
            const fileState = this.getFileCollapsibleState(groupType);
            return flatFiles.map(fp => new QtTreeItem(
                path.basename(fp),
                fileType,
                projectData,
                fileState,
                fp
            ));
        }

        const result: QtTreeItem[] = [];

        const rootFiles = dirMap.get('__root__');
        if (rootFiles) {
            const fileState = this.getFileCollapsibleState(groupType);
            for (const fp of rootFiles) {
                result.push(new QtTreeItem(
                    path.basename(fp),
                    fileType,
                    projectData,
                    fileState,
                    fp
                ));
            }
        }

        for (const dirKey of dirKeys) {
            const bp = basePrefixMap.get(dirKey);
            const fullDir = bp ? bp + '/' + dirKey : dirKey;
            const compactPath = this.getCompactDirPath(filteredFiles, projectData, fullDir);
            const label = compactPath ? dirKey + '/' + path.basename(compactPath) : dirKey;
            const effectiveDirPath = compactPath || fullDir;
            const stateKey = `${projectData.projectFilePath}:${groupType}:${effectiveDirPath}`;
            const wasExpanded = this.getDirExpandState(stateKey);
            const nodeKey = this.makeNodeKey(projectData.projectFilePath, groupType, effectiveDirPath);
            const dirNode = new QtTreeItem(
                label,
                TreeItemType.DIR_GROUP,
                projectData,
                this.getDirCollapsibleState(wasExpanded, nodeKey),
                undefined,
                groupType,
                effectiveDirPath
            );
            dirNode.nodeKey = nodeKey;
            this.setItemId(dirNode, nodeKey);
            if (groupType === TreeItemType.QRC_FILES_GROUP) {
                dirNode.fileList = filteredFiles;
            }
            dirNode.updateExpandIcon(wasExpanded);
            result.push(dirNode);
        }

        return result;
    }

    private findCommonPrefix(dirs: string[]): string | undefined {
        if (dirs.length <= 1) return undefined;
        const parts = dirs.map(d => d.split('/'));
        const minLen = Math.min(...parts.map(p => p.length));
        if (minLen === 0) return undefined;
        const common: string[] = [];
        for (let i = 0; i < minLen; i++) {
            const p = parts[0][i];
            if (parts.every(arr => arr[i] === p)) {
                common.push(p);
            } else {
                break;
            }
        }
        return common.length > 0 ? common.join('/') : undefined;
    }

    private getGroupDirName(groupType: TreeItemType): string | undefined {
        switch (groupType) {
            case TreeItemType.HEADERS_GROUP: return 'Headers';
            case TreeItemType.SOURCES_GROUP: return 'Sources';
            case TreeItemType.FORMS_GROUP: return 'Forms';
            case TreeItemType.RESOURCES_GROUP: return 'Resources';
            default: return undefined;
        }
    }

    private getCompactDirPath(
        files: string[],
        projectData: QtProjectData,
        dirPath: string
    ): string | undefined {
        const prefix = dirPath + '/';
        let directCount = 0;
        const subDirs = new Set<string>();

        for (const filePath of files) {
            const absDir = path.resolve(projectData.projectFileDir, path.dirname(filePath));
            const relDir = path.relative(projectData.projectFileDir, absDir).replace(/\\/g, '/');

            if (relDir === dirPath) {
                directCount++;
            } else if (relDir.startsWith(prefix)) {
                subDirs.add(relDir.slice(prefix.length).split('/')[0]);
            }
        }

        if (directCount === 0 && subDirs.size === 1) {
            const onlySub = [...subDirs][0];
            const nextPath = dirPath + '/' + onlySub;
            const deeper = this.getCompactDirPath(files, projectData, nextPath);
            return deeper || nextPath;
        }

        return undefined;
    }

    private getDirGroupChildren(element: QtTreeItem): QtTreeItem[] {
        const { projectData, dirPath, parentGroupType } = element;
        if (!dirPath || !parentGroupType) return [];

        const fileType = this.getFileTypeForGroup(parentGroupType);
        const isQrc = parentGroupType === TreeItemType.QRC_FILES_GROUP;
        const allFiles = isQrc
            ? (element.fileList ?? [])
            : this.getFilesForGroup(projectData, parentGroupType);
        const ext = this.getFileExtensionForGroup(parentGroupType);
        const filteredFiles = isQrc
            ? allFiles
            : allFiles.filter(f => {
                const extName = path.extname(f).toLowerCase();
                return ext.includes(extName);
            });

        const prefix = dirPath + '/';

        const directFiles: string[] = [];
        const subDirMap = new Map<string, string[]>();

        for (const filePath of filteredFiles) {
            const absDir = path.resolve(projectData.projectFileDir, path.dirname(filePath));
            const relDir = path.relative(projectData.projectFileDir, absDir).replace(/\\/g, '/');

            if (relDir === dirPath) {
                directFiles.push(filePath);
            } else if (relDir.startsWith(prefix)) {
                const rest = relDir.slice(prefix.length);
                const subDir = rest.split('/')[0];
                if (!subDirMap.has(subDir)) {
                    subDirMap.set(subDir, []);
                }
                subDirMap.get(subDir)!.push(filePath);
            }
        }

        const result: QtTreeItem[] = [];

        const fileState = this.getFileCollapsibleState(parentGroupType);
        for (const fp of directFiles) {
            result.push(new QtTreeItem(
                path.basename(fp),
                fileType,
                projectData,
                fileState,
                fp
            ));
        }

        for (const [subDir] of subDirMap) {
            const subDirPath = dirPath + '/' + subDir;
            const stateKey = `${projectData.projectFilePath}:${parentGroupType}:${subDirPath}`;
            const wasExpanded = this.getDirExpandState(stateKey);
            const nodeKey = this.makeNodeKey(projectData.projectFilePath, parentGroupType, subDirPath);
            const dirNode = new QtTreeItem(
                subDir,
                TreeItemType.DIR_GROUP,
                projectData,
                this.getDirCollapsibleState(wasExpanded, nodeKey),
                undefined,
                parentGroupType,
                subDirPath
            );
            dirNode.nodeKey = nodeKey;
            this.setItemId(dirNode, nodeKey);
            if (isQrc) {
                dirNode.fileList = filteredFiles;
            }
            dirNode.updateExpandIcon(wasExpanded);
            result.push(dirNode);
        }

        return result;
    }

    private getFileTypeForGroup(groupType: TreeItemType): TreeItemType {
        switch (groupType) {
            case TreeItemType.HEADERS_GROUP: return TreeItemType.HEADER_FILE;
            case TreeItemType.SOURCES_GROUP: return TreeItemType.SOURCE_FILE;
            case TreeItemType.FORMS_GROUP: return TreeItemType.FORM_FILE;
            case TreeItemType.RESOURCES_GROUP: return TreeItemType.RESOURCE_FILE;
            case TreeItemType.OTHER_FILES_GROUP: return TreeItemType.OTHER_FILE;
            case TreeItemType.QRC_FILES_GROUP: return TreeItemType.QRC_RESOURCE;
            default: return TreeItemType.HEADER_FILE;
        }
    }

    private getFileExtensionForGroup(groupType: TreeItemType): string[] {
        switch (groupType) {
            case TreeItemType.HEADERS_GROUP: return ['.h', '.hpp', '.hxx', '.hh', '.h++'];
            case TreeItemType.SOURCES_GROUP: return ['.cpp', '.c', '.cc', '.cxx', '.c++'];
            case TreeItemType.FORMS_GROUP: return ['.ui'];
            case TreeItemType.RESOURCES_GROUP: return ['.qrc'];
            case TreeItemType.OTHER_FILES_GROUP: return ['.ts', '.qm'];
            default: return [];
        }
    }

    private getFilesForGroup(projectData: QtProjectData, groupType: TreeItemType): string[] {
        switch (groupType) {
            case TreeItemType.HEADERS_GROUP: return projectData.headers;
            case TreeItemType.SOURCES_GROUP: return projectData.sources;
            case TreeItemType.FORMS_GROUP: return projectData.forms;
            case TreeItemType.RESOURCES_GROUP: return projectData.resources;
            case TreeItemType.OTHER_FILES_GROUP: return [...(projectData.translations || []), ...(projectData.distfiles || [])];
            case TreeItemType.QRC_FILES_GROUP: return [];
            default: return [];
        }
    }

    private getFileCollapsibleState(groupType: TreeItemType): vscode.TreeItemCollapsibleState {
        return groupType === TreeItemType.RESOURCES_GROUP
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None;
    }
}

export class QtProjectExplorer {

    private operationProvider: OperationDataProvider;
    private projectProvider: ProjectDataProvider;

    private operationView: vscode.TreeView<vscode.TreeItem>;
    private projectView: vscode.TreeView<QtTreeItem>;
    private currentExpandedKeys = new Set<string>();

    private fileWatchers: vscode.FileSystemWatcher[] = [];
    private refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();

    private settingsPanel: vscode.WebviewPanel | undefined;

    private workspaceRoot: string | undefined;

    constructor(context: vscode.ExtensionContext) {
        this.operationProvider = new OperationDataProvider();
        this.projectProvider = new ProjectDataProvider();

        this.operationView = vscode.window.createTreeView('qtide.view.operations', {
            treeDataProvider: this.operationProvider
        });

        this.projectView = vscode.window.createTreeView('qtide.view.project', {
            treeDataProvider: this.projectProvider
        });

        context.subscriptions.push(this.operationView);
        context.subscriptions.push(this.projectView);

        context.subscriptions.push(
            this.projectView.onDidExpandElement(e => {
                this.projectProvider.setExpandModeNormal();
                const item = e.element as QtTreeItem;
                if (item.nodeKey) this.currentExpandedKeys.add(item.nodeKey);
                if (item.type === TreeItemType.DIR_GROUP) {
                    const key = `${item.projectData.projectFilePath}:${item.parentGroupType}:${item.dirPath}`;
                    this.projectProvider.setDirExpandState(key, true);
                    item.updateExpandIcon(true);
                    this.projectProvider.refreshItem(item);
                }
            })
        );

        context.subscriptions.push(
            this.projectView.onDidCollapseElement(e => {
                this.projectProvider.setExpandModeNormal();
                const item = e.element as QtTreeItem;
                if (item.nodeKey) this.currentExpandedKeys.delete(item.nodeKey);
                if (item.type === TreeItemType.DIR_GROUP) {
                    const key = `${item.projectData.projectFilePath}:${item.parentGroupType}:${item.dirPath}`;
                    this.projectProvider.setDirExpandState(key, false);
                    item.updateExpandIcon(false);
                    this.projectProvider.refreshItem(item);
                }
            })
        );

        this.workspaceRoot = this.resolveWorkspaceRoot();
        void this.scanWorkspace();
    }

    private resolveWorkspaceRoot(): string | undefined {
        if (vscode.workspace.workspaceFile) {
            return path.dirname(vscode.workspace.workspaceFile.fsPath);
        }
        if (vscode.workspace.workspaceFolders?.length) {
            return vscode.workspace.workspaceFolders[0].uri.fsPath;
        }
        return undefined;
    }

    async scanWorkspace(): Promise<void> {
        this.workspaceRoot = this.resolveWorkspaceRoot();
        if (!this.workspaceRoot || !vscode.workspace.workspaceFolders?.length) {
            return;
        }

        const [proUris, cmakeUris] = await Promise.all([
            vscode.workspace.findFiles(
                '**/*.pro',
                '{**/node_modules/**,**/.git/**,**/build/**,**/out/**}'
            ),
            vscode.workspace.findFiles(
                '**/CMakeLists.txt',
                '{**/node_modules/**,**/.git/**,**/build/**,**/out/**}'
            ),
        ]);

        const allUris = [...proUris, ...cmakeUris];

        if (allUris.length === 0) {
            return;
        }

        const tracked: vscode.Uri[] = [];
        const untracked: vscode.Uri[] = [];

        for (const uri of allUris) {
            if (QtideConfigManager.isTracked(uri.fsPath)) {
                tracked.push(uri);
            } else {
                untracked.push(uri);
            }
        }

        for (const uri of tracked) {
            await this.loadProject(uri.fsPath, { silent: true });
        }

        if (untracked.length === 0) {
            return;
        }

        if (untracked.length === 1) {
            const name = path.basename(untracked[0].fsPath, '.pro');
            await this.loadProject(untracked[0].fsPath, { silent: true });
            QtideConfigManager.save(untracked[0].fsPath, name);
            vscode.window.showInformationMessage(`已加载 Qt 项目：${name}`);
            return;
        }

        await this.promptProjectSelection(untracked);
    }

    private async promptProjectSelection(uris: vscode.Uri[]): Promise<void> {
        const allItem: vscode.QuickPickItem & { isAll?: boolean; uri?: vscode.Uri } = {
            label: '全部项目',
            description: `加载全部 ${uris.length} 个项目`,
            isAll: true,
        };

        const projItems: (vscode.QuickPickItem & { isAll?: boolean; uri?: vscode.Uri })[] = uris.map(uri => {
            const fileName = path.basename(uri.fsPath);
            const name = fileName === 'CMakeLists.txt'
                ? path.basename(path.dirname(uri.fsPath))
                : path.basename(uri.fsPath, '.pro');
            const dir = path.relative(this.workspaceRoot!, path.dirname(uri.fsPath));
            return {
                label: name,
                description: dir,
                detail: uri.fsPath,
                uri,
            };
        });

        const items = [...projItems, allItem];

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择要加载的项目（回车确认，ESC 取消）',
            title: 'Qtide - 选择项目',
        });

        if (!selected) {
            vscode.window.showInformationMessage('未加载任何项目。');
            return;
        }

        if (selected.isAll) {
            for (const uri of uris) {
                await this.loadProject(uri.fsPath, { silent: true });
                const fileName = path.basename(uri.fsPath);
                const name = fileName === 'CMakeLists.txt'
                    ? path.basename(path.dirname(uri.fsPath))
                    : path.basename(uri.fsPath, '.pro');
                QtideConfigManager.save(uri.fsPath, name);
            }
            return;
        }

        await this.loadProject(selected.uri!.fsPath);
        QtideConfigManager.save(selected.uri!.fsPath, selected.label);
    }

    async removeProject(item?: QtTreeItem): Promise<void> {
        if (!item || item.type !== TreeItemType.PROJECT) {
            return;
        }

        const projectFilePath = item.projectData.projectFilePath;
        const projectName = item.projectData.name;

        const confirm = await vscode.window.showWarningMessage(
            `从 Qtide 移除项目 "${projectName}"？`,
            { modal: true },
            '移除'
        );

        if (confirm !== '移除') {
            return;
        }

        this.projectProvider.removeProject(projectFilePath);
        this.clearRefreshTimer(projectFilePath);
        this.setupWatchers();

        QtideConfigManager.remove(projectFilePath);

        vscode.window.showInformationMessage(`项目 "${projectName}" 已移除。`);
    }

    async importProject(): Promise<void> {
        const typePicks: (vscode.QuickPickItem & { projectType: 'qmake' | 'cmake' })[] = [
            { label: 'qmake (.pro)', description: '从 .pro 文件导入 Qt qmake 项目', projectType: 'qmake' },
            { label: 'CMake (CMakeLists.txt)', description: '导入 CMake 项目', projectType: 'cmake' },
        ];

        const selectedType = await vscode.window.showQuickPick(typePicks, {
            title: 'Qtide - 选择项目类型',
            placeHolder: '选择要导入的项目文件类型...',
        });

        if (!selectedType) {
            return;
        }

        let filters: { [name: string]: string[] };
        let dialogTitle: string;

        if (selectedType.projectType === 'qmake') {
            filters = { 'Qt 项目文件': ['pro'] };
            dialogTitle = '选择 Qt .pro 文件';
        } else {
            filters = { 'CMake 项目文件 (CMakeLists.txt)': ['txt'] };
            dialogTitle = '选择 CMakeLists.txt';
        }

        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters,
            title: dialogTitle,
        });

        if (!uris || uris.length === 0) {
            return;
        }

        const filePath = uris[0].fsPath;
        const fileName = path.basename(filePath);

        if (selectedType.projectType === 'cmake') {
            if (fileName !== 'CMakeLists.txt' && fileName !== 'CMakeCache.txt') {
                vscode.window.showWarningMessage(
                    `期望 CMakeLists.txt，得到 "${fileName}"。仍尝试加载。`
                );
            }
            await this.loadProject(uris[0].fsPath);
            QtideConfigManager.save(uris[0].fsPath, path.basename(path.dirname(uris[0].fsPath)));
        } else {
            await this.loadProject(uris[0].fsPath);
            QtideConfigManager.save(uris[0].fsPath, path.basename(uris[0].fsPath, '.pro'));
        }
    }

    async openProject(): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'VS Code 工作区': ['code-workspace']
            },
            title: '打开 Qt 工作区 (.code-workspace)'
        });

        if (!uris || uris.length === 0) {
            return;
        }

        const targetPath = uris[0].fsPath;

        if (vscode.workspace.workspaceFile &&
            vscode.workspace.workspaceFile.fsPath === targetPath) {
            vscode.window.showInformationMessage('该工作区已打开。');
            return;
        }

        await vscode.commands.executeCommand(
            'vscode.openFolder',
            vscode.Uri.file(targetPath),
            false
        );
    }

    async newProject(): Promise<void> {
        vscode.window.showInformationMessage('新建项目：功能开发中。');
    }

    async openSettings(): Promise<void> {
        if (this.settingsPanel) {
            this.settingsPanel.reveal();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'qtide.settings',
            'Qtide 设置',
            vscode.ViewColumn.Active,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        panel.iconPath = vscode.Uri.joinPath(QtTreeItem.extensionUri, 'res', 'icon', 'qtide.svg');

        const settingsDir = path.join(QtTreeItem.extensionUri.fsPath, 'res', 'html', 'settings');
        const htmlFile = path.join(settingsDir, 'index.html');
        let html = fs.readFileSync(htmlFile, 'utf-8');
        html = html.replace(
            /((?:src|href)=")([^"]+?\.(?:css|js))(")/gi,
            (_, prefix, filePath, suffix) => {
                const absPath = path.resolve(settingsDir, filePath);
                return `${prefix}${panel.webview.asWebviewUri(vscode.Uri.file(absPath)).toString()}${suffix}`;
            }
        );
        panel.webview.html = html;

        const settingsModel = {
            config: {
                groups: [
                    {
                        label: '通用',
                        id: 'general',
                        fields: [
                            { key: 'projectName', label: '项目名称', type: 'text', value: '', description: '新项目的默认名称' },
                            { key: 'buildDir', label: '构建目录', type: 'text', value: 'build', description: '默认构建输出目录' },
                            { key: 'qtVersion', label: 'Qt 版本', type: 'dropdown', value: '6.5', options: [{ label: 'Qt 5.15', value: '5.15' }, { label: 'Qt 6.2', value: '6.2' }, { label: 'Qt 6.5', value: '6.5' }, { label: 'Qt 6.6', value: '6.6' }] }
                        ]
                    },
                    {
                        label: '编辑器',
                        id: 'editor',
                        fields: [
                            { key: 'autoComplete', label: '自动补全', type: 'checkbox', value: true, description: '启用代码自动补全' },
                            { key: 'formatOnSave', label: '保存时格式化', type: 'checkbox', value: false, description: '保存时自动格式化文件' },
                            { key: 'tabSize', label: '缩进大小', type: 'dropdown', value: '4', options: [{ label: '2 空格', value: '2' }, { label: '4 空格', value: '4' }, { label: '8 空格', value: '8' }] }
                        ]
                    },
                    {
                        label: '构建',
                        id: 'build',
                        fields: [
                            { key: 'buildJobs', label: '并行任务数', type: 'dropdown', value: '4', options: [{ label: '1 个任务', value: '1' }, { label: '2 个任务', value: '2' }, { label: '4 个任务', value: '4' }, { label: '8 个任务', value: '8' }] },
                            { key: 'makeFlags', label: 'Make 标志', type: 'textarea', value: '', description: 'make 的附加标志' },
                            { key: 'cleanBeforeBuild', label: '构建前清理', type: 'checkbox', value: false, description: '构建前运行 clean 目标' }
                        ]
                    }
                ]
            }
        };

        panel.webview.onDidReceiveMessage(async (msg: any) => {
            if (typeof msg === 'string') {
                if (msg === 'qtide.settings.launched') {
                    panel.webview.postMessage(settingsModel);
                }
            }
        });

        panel.onDidDispose(() => {
            this.settingsPanel = undefined;
        });

        this.settingsPanel = panel;
    }

    async loadProject(
        filePath: string,
        options?: { silent?: boolean }
    ): Promise<void> {
        const ext = path.extname(filePath).toLowerCase();
        let data: QtProjectData | null;

        if (ext === '.pro') {
            data = ProFileParser.parse(filePath);
        } else {
            data = SimpleCmakeParser.parse(filePath);
            if (data) {
                const hasUnresolved = [...data.sources, ...data.headers, ...data.forms, ...(data.translations || [])]
                    .some(f => f.includes('${'));
                if (hasUnresolved) {
                    data = null;
                }
            }
            if (!data || (!data.sources.length && !data.headers.length
                && !data.forms.length && !data.resources.length)) {
                data = CmakeFileParser.parse(filePath);
            }
        }

        if (!data) {
            if (!options?.silent) {
                vscode.window.showErrorMessage(`解析项目文件失败：${path.basename(filePath)}`);
            }
            return;
        }

        this.projectProvider.addOrUpdateProject(data);
        this.setupWatchers();

        if (!options?.silent) {
            console.log(
                `Project "${data.name}" loaded. ` +
                `Sources: ${data.sources.length}, Headers: ${data.headers.length}, ` +
                `Forms: ${data.forms.length}, Resources: ${data.resources.length}`
            );
            await this.promptSaveWorkspace(data);
        }
    }

    private async promptSaveWorkspace(data: QtProjectData): Promise<void> {
        const projectTypeLabel = data.projectType === 'cmake' ? 'CMake' : 'qmake';
        const selection = await vscode.window.showInformationMessage(
            `[${projectTypeLabel}] 项目 "${data.name}" 已导入。继续以自动保存工作区，取消以选择自定义路径。`,
            '继续', '取消'
        );

        let targetPath: string | undefined;

        if (selection === '继续') {
            targetPath = path.join(data.projectFileDir, `${data.name}.code-workspace`);
        } else if (selection === '取消') {
            const defaultUri = vscode.Uri.file(
                path.join(data.projectFileDir, `${data.name}.code-workspace`)
            );
            const uri = await vscode.window.showSaveDialog({
                defaultUri,
                filters: { 'VS Code 工作区': ['code-workspace'] },
                title: '工作区文件另存为'
            });
            if (uri) {
                targetPath = uri.fsPath;
            }
        }

        if (targetPath) {
            const workspaceContent = {
                folders: [{ path: '.' }],
                settings: {}
            };
            try {
                fs.writeFileSync(targetPath, JSON.stringify(workspaceContent, null, 4));

                const openSelection = await vscode.window.showInformationMessage(
                    `工作区文件已保存：${path.basename(targetPath)}。在 VS Code 中打开？`,
                    '是', '稍后'
                );
                if (openSelection === '是') {
                    await vscode.commands.executeCommand(
                        'vscode.openFolder',
                        vscode.Uri.file(targetPath),
                        false
                    );
                }
            } catch (error) {
                vscode.window.showErrorMessage(
                    `保存工作区文件失败：${error}`
                );
            }
        }
    }

    async refreshAllProjects(): Promise<void> {
        const projects = this.projectProvider.getProjects();
        if (projects.length === 0) {
            vscode.window.showWarningMessage('当前未打开任何项目。');
            return;
        }

        for (const proj of projects) {
            await this.loadProject(proj.projectFilePath, { silent: true });
        }

        vscode.window.showInformationMessage(
            projects.length === 1
                ? '项目已刷新。'
                : `已刷新 ${projects.length} 个项目。`
        );
    }

    async collapseAll(item?: QtTreeItem): Promise<void> {
        if (!item) {
            this.projectProvider.collapseAll();
            return;
        }
        const keys = this.projectProvider.collectDescendantNodeKeys(item);
        for (const key of keys) {
            this.projectProvider.setNodeCollapsed(key, true);
        }
        this.projectProvider.refreshItem(undefined);
    }

    async expandAll(item?: QtTreeItem): Promise<void> {
        if (!item) {
            this.projectProvider.expandAll();
            await new Promise(r => setTimeout(r, 50));
            await this.expandRecursively(undefined);
            return;
        }
        if (item.nodeKey) this.projectProvider.setNodeCollapsed(item.nodeKey, false);
        const keys = this.projectProvider.collectDescendantNodeKeys(item);
        for (const key of keys) {
            this.projectProvider.setNodeCollapsed(key, false);
        }
        if (item.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            try {
                await this.projectView.reveal(item, { expand: true, select: true, focus: false });
            } catch {
            }
        }
        await this.expandRecursively(item);
    }

    async toggleNode(item?: QtTreeItem): Promise<void> {
        if (!item) {
            return;
        }
        if (item.collapsibleState === vscode.TreeItemCollapsibleState.None) {
            return;
        }
        const isCurrentlyExpanded = item.nodeKey ? this.currentExpandedKeys.has(item.nodeKey) : false;
        const shouldExpand = !isCurrentlyExpanded;
        if (shouldExpand) {
            if (item.nodeKey) this.projectProvider.setNodeCollapsed(item.nodeKey, false);
            try {
                await this.projectView.reveal(item, { expand: true, select: true, focus: false });
            } catch {
            }
        } else {
            if (item.nodeKey) this.projectProvider.setNodeCollapsed(item.nodeKey, true);
            this.projectProvider.refreshItem(undefined);
        }
    }

    private async collapseRecursively(element: QtTreeItem | undefined): Promise<void> {
        const children = this.projectProvider.getChildrenCache(element);
        for (const child of children) {
            await this.collapseRecursively(child);
            if (child.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
                try {
                    await this.projectView.reveal(child, { expand: false, select: false, focus: false });
                } catch {
                }
            }
        }
    }

    private async expandRecursively(element: QtTreeItem | undefined): Promise<void> {
        const children = this.projectProvider.getChildrenCache(element);
        for (const child of children) {
            if (child.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
                try {
                    await this.projectView.reveal(child, { expand: true, select: false, focus: false });
                } catch {
                }
                await this.expandRecursively(child);
            }
        }
    }

    async openTreeFile(item?: QtTreeItem): Promise<void> {
        if (!item) {
            return;
        }
        const uri = item.getUri();
        if (uri) {
            await vscode.commands.executeCommand('vscode.open', uri);
        }
    }

    async revealInExplorer(item?: QtTreeItem): Promise<void> {
        if (!item) {
            return;
        }
        const uri = item.getUri();
        if (uri) {
            await vscode.commands.executeCommand('revealFileInOS', uri);
        }
    }

    async copyPath(item?: QtTreeItem): Promise<void> {
        if (!item) {
            return;
        }
        const absPath = item.getAbsolutePath();
        if (!absPath) {
            return;
        }
        await vscode.env.clipboard.writeText(absPath);
        vscode.window.showInformationMessage('路径已复制到剪贴板。');
    }

    getCurrentProject(): QtProjectData | null {
        const projects = this.projectProvider.getProjects();
        return projects.length > 0 ? projects[0] : null;
    }

    getProjects(): QtProjectData[] {
        return this.projectProvider.getProjects();
    }

    private setupWatchers(): void {
        this.disposeWatchers();

        for (const proj of this.projectProvider.getProjects()) {
            const projectWatcher = vscode.workspace.createFileSystemWatcher(proj.projectFilePath);
            projectWatcher.onDidChange(() => this.scheduleProjectRefresh(proj.projectFilePath));
            projectWatcher.onDidCreate(() => this.scheduleProjectRefresh(proj.projectFilePath));
            projectWatcher.onDidDelete(() => this.onProjectFileDeleted(proj.projectFilePath));
            this.fileWatchers.push(projectWatcher);

            const dirPattern = new vscode.RelativePattern(
                vscode.Uri.file(proj.projectFileDir),
                '**/*'
            );
            const dirWatcher = vscode.workspace.createFileSystemWatcher(dirPattern);
            dirWatcher.onDidChange(uri => this.onProjectDirChanged(proj.projectFilePath, uri));
            dirWatcher.onDidCreate(uri => this.onProjectDirChanged(proj.projectFilePath, uri));
            dirWatcher.onDidDelete(uri => this.onProjectDirChanged(proj.projectFilePath, uri));
            this.fileWatchers.push(dirWatcher);
        }
    }

    private onProjectFileDeleted(filePath: string): void {
        this.projectProvider.removeProject(filePath);
        this.clearRefreshTimer(filePath);
        this.setupWatchers();
        QtideConfigManager.remove(filePath);
        vscode.window.showWarningMessage(`已移除项目：${path.basename(filePath)}`);
    }

    private onProjectDirChanged(filePath: string, uri: vscode.Uri): void {
        const basename = path.basename(uri.fsPath).toLowerCase();
        if (basename.endsWith('.pro') || basename === 'cmakelists.txt') {
            return;
        }
        this.scheduleProjectRefresh(filePath);
    }

    private scheduleProjectRefresh(projectFilePath: string): void {
        const existing = this.refreshTimers.get(projectFilePath);
        if (existing) {
            clearTimeout(existing);
        }

        const timer = setTimeout(() => {
            this.refreshTimers.delete(projectFilePath);
            void this.loadProject(projectFilePath, { silent: true });
        }, 300);

        this.refreshTimers.set(projectFilePath, timer);
    }

    private clearRefreshTimer(projectFilePath: string): void {
        const timer = this.refreshTimers.get(projectFilePath);
        if (timer) {
            clearTimeout(timer);
            this.refreshTimers.delete(projectFilePath);
        }
    }

    private disposeWatchers(): void {
        for (const watcher of this.fileWatchers) {
            watcher.dispose();
        }
        this.fileWatchers = [];
    }

    dispose(): void {
        for (const timer of this.refreshTimers.values()) {
            clearTimeout(timer);
        }
        this.refreshTimers.clear();
        this.disposeWatchers();
        this.operationView.dispose();
        this.projectView.dispose();
    }
}









