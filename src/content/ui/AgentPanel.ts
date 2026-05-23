/**
 * AgentPanel — 简洁状态面板
 *
 * 无文件树，字体更大，手动选择项目。
 * 左下角有设置按钮（齿轮图标），打开语言选择面板。
 */
const CSS = `
*{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans SC',sans-serif}
.overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;animation:fadeIn .12s ease}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.panel{width:380px;max-width:92vw;background:#fff;border-radius:14px;box-shadow:0 8px 36px rgba(0,0,0,.2);display:flex;flex-direction:column;animation:slideUp .15s ease}
@keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e2e8f0;cursor:move;flex-shrink:0}
.hdr-l{display:flex;align-items:center;gap:8px;font-weight:600;font-size:15px;color:#1a1a2e}
.hdr-r{display:flex;gap:4px}
.hdr-r button{width:28px;height:28px;border:none;border-radius:6px;background:transparent;color:#94a3b8;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.hdr-r button:hover{background:#f1f5f9;color:#475569}
.body{padding:16px}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;flex-shrink:0}
.dot.idle{background:#94a3b8}.dot.listening{background:#22c55e}.dot.error{background:#ef4444}
.status{font-size:13px;color:#64748b;margin-bottom:14px}
.status-bar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f8fafc;border-radius:8px}
.row{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.info{flex:1;min-width:0;padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.info.act{border-color:#6366f1;color:#1a1a2e}.info .lbl{color:#94a3b8;font-size:12px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:8px 16px;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;transition:all .12s;white-space:nowrap;flex-shrink:0}
.btn:active{transform:scale(.96)}
.btn-p{background:#6366f1;color:#fff}.btn-p:hover{background:#4f46e5}
.btn-g{background:#22c55e;color:#fff}.btn-g:hover{background:#16a34a}
.btn-o{background:transparent;color:#64748b;border:1px solid #e2e8f0}.btn-o:hover{background:#f8fafc}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none}

/* 提示词 */
.pblock{background:#fefce8;border:1px solid #fde68a;border-radius:10px;overflow:hidden;margin-bottom:12px}
.pblock.hidden{display:none}
.phdr{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#fef3c7;font-size:12px;font-weight:600;color:#92400e}
.ptext{font-family:'SF Mono','Fira Code',monospace;font-size:12px;line-height:1.5;padding:10px 12px;background:#fffbeb;color:#1a1a2e;white-space:pre-wrap;max-height:120px;overflow-y:auto}
.pacts{display:flex;gap:6px;padding:8px 12px;background:#fef3c7;border-top:1px solid #fde68a}

/* 设置面板 */
.sp{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483648;background:#fff;border-radius:14px;box-shadow:0 8px 36px rgba(0,0,0,.25);padding:20px;width:300px;max-width:90vw}
.sp.hidden{display:none}
.sp h3{margin:0 0 12px;font-size:15px;color:#1a1a2e}
.sp label{display:block;font-size:13px;color:#64748b;margin-bottom:6px}
.sp select{width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;color:#1a1a2e;background:#fff;cursor:pointer}
.sp .sp-close{margin-top:14px;width:100%}

/* 日志 */
.log{margin-top:6px}
.log-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.log-t{font-size:12px;font-weight:600;color:#64748b}
.log-b{max-height:140px;overflow-y:auto;background:#0f172a;border-radius:8px;padding:6px 8px;font-family:'SF Mono','Fira Code',monospace;font-size:11px;line-height:1.5}
.log-b .e{display:flex;gap:5px;word-break:break-all;padding:1px 0}
.log-b .t{color:#475569;flex-shrink:0}
.log-b .m.info{color:#7dd3fc}.log-b .m.success{color:#86efac}.log-b .m.error{color:#fca5a5}.log-b .m.warn{color:#fde68a}
.log-b .empty{color:#475569;text-align:center;padding:10px 0;font-size:12px}
.log-b::-webkit-scrollbar{width:4px}
.log-b::-webkit-scrollbar-thumb{background:#334155;border-radius:2px}
`

import { loadSettings, saveSettings, resolveLang, LANG_NAMES, type Lang } from '../settings'

export class AgentPanel {
  private host: HTMLElement
  private shadow: ShadowRoot
  private dragging=false;private dOff={x:0,y:0}
  private elPane!: HTMLElement;private elStatus!: HTMLElement;private elSelect!: HTMLButtonElement
  private elInfo!: HTMLElement;private elLog!: HTMLElement;private elPrompt!: HTMLElement;private elPromptText!: HTMLElement
  private elSettingsBtn!: HTMLButtonElement
  private elSettingsPanel!: HTMLElement;private elLangSelect!: HTMLSelectElement
  onSelectProject?:()=>Promise<{name:string;fileCount:number}|null>
  onClose?:()=>void
  onCopyToInput?:(text:string)=>void
  onSettingsChange?:()=>void

  constructor(){
    this.host=document.createElement('div');document.body.appendChild(this.host)
    this.shadow=this.host.attachShadow({mode:'open'});this.render();this.bindEvents()
  }

  private render():void{
    this.shadow.innerHTML=`<style>${CSS}</style>
<div class="overlay" id="ov">
<div class="panel" id="pn">
<div class="hdr"><div class="hdr-l">🤖 AI Agent</div><div class="hdr-r"><button id="stgBtn" title="Settings">⚙️</button><button id="cl">✕</button></div></div>
<div class="body">
  <div class="status-bar"><span class="dot idle" id="dot"></span><span class="status" id="st">Waiting for project</span></div>
  <div class="row">
    <button class="btn btn-p" id="sel">📁 Select project</button>
    <div class="info" id="info"><span class="lbl">Not selected</span></div>
  </div>
  <div class="pblock hidden" id="pb">
    <div class="phdr">📋 Send prompt to AI</div>
    <div class="ptext" id="pt"></div>
    <div class="pacts">
      <button class="btn btn-g" id="ci">📝 Fill input</button>
      <button class="btn btn-o" id="cc">📋 Copy</button>
    </div>
  </div>
  <div class="log">
    <div class="log-h"><span class="log-t">Logs</span><button class="btn btn-o" id="clr" style="font-size:11px;padding:3px 8px">Clear</button></div>
    <div class="log-b" id="lb"><div class="empty">Connect a project to see logs</div></div>
  </div>
</div></div>
<div class="sp hidden" id="sp">
  <h3>⚙️ Settings</h3>
  <label>Language / 语言 / 語言</label>
  <select id="langSel"></select>
  <button class="btn btn-p sp-close" id="spCl">Close</button>
</div>`
    this.elPane=this.byId('pn');this.elStatus=this.byId('dot');this.elSelect=this.byId('sel') as HTMLButtonElement
    this.elInfo=this.byId('info');this.elLog=this.byId('lb');this.elPrompt=this.byId('pb');this.elPromptText=this.byId('pt')
    this.elSettingsBtn=this.byId('stgBtn') as HTMLButtonElement
    this.elSettingsPanel=this.byId('sp');this.elLangSelect=this.byId('langSel') as HTMLSelectElement
    // Populate language options
    const current = loadSettings().language
    this.elLangSelect.innerHTML=Object.entries(LANG_NAMES).map(([k,v])=>`<option value="${k}"${k===current?' selected':''}>${v}</option>`).join('')
  }
  private byId(i:string):HTMLElement{return this.shadow.getElementById(i)!}

  private bindEvents():void{
    const hdr=this.shadow.querySelector('.hdr')!;hdr.addEventListener('mousedown',e=>{const me=e as MouseEvent;if((me.target as HTMLElement).closest('button'))return;this.dragging=true;this.dOff.x=me.clientX-this.elPane.offsetLeft;this.dOff.y=me.clientY-this.elPane.offsetTop})
    document.addEventListener('mousemove',e=>{const me=e as MouseEvent;if(!this.dragging)return;this.elPane.style.left=(me.clientX-this.dOff.x)+'px';this.elPane.style.top=(me.clientY-this.dOff.y)+'px';this.elPane.style.margin='0'})
    document.addEventListener('mouseup',()=>{this.dragging=false})
    this.byId('cl').addEventListener('click',()=>this.onClose?.())
    this.byId('ov').addEventListener('click',e=>{if(e.target===e.currentTarget)this.onClose?.()})
    this.elSelect.addEventListener('click',async()=>{if(!this.onSelectProject)return;this.elSelect.disabled=true;this.elSelect.textContent='⏳...';try{const r=await this.onSelectProject();if(r)this.setProjectInfo(r.name,r.fileCount)}catch(e){this.addLog('error',`❌ ${(e as Error).message}`)}finally{this.elSelect.disabled=false;this.elSelect.textContent='📁 Select project'}})
    this.byId('clr').addEventListener('click',()=>this.clearLogs())
    this.byId('ci').addEventListener('click',()=>{if(!this.elPromptText.textContent)return;this.onCopyToInput?.(this.elPromptText.textContent);this.addLog('success','📝 Filled input')})
    this.byId('cc').addEventListener('click',()=>{const t=this.elPromptText.textContent;if(!t)return;navigator.clipboard.writeText(t).then(()=>this.addLog('success','📋 Copied'))})

    // Settings
    this.elSettingsBtn.addEventListener('click',()=>{
      this.elSettingsPanel.classList.toggle('hidden')
    })
    this.elLangSelect.addEventListener('change',()=>{
      const s=loadSettings();s.language=this.elLangSelect.value as Lang;saveSettings(s)
    })
    this.byId('spCl').addEventListener('click',()=>{
      this.elSettingsPanel.classList.add('hidden')
      this.onSettingsChange?.()
    })
  }

  showPrompt(t:string):void{this.elPromptText.textContent=t;this.elPrompt.classList.remove('hidden')}
  setStatus(s:'idle'|'listening'|'error',t?:string):void{this.elStatus.className=`dot ${s}`;if(t)this.byId('st').textContent=t}
  setProjectInfo(name:string,count:number):void{this.elInfo.innerHTML=`<span class="lbl">Project:</span> ${esc(name)}  │  <span class="lbl">Files:</span> ${count}`;this.elInfo.classList.add('act')}
  addLog(type:'info'|'success'|'error'|'warn',msg:string):void{const e=this.elLog.querySelector('.empty');if(e)e.remove();const d=document.createElement('div');d.className='e';d.innerHTML=`<span class="t">${tm()}</span><span class="m ${type}">${esc(msg)}</span>`;this.elLog.appendChild(d);this.elLog.scrollTop=this.elLog.scrollHeight}
  clearLogs():void{this.elLog.innerHTML='<div class="empty">Cleared</div>'}
  updateStatusBar(t:string):void{this.byId('st').textContent=t}
  destroy():void{this.host.remove()}
}
function esc(s:string):string{const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function tm():string{return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
