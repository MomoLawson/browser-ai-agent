/**
 * UI 样式 — 通过 Shadow DOM 注入，完全隔离
 */

const AGENT_STYLE_ID = 'bai-agent-styles'

const styles = `
/* ===== 全局样式覆盖 ===== */
#browser-ai-agent-container {
  all: initial;
  position: relative;
  z-index: 9999;
}

/* ===== Agent 面板 ===== */
.bai-panel {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: #1a1a2e;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  padding: 12px 16px;
  margin: 8px 0;
  max-width: 360px;
  transition: all 0.2s ease;
}

.bai-panel:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}

.bai-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 14px;
}

.bai-panel-status {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}

.bai-panel-status.idle { background: #94a3b8; }
.bai-panel-status.running { background: #22c55e; animation: bai-pulse 1.5s infinite; }
.bai-panel-status.error { background: #ef4444; }
.bai-panel-status.completed { background: #22c55e; }

@keyframes bai-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.bai-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  background: #6366f1;
  color: white;
}

.bai-btn:hover {
  background: #4f46e5;
  transform: translateY(-1px);
}

.bai-btn:active {
  transform: translateY(0);
}

.bai-btn.secondary {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
}

.bai-btn.secondary:hover {
  background: #e2e8f0;
}

.bai-project-path {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 11px;
  color: #64748b;
  background: #f8fafc;
  padding: 4px 8px;
  border-radius: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bai-log {
  max-height: 200px;
  overflow-y: auto;
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 11px;
  background: #0f172a;
  color: #e2e8f0;
  padding: 8px;
  border-radius: 8px;
  margin-top: 8px;
}

.bai-log-line {
  padding: 2px 0;
  border-bottom: 1px solid #1e293b;
}

.bai-log-line:last-child {
  border-bottom: none;
}

.bai-log-line.info { color: #38bdf8; }
.bai-log-line.success { color: #4ade80; }
.bai-log-line.error { color: #f87171; }
.bai-log-line.warn { color: #fbbf24; }

/* ===== 项目选择器 ===== */
.bai-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #f8fafc;
  border: 2px dashed #cbd5e1;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.bai-selector:hover {
  border-color: #6366f1;
  background: #eef2ff;
}

.bai-selector-icon {
  font-size: 20px;
  line-height: 1;
}

/* ===== 按钮行 ===== */
.bai-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}
`

/**
 * 注入 Agent 全局样式（兼容 Userscript 的 GM_addStyle 和 Extension 的 Shadow DOM）
 */
export function createAgentStyles(): () => void {
  // 检查是否已注入
  if (document.getElementById(AGENT_STYLE_ID)) {
    return () => {} // noop
  }

  const style = document.createElement('style')
  style.id = AGENT_STYLE_ID
  style.textContent = styles
  document.head.appendChild(style)

  return () => style.remove()
}
