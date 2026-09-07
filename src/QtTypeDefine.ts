import * as vscode from 'vscode';
import * as path from 'path';

/**
 * 树节点类型枚举
 */
export enum TreeItemType {
    PROJECT,
    PRO_FILE,
    HEADERS_GROUP,
    SOURCES_GROUP,
    FORMS_GROUP,
    RESOURCES_GROUP,
    DIR_GROUP,
    HEADER_FILE,
    SOURCE_FILE,
    FORM_FILE,
    RESOURCE_FILE,
    OTHER_FILES_GROUP,
    OTHER_FILE,
    QRC_FILES_GROUP,
    QRC_RESOURCE,
}

/**
 * .pro 文件解析后的项目数据结构
 */
export enum ProjectType {
    QMAKE = 'qmake',
    CMAKE = 'cmake',
}

export interface QtProjectData {
    /** 工程名称 (TARGET / project name) */
    name: string;
    /** 项目类型 */
    projectType: ProjectType;
    /** 项目文件（.pro / CMakeLists.txt）的绝对路径 */
    projectFilePath: string;
    /** 项目文件所在目录的绝对路径 */
    projectFileDir: string;
    /** HEADERS 文件列表（相对路径） */
    headers: string[];
    /** SOURCES 文件列表（相对路径） */
    sources: string[];
    /** FORMS 文件列表（相对路径） */
    forms: string[];
    /** RESOURCES 文件列表（相对路径） */
    resources: string[];
    /** 翻译文件列表（可选） */
    translations?: string[];
    /** DISTFILES 分发文件列表（可选） */
    distfiles?: string[];
    /** include(.pri) 解析出的子项目（可选） */
    subProjects?: QtProjectData[];
    /** 标记是否为 .pri 子项目 */
    isSubProject?: boolean;
}

/**
 * 自定义 TreeItem，携带节点类型和项目数据
 */
export class QtTreeItem extends vscode.TreeItem {

    static extensionUri: vscode.Uri;

    type: TreeItemType;
    projectData: QtProjectData;
    filePath?: string;
    parentGroupType?: TreeItemType;
    dirPath?: string;
    fileList?: string[];
    nodeKey?: string;

    constructor(
        label: string,
        type: TreeItemType,
        projectData: QtProjectData,
        collapsibleState: vscode.TreeItemCollapsibleState,
        filePath?: string,
        parentGroupType?: TreeItemType,
        dirPath?: string
    ) {
        super(label, collapsibleState);
        this.type = type;
        this.projectData = projectData;
        this.filePath = filePath;
        this.parentGroupType = parentGroupType;
        this.dirPath = dirPath;

        this.setupAppearance();
    }

    static iconMap: Record<string, { open: string; close: string }> = {
        [TreeItemType.PROJECT]: { open: 'qt_open.svg', close: 'qt_close.svg' },
        [TreeItemType.HEADERS_GROUP]: { open: 'h_open.svg', close: 'h_close.svg' },
        [TreeItemType.SOURCES_GROUP]: { open: 'cpp_open.svg', close: 'cpp_close.svg' },
        [TreeItemType.FORMS_GROUP]: { open: 'pen_open.svg', close: 'pen_close.svg' },
        [TreeItemType.RESOURCES_GROUP]: { open: 'res_open.svg', close: 'res_close.svg' },
        [TreeItemType.DIR_GROUP]: { open: 'dir_open.svg', close: 'dir_close.svg' },
        [TreeItemType.OTHER_FILES_GROUP]: { open: 'other_open.svg', close: 'other_close.svg' },
    };

    private setExpandableIcon(isExpanded: boolean): void {
        const pair = QtTreeItem.iconMap[this.type];
        if (pair) {
            this.iconPath = vscode.Uri.joinPath(
                QtTreeItem.extensionUri, 'res', 'icon',
                isExpanded ? pair.open : pair.close
            );
        }
    }

    updateExpandIcon(isExpanded: boolean): void {
        this.setExpandableIcon(isExpanded);
    }

    private setupAppearance(): void {
        switch (this.type) {
            case TreeItemType.PROJECT:
                this.setExpandableIcon(true);
                this.contextValue = 'project';
                this.tooltip = `名称：${this.projectData.name}\n路径：${this.projectData.projectFileDir}`;
                break;

            case TreeItemType.PRO_FILE:
                this.iconPath = vscode.ThemeIcon.File;
                this.resourceUri = vscode.Uri.file(this.projectData.projectFilePath);
                this.contextValue = 'qtFile';
                this.tooltip = `${this.projectData.projectFilePath}`;
                this.command = {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [vscode.Uri.file(this.projectData.projectFilePath)]
                };
                break;

            case TreeItemType.HEADERS_GROUP:
                this.setExpandableIcon(true);
                this.contextValue = 'headersGroup';
                this.tooltip = `头文件（${this.projectData.headers.length} 个）\n${this.projectData.headers.map(f => '  • ' + path.basename(f)).join('\n')}`;
                break;

            case TreeItemType.SOURCES_GROUP:
                this.setExpandableIcon(true);
                this.contextValue = 'sourcesGroup';
                this.tooltip = `源文件（${this.projectData.sources.length} 个）\n${this.projectData.sources.map(f => '  • ' + path.basename(f)).join('\n')}`;
                break;

            case TreeItemType.FORMS_GROUP:
                this.setExpandableIcon(true);
                this.contextValue = 'formsGroup';
                this.tooltip = `Forms (${this.projectData.forms.length} files)\n${this.projectData.forms.map(f => '  • ' + path.basename(f)).join('\n')}`;
                break;

            case TreeItemType.RESOURCES_GROUP:
                this.setExpandableIcon(true);
                this.contextValue = 'resourcesGroup';
                this.tooltip = `资源文件（${this.projectData.resources.length} 个）\n${this.projectData.resources.map(f => '  • ' + path.basename(f)).join('\n')}`;
                break;

            case TreeItemType.DIR_GROUP:
                this.setExpandableIcon(false);
                this.contextValue = 'dirGroup';
                this.tooltip = this.dirPath;
                break;

            case TreeItemType.HEADER_FILE:
                this.iconPath = vscode.ThemeIcon.File;
                this.resourceUri = vscode.Uri.file(this.getFullPath());
                this.contextValue = 'qtFile';
                this.setFileCommand();
                break;

            case TreeItemType.SOURCE_FILE:
                this.iconPath = vscode.ThemeIcon.File;
                this.resourceUri = vscode.Uri.file(this.getFullPath());
                this.contextValue = 'qtFile';
                this.setFileCommand();
                break;

            case TreeItemType.FORM_FILE:
                this.iconPath = vscode.ThemeIcon.File;
                this.resourceUri = vscode.Uri.file(this.getFullPath());
                this.contextValue = 'qtFile';
                this.setFileCommand();
                break;

            case TreeItemType.RESOURCE_FILE:
                this.iconPath = vscode.ThemeIcon.File;
                this.resourceUri = vscode.Uri.file(this.getFullPath());
                this.contextValue = 'qtFile';
                this.setFileCommand();
                break;

            case TreeItemType.OTHER_FILES_GROUP:
                this.setExpandableIcon(true);
                this.contextValue = 'otherFilesGroup';
                this.tooltip = `其他文件（${(this.projectData.translations || []).length} 个）\n${(this.projectData.translations || []).map(f => '  • ' + path.basename(f)).join('\n')}`;
                break;

            case TreeItemType.QRC_FILES_GROUP:
                this.setExpandableIcon(false);
                this.contextValue = 'qrcFilesGroup';
                this.tooltip = this.dirPath || (typeof this.label === 'string' ? this.label : '');
                break;

            case TreeItemType.OTHER_FILE:
                this.iconPath = vscode.ThemeIcon.File;
                this.resourceUri = vscode.Uri.file(this.getFullPath());
                this.contextValue = 'qtFile';
                this.setFileCommand();
                break;

            case TreeItemType.QRC_RESOURCE:
                this.iconPath = vscode.ThemeIcon.File;
                this.resourceUri = vscode.Uri.file(this.getFullPath());
                this.contextValue = 'qtFile';
                this.setFileCommand();
                break;
        }
    }

    private setFileCommand(): void {
        if (this.filePath) {
            const fullPath = path.resolve(this.projectData.projectFileDir, this.filePath);
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.file(fullPath)]
            };

            this.tooltip = fullPath;
        }
    }

    /**
     * 判断节点类型是否为文件项
     */
    static isFileType(type: TreeItemType): boolean {
        return type === TreeItemType.PRO_FILE ||
            type === TreeItemType.HEADER_FILE ||
            type === TreeItemType.SOURCE_FILE ||
            type === TreeItemType.FORM_FILE ||
            type === TreeItemType.RESOURCE_FILE ||
            type === TreeItemType.OTHER_FILE ||
            type === TreeItemType.QRC_RESOURCE;
    }

    /** Full path for file items (relative filePath + project dir); panics if filePath is undefined */
    private getFullPath(): string {
        return path.resolve(this.projectData.projectFileDir, this.filePath!);
    }

    /** Absolute path for file nodes; undefined for groups and project root */
    getAbsolutePath(): string | undefined {
        if (this.type === TreeItemType.PRO_FILE) {
            return this.projectData.projectFilePath;
        }
        if (this.filePath) {
            return path.resolve(this.projectData.projectFileDir, this.filePath);
        }
        return undefined;
    }

    getUri(): vscode.Uri | undefined {
        const absPath = this.getAbsolutePath();
        return absPath ? vscode.Uri.file(absPath) : undefined;
    }
}

