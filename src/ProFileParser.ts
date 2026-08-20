import * as path from 'path';
import { ProjectType, QtProjectData } from './QtTypeDefine';

export class ProFileParser {

    static parse(proFilePath: string): QtProjectData | null {
        const fs = require('fs');

        let content: string;
        try {
            content = fs.readFileSync(proFilePath, 'utf-8');
        } catch (err) {
            console.error(`Failed to read project file: ${proFilePath}`, err);
            return null;
        }

        const fileDir = path.dirname(proFilePath);
        const fileName = path.basename(proFilePath);

        const lines = ProFileParser.preprocess(content);
        const vars = ProFileParser.parseVariables(lines, fileDir);

        const targetArr = vars['TARGET'];
        const ext = path.extname(fileName);
        const target = (targetArr && targetArr.length > 0) ? targetArr[0] : path.basename(fileName, ext);

        const subProjects: QtProjectData[] = [];
        const includePaths = ProFileParser.collectIncludes(lines, vars, fileDir);
        for (const priPath of includePaths) {
            const sub = ProFileParser.parse(priPath);
            if (sub) {
                sub.isSubProject = true;
                subProjects.push(sub);
            }
        }

        return {
            name: target,
            projectType: ProjectType.QMAKE,
            projectFilePath: proFilePath,
            projectFileDir: fileDir,
            headers: vars['HEADERS'] || [],
            sources: vars['SOURCES'] || [],
            forms: vars['FORMS'] || [],
            resources: vars['RESOURCES'] || [],
            translations: vars['TRANSLATIONS'] || [],
            distfiles: vars['DISTFILES'] || [],
            subProjects: subProjects.length > 0 ? subProjects : undefined,
        };
    }

    private static preprocess(content: string): string[] {
        const rawLines = content.split(/\r?\n/);
        const mergedLines: string[] = [];
        let currentLine = '';

        for (const rawLine of rawLines) {
            const trimmed = ProFileParser.stripComment(rawLine).trim();

            if (trimmed.length === 0) {
                if (currentLine.trim().length > 0) {
                    mergedLines.push(currentLine.trim());
                    currentLine = '';
                }
                continue;
            }

            if (trimmed.endsWith('\\')) {
                currentLine += trimmed.slice(0, -1).trimEnd() + ' ';
            } else {
                currentLine += trimmed;
                mergedLines.push(currentLine);
                currentLine = '';
            }
        }

        if (currentLine.trim().length > 0) {
            mergedLines.push(currentLine.trim());
        }

        return mergedLines;
    }

    private static stripComment(line: string): string {
        const commentIdx = line.indexOf('#');
        if (commentIdx >= 0) {
            return line.substring(0, commentIdx);
        }
        return line;
    }

    private static parseVariables(lines: string[], proFileDir: string): Record<string, string[]> {
        const rawVars: Record<string, string[]> = {};
        const assignRegex = /^(\w+)\s*(\+?=)\s*(.*)$/;

        for (const line of lines) {
            const match = line.match(assignRegex);
            if (!match) continue;

            const varName = match[1];
            const operator = match[2];
            const rawValue = match[3].trim();
            if (rawValue.length === 0) continue;

            const values = rawValue.split(/\s+/).filter(v => v.length > 0);

            if (operator === '+=') {
                if (!rawVars[varName]) rawVars[varName] = [];
                rawVars[varName].push(...values);
            } else {
                rawVars[varName] = values;
            }
        }

        const resolved = ProFileParser.resolveReferences(rawVars, proFileDir);
        const result: Record<string, string[]> = {};
        for (const key of Object.keys(resolved)) {
            result[key] = resolved[key].map(v => ProFileParser.resolveVarRef(v, resolved, proFileDir));
        }
        return result;
    }

    private static collectIncludes(
        lines: string[],
        vars: Record<string, string[]>,
        baseDir: string
    ): string[] {
        const includeRegex = /^include\s*\(\s*(.+?)\s*\)$/i;
        const result: string[] = [];
        const seen = new Set<string>();
        for (const line of lines) {
            const match = line.match(includeRegex);
            if (!match) continue;
            let includePath = match[1].trim();
            includePath = ProFileParser.resolveVarRef(includePath, vars, baseDir);
            const absPath = path.resolve(baseDir, includePath);
            if (!seen.has(absPath)) {
                seen.add(absPath);
                result.push(absPath);
            }
        }
        return result;
    }

    private static resolveReferences(
        vars: Record<string, string[]>,
        proFileDir: string
    ): Record<string, string[]> {
        const resolved: Record<string, string[]> = {};

        resolved['PWD'] = [proFileDir];

        for (const key of Object.keys(vars)) {
            resolved[key] = vars[key].map(v => ProFileParser.resolveVarRef(v, resolved, proFileDir));
        }

        return resolved;
    }

    private static resolveVarRef(
        value: string,
        vars: Record<string, string[]>,
        proFileDir: string
    ): string {
        return value.replace(/\$\$(\w+)/g, (match, varName) => {
            if (varName === 'PWD') return proFileDir;
            const ref = vars[varName];
            if (ref && ref.length > 0) {
                return ref[0];
            }
            return match;
        });
    }
}
