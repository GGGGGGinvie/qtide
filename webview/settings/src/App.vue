<template>
    <div class="app">
        <div class="header">
            <h1>Qtide 设置</h1>
            <span class="badge">功能开发中</span>
        </div>
        <div class="body">
            <div class="sidebar">
                <button
                    v-for="g in groups"
                    :key="g.id"
                    class="tab-btn"
                    :class="{ active: activeTab === g.id }"
                    @click="activeTab = g.id"
                >{{ g.label }}</button>
            </div>
            <div class="content">
                <div v-if="groups.length === 0" class="placeholder">
                    <h2>等待配置...</h2>
                    <p>功能开发中</p>
                </div>
                <div v-for="g in groups" :key="g.id" v-show="activeTab === g.id" class="tab-pane">
                    <h2>{{ g.label }}</h2>
                    <div v-for="f in g.fields" :key="f.key" class="field" :class="{ 'field-checkbox': f.type === 'checkbox' }">
                        <div v-if="f.type !== 'checkbox'" class="field-label">
                            <label :for="'fld_' + f.key">{{ f.label }}</label>
                            <span v-if="f.description" class="field-desc">{{ f.description }}</span>
                        </div>
                        <input
                            v-if="f.type === 'text'"
                            :id="'fld_' + f.key"
                            v-model="form[f.key]"
                            type="text"
                            :placeholder="f.description"
                        />
                        <textarea
                            v-else-if="f.type === 'textarea'"
                            :id="'fld_' + f.key"
                            v-model="form[f.key]"
                            :placeholder="f.description"
                        ></textarea>
                        <select
                            v-else-if="f.type === 'dropdown'"
                            :id="'fld_' + f.key"
                            v-model="form[f.key]"
                        >
                            <option v-for="opt in f.options" :key="opt.value" :value="opt.value">
                                {{ opt.label }}
                            </option>
                        </select>
                        <div v-else-if="f.type === 'checkbox'" class="checkbox-wrap">
                            <input :id="'fld_' + f.key" v-model="form[f.key]" type="checkbox" />
                            <label :for="'fld_' + f.key">{{ f.label }}</label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="footer">
            <button class="btn btn-secondary" @click="onReset">重置</button>
            <button class="btn btn-primary" @click="onSave">保存</button>
        </div>
    </div>
</template>

<script>
const vscode = acquireVsCodeApi()

export default {
    data() {
        return {
            groups: [],
            activeTab: '',
            form: {}
        }
    },
    created() {
        window.addEventListener('message', (event) => {
            const msg = event.data
            if (msg.config?.groups) {
                this.groups = msg.config.groups
                if (this.groups.length > 0) {
                    this.activeTab = this.groups[0].id
                }
                const data = {}
                for (const g of this.groups) {
                    for (const f of g.fields) {
                        data[f.key] = f.value
                    }
                }
                this.form = data
            }
        })
        vscode.postMessage('qtide.settings.launched')
    },
    methods: {
        onSave() {
            vscode.postMessage(this.form)
        },
        onReset() {
            const data = {}
            for (const g of this.groups) {
                for (const f of g.fields) {
                    data[f.key] = f.value
                }
            }
            this.form = data
        }
    }
}
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
    --bg: var(--vscode-editor-background, #1e1e1e);
    --fg: var(--vscode-editor-foreground, #cccccc);
    --border: var(--vscode-editorWidget-border, #454545);
    --tab-active-bg: var(--vscode-list-activeSelectionBackground, #094771);
    --tab-active-fg: var(--vscode-list-activeSelectionForeground, #ffffff);
    --tab-hover-bg: var(--vscode-list-hoverBackground, #2a2d2e);
    --input-bg: var(--vscode-input-background, #3c3c3c);
    --input-fg: var(--vscode-input-foreground, #cccccc);
    --input-border: var(--vscode-input-border, #555555);
    --desc-fg: var(--vscode-descriptionForeground, #9d9d9d);
    --btn-bg: var(--vscode-button-background, #007acc);
    --btn-fg: var(--vscode-button-foreground, #ffffff);
    --btn-hover-bg: var(--vscode-button-hoverBackground, #0062a3);
}

body {
    font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
    font-size: 13px;
    color: var(--fg);
    background: var(--bg);
    margin: 0;
    height: 100vh;
}

.app {
    display: flex;
    flex-direction: column;
    height: 100vh;
}

.header {
    padding: 16px 20px 8px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
}

.header h1 { font-size: 18px; font-weight: 600; }

.badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--btn-bg);
    color: var(--btn-fg);
}

.body {
    display: flex;
    flex: 1;
    overflow: hidden;
}

.sidebar {
    width: 200px;
    min-width: 160px;
    border-right: 1px solid var(--border);
    padding: 8px 0;
    overflow-y: auto;
}

.tab-btn {
    display: block;
    width: 100%;
    padding: 8px 16px;
    border: none;
    background: transparent;
    color: var(--fg);
    font-family: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    border-left: 3px solid transparent;
}

.tab-btn:hover { background: var(--tab-hover-bg); }

.tab-btn.active {
    background: var(--tab-active-bg);
    color: var(--tab-active-fg);
    border-left-color: var(--btn-bg);
}

.content {
    flex: 1;
    padding: 20px 24px;
    overflow-y: auto;
}

.placeholder {
    text-align: center;
    padding: 40px;
    border: 1px dashed var(--border);
    border-radius: 8px;
}

.placeholder p {
    font-size: 14px;
    color: var(--desc-fg);
    margin-top: 8px;
}

.tab-pane h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
}

.field { margin-bottom: 16px; }

.field-checkbox { display: flex; align-items: center; gap: 8px; }

.field-label { margin-bottom: 4px; }

.field-label label {
    display: block;
    font-size: 13px;
    font-weight: 500;
}

.field-desc {
    font-size: 11px;
    color: var(--desc-fg);
}

input[type="text"],
textarea,
select {
    width: 100%;
    max-width: 400px;
    padding: 4px 8px;
    background: var(--input-bg);
    color: var(--input-fg);
    border: 1px solid var(--input-border);
    border-radius: 2px;
    font-family: inherit;
    font-size: 13px;
}

textarea { resize: vertical; min-height: 60px; }

select { max-width: 200px; cursor: pointer; }

.checkbox-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
}

input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--btn-bg);
    cursor: pointer;
}

.footer {
    padding: 12px 20px;
    border-top: 1px solid var(--border);
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}

.btn {
    padding: 6px 16px;
    border: none;
    border-radius: 2px;
    font-family: inherit;
    font-size: 13px;
    cursor: pointer;
}

.btn-primary {
    background: var(--btn-bg);
    color: var(--btn-fg);
}

.btn-primary:hover { background: var(--btn-hover-bg); }

.btn-secondary {
    background: transparent;
    color: var(--fg);
    border: 1px solid var(--border) !important;
}

.btn-secondary:hover { background: var(--tab-hover-bg); }
</style>
