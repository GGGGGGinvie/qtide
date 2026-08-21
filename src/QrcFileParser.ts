import * as fs from 'fs';

export class QrcFileParser {

    static parse(qrcPath: string): string[] {
        if (!fs.existsSync(qrcPath)) return [];
        const content = fs.readFileSync(qrcPath, 'utf-8');
        const files: string[] = [];
        const fileRegex = /<file[^>]*>([^<]+)<\/file>/gi;
        let match;
        while ((match = fileRegex.exec(content)) !== null) {
            files.push(match[1].trim());
        }
        return files;
    }
}